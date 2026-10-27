import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { createConcurrencyLimiter } from "./concurrency.js";
import { judgeConstraints, togetherJson, type ConstraintVerdict } from "./judge/judge.js";
import { READER_SYSTEM, TASK_CONSTRAINTS_RUBRIC } from "./judge/rubrics.js";
import type { ReferenceCapture } from "./references.js";
import { hostMatches, siteHosts, type Task } from "./tasks.js";

// Different model family from the judge panel (Kimi, GLM) on purpose: the
// reader extracts, the panel audits, and neither grades its own family.
export const READER_MODEL = "MiniMaxAI/MiniMax-M3";
const READER_CACHE_DIR = path.join("cache", "reader");
const runReader = createConcurrencyLimiter(8);

export const PASS_SCORE = 0.8;
// Reader context budget per document (~10k tokens): fits a full article behind
// a long nav block, the case a head slice of 15k chars graded as a miss.
export const DOC_CHARS = 40000;

export interface BundleDoc {
  url: string;
  title?: string; // provider-returned page title, when it is metadata rather than body text
  content: string;
}

// A cut can split an emoji's surrogate pair; Together rejects the lone half.
const wellFormed = (s: string) => s.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");

export function formatBundle(docs: BundleDoc[]): string {
  return docs
    .map((d, i) => `--- DOCUMENT ${i + 1} — SOURCE URL: ${d.url}${d.title ? `\nPAGE TITLE: ${d.title}` : ""}\n${wellFormed(d.content.slice(0, DOC_CHARS))}`)
    .join("\n\n");
}

async function cachedReader(prompt: string): Promise<any> {
  const key = crypto.createHash("md5").update(`${READER_MODEL}||${READER_SYSTEM}||${prompt}`).digest("hex");
  const file = path.join(READER_CACHE_DIR, `${key}.json`);
  try {
    return JSON.parse(await fs.readFile(file, "utf-8"));
  } catch {
    // miss
  }
  const out = await togetherJson(READER_MODEL, READER_SYSTEM, prompt, { reasoning_effort: "low" }, runReader);
  await fs.mkdir(READER_CACHE_DIR, { recursive: true });
  await fs.writeFile(file, JSON.stringify(out));
  return out;
}

// ---------- text matching ----------

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): Set<string> {
  return new Set(normalize(s).split(" ").filter((t) => t.length > 1));
}

// Two headlines are the same story if their token sets overlap heavily, or one
// contains the other (sites trim or extend headlines between page and feed).
export function titlesMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na];
  if (short.length >= 15 && long.includes(short)) return true;
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return false;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  if (inter / (ta.size + tb.size - inter) >= 0.6) return true;
  // Feeds often reword the page headline around the same core phrase
  // (Spiegel: kicker + headline on the page, "Topic: headline" in RSS).
  return inter >= 5 && inter / Math.min(ta.size, tb.size) >= 0.55;
}

// The reader is told to answer only from the documents, but it knows a lot of
// these facts by heart; a correct answer the pages never state is a leak and
// earns nothing. Words compare on normalized text, numbers on their digits
// (thousands separators and units dropped, never a digit run inside another).
function plain(s: string, links = "$1"): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\\([\\`*_{}[\]()#+\-.!|])/g, "$1")
    .replace(/\[([^\]]*)\]\(([^)]*)\)/g, links)
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201c\u201d\u2033]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/(?<=\d)[,\u00a0\u202f'](?=\d{3}(?!\d))/g, "")
    .replace(/(?<=\b\d{1,2}):(?=\d{2}\b)/g, ".")
    .replace(/\s+/g, " ");
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

function hasNumber(h: string, x: string): boolean {
  const decimal = /^\d+\.\d+$/.test(x);
  const core = decimal ? x.replace(/0+$/, "").replace(/\.$/, "") : x;
  const tail = !decimal ? "" : core.includes(".") ? "0*" : "(?:\\.0+)?";
  // Listings glue a relative time onto the value ("1.2026.2862d ago").
  const end = `(?:(?!\\d|\\.\\d)|(?=\\d{1,2}\\s?(?:s|sec|min|m|h|hr|d|w|wk|mo|y|yr)s?\\s+ago\\b))`;
  return new RegExp(`(?<![\\d.])${escapeRe(core)}${tail}${end}`).test(h);
}

// "120.1 billion" read off a table in millions ("$120,067").
function hasInMillions(h: string, x: string): boolean {
  const places = x.split(".")[1]?.length ?? 0;
  return [...h.matchAll(/(?<![\d.])(\d{4,7})(?![\d]|\.\d)/g)].some((m) => (Number(m[1]) / 1000).toFixed(places) === Number(x).toFixed(places));
}

// A markdown link counts by its text and, separately, by its target.
export function groundedIn(needle: string, haystack: string): boolean {
  return groundedInText(needle, plain(haystack)) || groundedInText(needle, plain(haystack, "$1 $2"));
}

function groundedInText(needle: string, h: string): boolean {
  let n = plain(needle).trim();
  if (!n) return false;
  // Pages link their own site by path ("/questions/979256/…").
  const url = n.match(/^(?:https?:\/\/)?(?:www\.)?[\w-]+(?:\.[\w-]+)+(\/\S+)$/);
  if (url) n = url[1];
  // Dates, amounts and versions: every number must be in the documents as its own number.
  if (/\d/.test(n) && n.replace(/[^\p{L}]/gu, "").length <= 12) {
    const scaled = /\d\s*(?:billion|bn|b)\b/.test(n);
    return (n.match(/\d+(?:\.\d+)*/g) ?? []).every((x) => hasNumber(h, x) || (scaled && hasInMillions(h, x)));
  }
  const nn = normalize(n);
  const hh = normalize(h);
  if (!nn) return false;
  // Long titles may run into the next token on a scraped page ("…Lab55m ago").
  return CJK.test(nn) || nn.length >= 15 ? hh.includes(nn) : ` ${hh} `.includes(` ${nn} `);
}

// The part of a correct answer the documents must contain: what the key
// matched, or each term a lookahead-only key requires.
export function factNeedles(pattern: RegExp, answer: string): string[] {
  const m = answer.match(pattern);
  if (!m) return [];
  if (m[0].trim()) return [m[0]];
  const terms = [...pattern.source.matchAll(/\(\?=\[\\s\\S\]\*(?:\\b)?([\p{L}\d][\p{L}\d ]*)/gu)].map((x) => x[1]);
  return terms.length ? terms : [answer];
}

const versionOf = (s: string) => s.match(/\d+\.\d+(\.\d+)?/)?.[0] ?? null;

export function parseNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string") return null;
  const m = v.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

// ---------- graders ----------

export interface Grade {
  score: number; // 0..1, partial credit
  pass: boolean;
  reader?: unknown; // the reader's parsed reply
  detail: string;
  constraints?: { text: string; value: number }[];
  verdicts?: ConstraintVerdict[];
  error?: string; // grading failed — the record must be re-graded, never scored
  offSiteScore?: number; // site tasks: the score had mirror pages counted
}

// `pages` is the text the reader saw; without it the answers are graded on the key alone.
export function gradeFacts(task: Task, answers: string[], pages?: string): Pick<Grade, "score" | "detail"> {
  const facts = task.facts ?? [];
  const marks = facts.map((f, i) => {
    const a = String(answers[i] ?? "");
    if (!f.pattern.test(a)) return "✗";
    return pages === undefined || factNeedles(f.pattern, a).every((n) => groundedIn(n, pages)) ? "✓" : "✗ not in the pages:";
  });
  return {
    score: facts.length ? marks.filter((m) => m === "✓").length / facts.length : 0,
    detail: marks.map((m, i) => `${m} ${facts[i].q}`).join(" | "),
  };
}

// Spiegel teasers end in an author line the feed title never has.
const stripByline = (s: string) => s.replace(/\s+von\s+\p{Lu}[\p{L}-]+(\s+\p{Lu}[\p{L}-]+){0,2}\s*$/u, "");

export function gradeOverlap(items: string[], ref: ReferenceCapture, pages?: string): Pick<Grade, "score" | "detail"> {
  const listed = items.slice(0, 5);
  const picked = listed.filter((it) => pages === undefined || groundedIn(it, pages)).map(stripByline);
  const unread = listed.length - picked.length;
  // A homepage may show an item's summary line instead of its headline (NYT to crawlers).
  const matched = picked.filter((it) =>
    ref.items.some((r, i) => titlesMatch(it, r) || (ref.alts?.[i] ?? []).some((a) => titlesMatch(it, a))),
  );
  return {
    score: matched.length / 5,
    detail: `${matched.length}/5 items found in the reference top ${ref.items.length}${unread ? `; ${unread} not in the pages` : ""}`,
  };
}

export function gradeLatest(answer: string, ref: ReferenceCapture, pages?: string): Pick<Grade, "score" | "detail"> {
  const g = matchLatest(answer, ref);
  if (g.score > 0 && pages !== undefined && !groundedIn(versionOf(answer) ?? answer, pages)) {
    return { score: 0, detail: `${answer} is not in the pages (newest: ${ref.items[0]})` };
  }
  return g;
}

function matchLatest(answer: string, ref: ReferenceCapture): Pick<Grade, "score" | "detail"> {
  const [newest, ...older] = ref.items;
  const same = (r: string) => {
    const va = versionOf(answer);
    const vr = versionOf(r);
    return vr && va ? va === vr : titlesMatch(answer, r);
  };
  if (newest && same(newest)) return { score: 1, detail: `matches newest: ${newest}` };
  const current = (ref.accept ?? []).find(same);
  if (current) return { score: 1, detail: `matches ${current}, also current (newest: ${newest})` };
  const stale = older.slice(0, 2).find(same);
  if (stale) return { score: 0.5, detail: `matches an older item: ${stale} (newest: ${newest})` };
  // Same release line (e.g. Node 24.x when 24.11.1 is current) earns half.
  const major = (s: string) => (versionOf(s) ?? s.match(/\d+/)?.[0])?.split(".")[0];
  if (newest && versionOf(newest) && major(answer) && major(answer) === major(newest)) {
    return { score: 0.5, detail: `same major line as ${newest}` };
  }
  return { score: 0, detail: `expected ${newest ?? "?"}` };
}

export function gradeNumeric(value: number | null, ref: ReferenceCapture, tolerance: number, pages?: string): Pick<Grade, "score" | "detail"> {
  const g = matchNumeric(value, ref, tolerance);
  if (g.score > 0 && pages !== undefined && !groundedIn(String(value), pages)) {
    return { score: 0, detail: `${value} is not in the pages (expected ${ref.values?.[0]})` };
  }
  return g;
}

function matchNumeric(value: number | null, ref: ReferenceCapture, tolerance: number): Pick<Grade, "score" | "detail"> {
  const vals = ref.values ?? [];
  if (value === null) return { score: 0, detail: `no number (expected ${vals[0]})` };
  const near = (v: number) => Math.abs(value - v) / v <= tolerance;
  // The reference is captured in the same round, so only its latest close is current.
  if (vals[0] !== undefined && near(vals[0])) return { score: 1, detail: `${value} ≈ ${vals[0]}` };
  if (vals[1] !== undefined && near(vals[1])) return { score: 0.5, detail: `${value} matches the previous close ${vals[1]}` };
  return { score: 0, detail: `${value} vs ${vals[0]}` };
}

export interface ReaderGame {
  teams: string[];
  scores: number[];
}

const teamIs = (said: string, names: string[]) => {
  const n = ` ${normalize(said)} `;
  return names.some((x, i) => (i === 2 ? normalize(said) === normalize(x) : n.includes(` ${normalize(x)} `)));
};

// Final scores: a game counts when both teams and both scores match one final
// of the official game day, and the page itself shows them.
export function gradeScores(games: ReaderGame[], ref: ReferenceCapture, minGames: number, pages?: string): Pick<Grade, "score" | "detail"> {
  const finals = ref.games ?? [];
  if (finals.length === 0) return { score: 0, detail: "reference has no games" };
  const used = new Set<number>();
  let unread = 0;
  for (const g of games.slice(0, 15)) {
    const [t0, t1] = (g.teams ?? []).map(String);
    const [s0, s1] = (g.scores ?? []).map(Number);
    if (!t0 || !t1 || !Number.isFinite(s0) || !Number.isFinite(s1)) continue;
    const i = finals.findIndex((f, k) =>
      !used.has(k) &&
      ((teamIs(t0, f.teams[0]) && teamIs(t1, f.teams[1]) && s0 === f.scores[0] && s1 === f.scores[1]) ||
        (teamIs(t0, f.teams[1]) && teamIs(t1, f.teams[0]) && s0 === f.scores[1] && s1 === f.scores[0])),
    );
    if (i < 0) continue;
    const f = finals[i];
    if (pages !== undefined && ![String(s0), String(s1), f.teams[0][1], f.teams[1][1]].every((x) => groundedIn(x, pages))) {
      unread++;
      continue;
    }
    used.add(i);
  }
  const need = Math.min(minGames, finals.length);
  return {
    score: Math.min(1, used.size / need),
    detail: `${used.size} of ${games.length} games match the official ${finals[0].day} finals (need ${need})${unread ? `; ${unread} not in the pages` : ""}`,
  };
}

// ---------- per-tier entry point ----------

export function freshnessConstraint(task: Task, runDate: string): string | null {
  return task.freshDays
    ? `The items that satisfy the constraints above are dated within ${task.freshDays} days before the run date (${runDate}); pinned or older items elsewhere on the page are ignored`
    : null;
}

// The on-site gate only proves one fetched page was on the site; this makes
// the judges check that the evidence itself came from there.
export function siteConstraint(task: Task): string | null {
  return task.site
    ? `The items that satisfy the constraints above are shown on a ${siteHosts(task.site).join(" / ")} page itself (not a third-party aggregator, mirror, review or news site)`
    : null;
}

// Every prompt the reader or the panel sees for a task. Grading and the
// methodology page both call this, so the published prompts are the ones used.
export type TaskPrompt =
  | { to: "reader"; prompt: string }
  | { to: "judges"; prompt: string; constraints: string[] };

export function buildPrompt(task: Task, runDate: string, bundle: string): TaskPrompt {
  const header = `RUN DATE: ${runDate}\nREQUEST: ${task.request}\n\nDOCUMENTS:\n${bundle}\n\n`;
  if (task.tier === "stable-read" || task.tier === "stable-lookup") {
    const qs = task.facts!.map((f, i) => `${i + 1}. ${f.q}`).join("\n");
    return {
      to: "reader",
      prompt: `${header}QUESTIONS:\n${qs}\n\nReply as {"answers": [string, ...]} with one answer per question, in order. Use "NOT FOUND" for any answer the documents do not contain.`,
    };
  }
  if (task.tier === "live-feed") {
    const kind = task.reference!.kind;
    const ask =
      kind === "overlap"
        ? `List the 5 most prominent items (headlines or post titles; an item's summary line if the page shows no headline) from the DOCUMENTS that answer the REQUEST, copied exactly as written, most prominent first. List fewer only if the documents contain fewer than 5. Reply as {"items": [string, ...]}; use [] if the documents contain none.`
        : kind === "latest"
          ? `Answer the REQUEST with the single item it asks for (exact title, name or version number as written in the documents). Reply as {"answer": string}; use "NOT FOUND" if the documents do not contain it.`
          : kind === "scores"
            ? `List the final scores the DOCUMENTS show for the games the REQUEST asks about, as written in the documents (at most 15 games). Reply as {"games": [{"teams": [string, string], "scores": [number, number]}, ...]} with each score in the same order as its team; use [] if the documents show none.`
            : `Answer the REQUEST with the single number it asks for, as written in the documents. Reply as {"answer": number | null}.`;
    return { to: "reader", prompt: `${header}${ask}` };
  }
  const fresh = freshnessConstraint(task, runDate);
  const site = siteConstraint(task);
  const constraints = [...(task.constraints ?? []), ...(site ? [site] : []), ...(fresh ? [fresh] : [])];
  return {
    to: "judges",
    constraints,
    prompt: `RUN DATE: ${runDate}\nREQUEST: ${task.request}\n\nCONSTRAINTS:\n${constraints.map((c, i) => `${i + 1}. ${c}`).join("\n")}\n\nDOCUMENTS:\n${bundle}`,
  };
}

export async function gradeTask(input: {
  task: Task;
  docs: BundleDoc[];
  onSite: boolean;
  runDate: string; // YYYY-MM-DD
  reference?: ReferenceCapture;
}): Promise<Grade> {
  const { task, docs, onSite, runDate, reference } = input;
  if (docs.length === 0) return { score: 0, pass: false, detail: "no content returned" };
  const pages = formatBundle(docs);
  const built = buildPrompt(task, runDate, pages);

  try {
    if (task.tier === "stable-read" || task.tier === "stable-lookup") {
      const reader = await cachedReader(built.prompt);
      const answers: string[] = Array.isArray(reader.answers) ? reader.answers.map(String) : [];
      const g = gradeFacts(task, answers, pages);
      return { ...g, pass: g.score >= PASS_SCORE, reader };
    }

    if (task.tier === "live-feed") {
      const ref = task.reference!;
      if (!reference || reference.error || reference.items.length === 0) {
        return { score: 0, pass: false, detail: "no reference captured", error: `reference: ${reference?.error ?? "missing"}` };
      }
      const reader = await cachedReader(built.prompt);
      // A site task's answer must be on that site's pages, not on a mirror fetched alongside.
      const evidence = task.site ? formatBundle(docs.filter((d) => hostMatches(d.url, task.site!))) : pages;
      const grade = (text: string) =>
        ref.kind === "overlap"
          ? gradeOverlap(Array.isArray(reader.items) ? reader.items.map(String) : [], reference, text)
          : ref.kind === "latest"
            ? gradeLatest(String(reader.answer ?? ""), reference, text)
            : ref.kind === "scores"
              ? gradeScores(Array.isArray(reader.games) ? reader.games : [], reference, ref.minGames, text)
              : gradeNumeric(parseNumber(reader.answer), reference, ref.tolerance, text);
      const g = grade(evidence);
      // What the same answer would score off the mirrors: published, never scored.
      const offSite = task.site ? grade(pages).score : g.score;
      const gated = task.site ? onSite : true;
      return {
        ...g,
        pass: g.score >= PASS_SCORE && gated,
        reader,
        ...(offSite > g.score ? { offSiteScore: offSite } : {}),
        detail: gated ? g.detail : `${g.detail}; not from ${task.site}`,
      };
    }

    // live-judge
    if (built.to !== "judges") throw new Error("unreachable");
    const list = built.constraints;
    const fresh = freshnessConstraint(task, runDate);
    const verdicts = await judgeConstraints(TASK_CONSTRAINTS_RUBRIC, built.prompt, list.length);
    const clean = verdicts.filter((v) => !v.error);
    if (clean.length === 0) {
      return { score: 0, pass: false, detail: "all judges errored", verdicts, error: verdicts.map((v) => v.error).join("; ") };
    }
    const constraints = list.map((text, i) => ({
      text,
      value: clean.reduce((s, v) => s + (v.met[i] ? 1 : 0), 0) / clean.length,
    }));
    const score = ((onSite ? 1 : 0) + constraints.reduce((s, c) => s + c.value, 0)) / (1 + constraints.length);
    const freshOk = !fresh || constraints[constraints.length - 1].value === 1;
    // Averaging let a failed core check ride on the others (an Airbnb over
    // budget passed at 4/5), so every constraint must have judge support.
    const allMet = constraints.every((c) => c.value >= 0.5);
    return {
      score,
      pass: onSite && freshOk && allMet && score >= PASS_SCORE,
      constraints,
      verdicts,
      detail: [`${onSite ? "✓" : "✗"} on ${task.site}`, ...constraints.map((c) => `${c.value === 1 ? "✓" : c.value > 0 ? "~" : "✗"} ${c.text}`)].join(" | "),
    };
  } catch (e) {
    return { score: 0, pass: false, detail: "grading failed", error: e instanceof Error ? e.message.slice(0, 200) : String(e) };
  }
}

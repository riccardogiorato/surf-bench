import fs from "fs";
import path from "path";
import { NON_SCORING, classifyError, type ErrorClass } from "../src/lib/errorClass.js";
import { MIN_COVERAGE } from "../src/lib/scoring.js";

// Integrity audit for a results set.
//
// A benchmark is only as credible as its worst unexamined assumption, so this
// prints the things that would make a published leaderboard misleading, and
// exits non-zero when any of them are present. Run it before trusting
// results/summary.json or shipping a chart.
//
// It is deliberately adversarial about this repo's own numbers: the checks
// exist because each one has a matching real failure found in a baseline run.

const RAW_DIR = path.join("results", "raw");

type Rec = Record<string, any>;

function read(name: string, key: (r: Rec) => string): Rec[] {
  const file = path.join(RAW_DIR, `${name}.jsonl`);
  if (!fs.existsSync(file)) return [];
  const latest = new Map<string, Rec>();
  for (const line of fs.readFileSync(file, "utf8").trim().split("\n").filter(Boolean)) {
    const rec = JSON.parse(line);
    latest.set(key(rec), rec);
  }
  return [...latest.values()];
}

function mean(v: number[]): number {
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}

const problems: string[] = [];
const warnings: string[] = [];

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

const scrape = read("scrape", (r) => `${r.provider}|${r.site}`);
const search = read("search", (r) => `${r.provider}|${r.dim}|${r.query}`);
const quest = read("quest", (r) => `${r.provider}|${r.questId}`);

// ---------- 1. coverage: did every provider get a fair run? ----------
// A dead billing key returns an error on every case. Scored naively that is a
// perfect zero, which reads as a quality verdict and is really an account bug.
section("coverage (excluded = quota / rate-limit, never a quality signal)");
for (const [event, recs] of [["scrape", scrape], ["search", search], ["quest", quest]] as const) {
  const byProvider = new Map<string, { total: number; excluded: number; classes: Map<string, number> }>();
  for (const r of recs) {
    const p = String(r.provider);
    if (!byProvider.has(p)) byProvider.set(p, { total: 0, excluded: 0, classes: new Map() });
    const agg = byProvider.get(p)!;
    agg.total++;
    // Same fallback as the report: records captured before the taxonomy
    // existed carry only error text, and must still be classified or a dead
    // key from an older run audits as a clean 100%.
    const cls = (r.errorClass as ErrorClass | null) ??
      classifyError(r.error ?? r.reason ?? null);
    if (cls) agg.classes.set(cls, (agg.classes.get(cls) ?? 0) + 1);
    if (cls && NON_SCORING.has(cls)) agg.excluded++;
  }
  for (const [p, agg] of [...byProvider].sort()) {
    const coverage = agg.total ? (agg.total - agg.excluded) / agg.total : 0;
    const classes = [...agg.classes].map(([c, n]) => `${c}:${n}`).join(" ") || "-";
    const flag = coverage < MIN_COVERAGE ? "  <-- NOT SCORABLE" : "";
    console.log(
      `${event.padEnd(7)} ${p.padEnd(12)} ${agg.total - agg.excluded}/${agg.total} scorable (${Math.round(coverage * 100)}%)  [${classes}]${flag}`,
    );
    if (coverage < MIN_COVERAGE) {
      problems.push(
        `${event}/${p}: only ${Math.round(coverage * 100)}% of cases scorable — must publish as "no data", not as a low score`,
      );
    }
  }
}

// ---------- 2. judge health ----------
// Checks the panel itself: error rate, disagreement, and per-judge bias. The
// last one is the defence against "one judge preferred vendor X": if a single
// model is carrying a provider's score, that is visible here.
section("judge panel health");
const allVerdicts: Array<{ provider: string; judge: string; score: number; rationale: string }> = [];
for (const r of [...search, ...quest, ...scrape]) {
  const verdicts = r.judgeVerdicts;
  if (!Array.isArray(verdicts)) continue;
  for (const v of verdicts) {
    if (typeof v?.score !== "number") continue;
    allVerdicts.push({ provider: String(r.provider), judge: String(v.judge), score: v.score, rationale: String(v.rationale ?? "") });
  }
}
if (allVerdicts.length === 0) {
  warnings.push("no judge verdicts found — quality axis is unpopulated, scores will read n/a");
  console.log("no verdicts recorded yet");
} else {
  const judges = [...new Set(allVerdicts.map((v) => v.judge))].sort();
  const errors = allVerdicts.filter((v) => v.rationale.startsWith("judge error"));
  console.log(`verdicts: ${allVerdicts.length}, judges: ${judges.join(", ")}, judge-errors: ${errors.length}`);
  if (errors.length) {
    problems.push(`${errors.length} judge-error verdicts present — re-run the judge pass before publishing`);
  }

  console.log("\nper-judge mean by provider (watch for one judge carrying a provider):");
  const providers = [...new Set(allVerdicts.map((v) => v.provider))].sort();
  console.log("provider      " + judges.map((j) => j.padStart(12)).join("") + "     spread");
  for (const p of providers) {
    const means = judges.map((j) =>
      mean(allVerdicts.filter((v) => v.provider === p && v.judge === j).map((v) => v.score)),
    );
    const present = means.filter((m) => m > 0);
    const spread = present.length > 1 ? Math.max(...present) - Math.min(...present) : 0;
    console.log(
      p.padEnd(13) + means.map((m) => (m ? m.toFixed(2) : "-").padStart(12)).join("") + `     ${spread.toFixed(2)}`,
    );
    if (spread > 2) {
      warnings.push(`${p}: judges disagree by ${spread.toFixed(1)} points on average — single-judge bias risk`);
    }
  }

  const flaggedCount = [...search, ...quest, ...scrape].filter((r) => r.judgeFlagged).length;
  console.log(`\ncases where judges differed by >2 points: ${flaggedCount}`);
}

// ---------- 3. deterministic cross-check ----------
// substanceScore is model-free; judgeScore is not. Where they disagree sharply
// one of them is wrong, and those cases are worth a human look before anyone
// cites the number.
section("deterministic vs judge cross-check (scrape)");
const bothScored = scrape.filter(
  (r) => typeof r.substanceScore === "number" && typeof r.judgeScore === "number",
);
if (bothScored.length === 0) {
  console.log("no scrape records with both scores — run `bun run judge:scrape`");
} else {
  const disagreements = bothScored
    .map((r) => ({ r, gap: Math.abs(r.substanceScore - r.judgeScore) }))
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 10);
  console.log(`records with both scores: ${bothScored.length}`);
  for (const { r, gap } of disagreements) {
    if (gap < 4) continue;
    console.log(
      `  gap ${gap.toFixed(1)}  ${String(r.provider).padEnd(10)} substance=${r.substanceScore} judge=${r.judgeScore}  ${r.site}`,
    );
  }
}

// ---------- 4. structural sanity ----------
section("structural sanity");
const answerability = search.filter((r) => r.dim === "answerability");
if (answerability.length === 0) {
  warnings.push("no answerability records — the search quality axis is not populated");
  console.log("no answerability records found");
} else {
  const byProvider = new Map<string, Rec[]>();
  for (const r of answerability) {
    (byProvider.get(String(r.provider)) ?? byProvider.set(String(r.provider), []).get(String(r.provider))!).push(r);
  }
  console.log("provider      cases  judged  snippetCov  uniqDomains  dupRate");
  for (const [p, recs] of [...byProvider].sort()) {
    const judged = recs.filter((r) => typeof r.judgeScore === "number").length;
    console.log(
      `${p.padEnd(13)} ${String(recs.length).padStart(5)}  ${String(judged).padStart(6)}  ` +
        `${mean(recs.map((r) => r.snippetCoverage ?? 0)).toFixed(2).padStart(10)}  ` +
        `${mean(recs.map((r) => r.uniqueDomains ?? 0)).toFixed(1).padStart(11)}  ` +
        `${mean(recs.map((r) => r.duplicateUrlRate ?? 0)).toFixed(2).padStart(7)}`,
    );
  }
}

// ---------- verdict ----------
section("audit verdict");
for (const w of warnings) console.log(`WARN   ${w}`);
for (const p of problems) console.log(`BLOCK  ${p}`);
if (!problems.length && !warnings.length) {
  console.log("clean — results are safe to publish");
}
if (problems.length) {
  console.log(`\n${problems.length} blocking issue(s): this results set must not be published as a ranking.`);
  process.exit(1);
}

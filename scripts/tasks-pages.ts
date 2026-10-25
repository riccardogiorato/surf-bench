import fs from "fs/promises";
import path from "path";
import { JUDGE_MODELS } from "../src/lib/judge/judge.js";
import { READER_SYSTEM, TASK_CONSTRAINTS_RUBRIC } from "../src/lib/judge/rubrics.js";
import { PRICES } from "../src/lib/pricing.js";
import { MIN_COVERAGE, SPEED_FLOOR, TRACK_WEIGHTS, WEIGHTS } from "../src/lib/scoring.js";
import { DOC_CHARS, PASS_SCORE, READER_MODEL, buildPrompt } from "../src/lib/taskGrading.js";
import { FETCH_PROVIDER, SEARCH_CONTENT } from "../src/lib/searchClients.js";
import { LIVE_ROUNDS, TASKS, TRACKS, siteHosts, trackOf, type Task } from "../src/lib/tasks.js";
import { providerLabel as L } from "./favicons.js";
import { GRADE_STAMP } from "./tasks-grade.js";

// Two audit pages per run package, both built from published files plus the
// code itself (never results/raw):
//   inspect.html      every provider × task cell: search results, fetches,
//                     reader answer or judge verdicts, excerpt, why it passed
//   methodology.html  every prompt and rubric verbatim (from buildPrompt, the
//                     function grading calls), every answer key, scoring rules

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// JSON inside <script>: a "</script>" in a scraped excerpt must not close the tag.
const scriptJson = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");

const STYLE = `
  :root { --bg:#008080; --win:#c0c0c0; --hi:#fff; --lo:#808080; --dk:#000; --title:#000080; --ok:#2e8b57; --mid:#c9a227; --low:#d2691e; --no:#a33; }
  * { box-sizing:border-box }
  body { margin:0; padding:24px; background:var(--bg); font:14px/1.45 "IBM Plex Sans",system-ui,sans-serif; color:#111 }
  .win { background:var(--win); border:2px solid; border-color:var(--hi) var(--dk) var(--dk) var(--hi); box-shadow:inset -1px -1px var(--lo), inset 1px 1px #dfdfdf; max-width:1280px; margin:0 auto 20px }
  .bar-title { background:linear-gradient(90deg,var(--title),#1084d0); color:#fff; padding:4px 8px; font:12px Silkscreen,monospace; letter-spacing:.5px; display:flex; justify-content:space-between }
  .body { padding:14px 18px }
  h1 { font:22px Silkscreen,monospace; margin:0 0 4px }
  h2 { font:15px Silkscreen,monospace; margin:16px 0 8px }
  h3 { font:13px Silkscreen,monospace; margin:12px 0 6px; color:var(--title) }
  .sub { color:#333; margin:0 0 10px }
  .banner { background:#ffffe1; border:1px solid #000; padding:6px 10px; margin:8px 0; font-weight:600 }
  table { border-collapse:collapse; width:100%; background:#fff; border:2px solid; border-color:var(--lo) var(--hi) var(--hi) var(--lo) }
  th, td { padding:4px 7px; text-align:left; border-bottom:1px solid #ddd; vertical-align:top }
  th { background:#e4e4e4; font:11px Silkscreen,monospace; position:sticky; top:0; z-index:1 }
  td.n { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap }
  td.h { text-align:center; font-variant-numeric:tabular-nums; color:#fff; font-weight:600; cursor:pointer; white-space:nowrap }
  td.h:hover { outline:2px solid #000; outline-offset:-2px }
  td.ok { background:var(--ok) } td.mid { background:var(--mid) } td.low { background:var(--low) } td.no { background:var(--no) } td.na { background:#bbb }
  td.sel { outline:3px solid #ff0; outline-offset:-3px }
  pre { background:#fff; border:2px solid; border-color:var(--lo) var(--hi) var(--hi) var(--lo); padding:8px; white-space:pre-wrap; word-break:break-word; font:12px/1.4 ui-monospace,Menlo,monospace; max-height:420px; overflow:auto; margin:4px 0 }
  .pane { background:#fff; border:2px solid; border-color:var(--lo) var(--hi) var(--hi) var(--lo); padding:10px 12px; margin-top:12px }
  .round { border-top:2px dashed #999; margin-top:12px; padding-top:8px }
  .tag { font:11px Silkscreen,monospace; padding:1px 5px; border:1px solid #000; background:#ffffe1; margin-right:4px }
  .pass { color:var(--ok); font-weight:600 } .fail { color:var(--no); font-weight:600 }
  .scroll { overflow-x:auto } .mono { font-family:ui-monospace,Menlo,monospace; font-size:12px }
  ul { margin:4px 0 0 18px; padding:0 } li { margin:2px 0 }
  a { color:var(--title) }
  details { margin:6px 0 } summary { cursor:pointer; font-weight:600 }
  .task { border-top:1px solid #bbb; padding:8px 0 }
`;

function page(title: string, bar: string, body: string, script = ""): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Silkscreen&family=IBM+Plex+Sans:wght@400;600&display=swap" rel="stylesheet">
<style>${STYLE}</style></head><body>
<div class="win"><div class="bar-title"><span>${esc(bar)}</span><span>${esc(title)}</span></div><div class="body">
${body}
</div></div>
${script}
</body></html>
`;
}

function readCsv(text: string): Record<string, string>[] {
  const [head, ...rows] = text.trim().split("\n").map((l) => l.split(","));
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

// ---------- methodology ----------

const DOCS_PLACEHOLDER = `--- DOCUMENT 1 — SOURCE URL: <url of the 1st fetched page>
PAGE TITLE: <only when the provider returned the title as metadata>
<page content as returned by the provider, first ${DOC_CHARS.toLocaleString("en-US")} characters>

--- DOCUMENT 2 — SOURCE URL: <url of the 2nd fetched page>
<…>

--- DOCUMENT 3 — SOURCE URL: <url of the 3rd fetched page>
<…>`;

function grading(task: Task): string {
  if (task.facts) {
    return `<p>The reader answers each question; each answer is matched against its regex. Score = share of facts matched (partial credit). Pass at ≥ ${PASS_SCORE}.</p>
<table><thead><tr><th>question sent to the reader</th><th>accepted answer (regex)</th></tr></thead><tbody>
${task.facts.map((f) => `<tr><td>${esc(f.q)}</td><td class="mono">/${esc(f.pattern.source)}/${esc(f.pattern.flags)}</td></tr>`).join("")}
</tbody></table>`;
  }
  if (task.reference) {
    const r = task.reference;
    const src = r.source;
    const source =
      src.type === "rss" ? [src.url, ...(src.also ?? [])].map((u) => `<a href="${esc(u)}">${esc(u)}</a>`).join(" + ")
      : src.type === "hn" ? "Hacker News Firebase API (topstories)"
      : src.type === "github-releases" ? `GitHub releases API for ${esc(src.repo)} (version tags only)`
      : src.type === "node-lts" ? "https://nodejs.org/dist/index.json (newest LTS)"
      : src.type === "wikipedia-featured" ? "Wikimedia featured-content API (today's featured article)"
      : src.type === "espn-scoreboard" ? `ESPN's public scoreboard API (<a href="https://site.api.espn.com/apis/site/v2/sports/basketball/${src.league}/scoreboard">${src.league.toUpperCase()}</a>), every final of the most recent US game day before the round`
      : `FRED series ${esc(src.series)}`;
    const how =
      r.kind === "overlap" ? `The reader lists 5 items; score = matched / 5, where an item matches if it is the same headline as any of the reference's top ${r.pool} (token overlap or containment).`
      : r.kind === "latest" ? "The reader names one item. Score 1 if it is the newest reference item (or another item the source marks as also current), 0.5 for one of the two before it or the same major version, else 0."
      : r.kind === "scores" ? `The reader lists the games and final scores the documents show. A game counts when both teams and both scores match an official final of that game day and the pages show them; score = counted games / ${r.minGames}, capped at 1. Scores from an older game day count for nothing.`
      : `The reader gives one number. Score 1 within ±${(r.tolerance * 100).toFixed(2)}% of the latest value, 0.5 for the previous value, else 0.`;
    const when = r.kind === "scores" ? "for the round's date (finals never change, so the capture time does not matter)" : "in the same round, minutes before the providers run";
    return `<p><b>Ground truth</b> captured ${when}, from: ${source}.</p><p>${how} ${task.site ? `Only what the pages fetched from ${esc(siteHosts(task.site).join(" / "))} show counts; the same answer read off a mirror or aggregator fetched alongside earns nothing. ` : ""}Pass at ≥ ${PASS_SCORE}${task.site ? `, and at least one fetched page must be on the site` : ""}.</p>`;
  }
  return `<p>No answer key can exist. Both judges answer every constraint yes/no from the documents (prompt below). A constraint's value = share of judges that said yes. Score = (on-site + sum of constraint values) / (1 + constraints). <b>Pass</b> needs: a fetched page on ${esc(siteHosts(task.site!).join(" / "))}, every constraint supported by at least one judge, the freshness constraint (if any) supported by both, and score ≥ ${PASS_SCORE}.</p>`;
}

function methodology(runId: string, manifest: any): string {
  const stale = manifest.gradeStamp !== GRADE_STAMP;
  const pipeline = manifest.pipeline ?? {};
  const tiers = ["stable-read", "stable-lookup", "live-feed", "live-judge"] as const;
  const body = `
<h1>Methodology</h1>
<p class="sub">Generated from the code that grades the benchmark: every prompt below is produced by <span class="mono">buildPrompt()</span> in <span class="mono">src/lib/taskGrading.ts</span>, the same function <span class="mono">tasks:grade</span> calls. Run <b>${esc(runId)}</b> · commit <span class="mono">${esc(manifest.commit)}</span> · grade stamp <span class="mono">${esc(manifest.gradeStamp)}</span>.</p>
${stale ? `<div class="banner">The code has changed since this run was graded (current stamp ${esc(GRADE_STAMP)}). Re-run tasks:grade before trusting this page.</div>` : `<p class="sub">The grade stamp hashes the reader model, both prompts and every task's answer contract, so it matching the run proves the tasks below are exactly the ones this run was graded against.</p>`}

<h2>Pipeline</h2>
<ul>
  <li>The task's request is sent <b>verbatim</b> to the provider's search API (no rewriting, no <span class="mono">site:</span> filters), asking for ${esc(pipeline.searchResults ?? 5)} results.</li>
  <li>The provider's own fetch API retrieves the top ${esc(pipeline.fetchTop ?? 3)} results as ranked. stable-read tasks skip search and fetch the given URL.</li>
  <li>Each leg has a ${((pipeline.legTimeoutMs ?? 30000) / 1000).toFixed(0)}-second limit; going over is a DNF. Rate-limited calls are retried twice with backoff; survivors are excluded from scoring, never scored as 0.</li>
  <li>Fast modes are separate rows: ${Object.entries(FETCH_PROVIDER).map(([fast, parent]) => `<span class="mono">${esc(fast)}</span> searches in its fast mode and fetches with <span class="mono">${esc(parent)}</span>`).join("; ")}.</li>
  <li>${[...SEARCH_CONTENT].map((p) => `<span class="mono">${esc(p)}</span>`).join(" and ")} have no fetch API: their search returns each page's extracted text, and the top 3 results' text is their fetch leg (fetch time 0, no fetch cost). On stable-read tasks they search for the given URL.</li>
  <li>Reader: <span class="mono">${esc(READER_MODEL)}</span>, temperature 0, sees each fetched page up to ${DOC_CHARS.toLocaleString("en-US")} characters. Judges: ${JUDGE_MODELS.map((m) => `<span class="mono">${esc(m)}</span>`).join(" and ")}, temperature 0. Neither ever sees the provider's name.</li>
  <li>Answers must come from the pages. A reader answer that matches the key but is not in the documents it was given (the reader knew it by heart) earns nothing: the part the key matched has to appear in the pages, numbers as their own number (thousands separators, markdown escapes and million→billion conversions allowed) and text after normalization. The same check applies to feed headlines, latest versions and live numbers.</li>
  <li>Live tasks (live-feed, live-judge) run ${LIVE_ROUNDS} rounds; a task's score and pass are averaged over its rounds.</li>
</ul>

<h2>Scoring</h2>
<ul>
  <li>Two tracks: <b>search</b> (${TASKS.filter((t) => trackOf(t) === "search").length} tasks: find the answer on the open web) and <b>access</b> (${TASKS.filter((t) => trackOf(t) === "access").length} tasks: open a given page, or reach a named bot-walled site such as X, Instagram, Amazon or Zillow). <b>Overall = ${TRACK_WEIGHTS.search} × search + ${TRACK_WEIGHTS.access} × access.</b> The weights were fixed before the run.</li>
  <li>Each track's score: <b>quality</b> (${WEIGHTS.quality}) = mean task score × 100; <b>reliability</b> (${WEIGHTS.reliability}) = share of tasks passed; <b>speed</b> (${WEIGHTS.speed}) = the fastest row's end-to-end median in that track ÷ this row's, floored at ${SPEED_FLOOR * 100}.</li>
  <li>A provider needs ≥ ${MIN_COVERAGE * 100}% of each track's tasks scorable (not quota / rate-limited) to get a number.</li>
  <li>95% confidence intervals from a paired bootstrap over tasks, resampled within each track; providers whose gap to a group's leader has an interval including 0 share its tie group.</li>
  <li>Cost is published, never scored: list price × the calls each provider actually made, per 1,000 passed tasks. Reader and judge calls are excluded.</li>
</ul>

<h2>System prompts (verbatim)</h2>
<h3>Reader system message</h3><pre>${esc(READER_SYSTEM)}</pre>
<h3>Judge system message (live-judge rubric)</h3><pre>${esc(TASK_CONSTRAINTS_RUBRIC)}</pre>

<h2>Prices used for the cost column</h2>
<table><thead><tr><th>provider</th><th>search</th><th>fetch</th><th>source</th><th>read</th><th>note</th></tr></thead><tbody>
${Object.entries(PRICES).map(([p, e]) => `<tr><td><b>${esc(p)}</b></td><td class="n">$${(e.searchUsd * 1000).toFixed(2)} / 1k</td><td class="n">$${(e.fetchUsd("https://example.com/") * 1000).toFixed(2)} / 1k</td><td><a href="${esc(e.source)}">${esc(e.source)}</a></td><td>${esc(e.asOf)}</td><td>${esc(e.note ?? "")}</td></tr>`).join("")}
</tbody></table>

<h2>The ${TASKS.length} tasks</h2>
<p class="sub">Each task: the request, how it is graded, the exact prompt (with the run date and documents left as placeholders), and the verification record for its key.</p>
${TRACKS.flatMap((track) => tiers.map((tier) => [track, tier] as const)).map(([track, tier]) => {
  const ts = TASKS.filter((t) => t.tier === tier && trackOf(t) === track);
  if (!ts.length) return "";
  return `<h2>${esc(track)} · ${esc(tier)} · ${ts.length}</h2>${ts.map((t) => {
    const built = buildPrompt(t, "<RUN DATE, YYYY-MM-DD>", DOCS_PLACEHOLDER);
    return `<div class="task" id="${esc(t.id)}">
  <div><span class="tag">${esc(t.id)}</span><b>${esc(t.request)}</b></div>
  <div class="sub">${t.site ? `site ${esc(t.site)} · ` : ""}${t.url ? `url <a href="${esc(t.url)}">${esc(t.url)}</a> · ` : ""}${t.freshDays ? `fresh within ${t.freshDays} days · ` : ""}category ${esc(t.category)}${t.lang ? ` · lang ${esc(t.lang)}` : ""}</div>
  ${grading(t)}
  <details><summary>Exact prompt sent to the ${built.to === "reader" ? "reader" : "judges"}</summary><pre>${esc(built.prompt)}</pre></details>
  <details><summary>Verification: ${esc(t.verified.by)} · ${esc(t.verified.at)}</summary><ul>${t.verified.evidence.map((e) => `<li>${/^https?:/.test(e) ? `<a href="${esc(e)}">${esc(e)}</a>` : esc(e)}</li>`).join("")}</ul></details>
</div>`;
  }).join("")}`;
}).join("")}
`;
  return page(`SurfBench methodology — ${runId}`, "METHODOLOGY.TXT", body);
}

// ---------- inspector ----------

function inspector(runId: string, evidence: any[], board: Record<string, string>[], refs: any[]): string {
  const providers = board.map((b) => b.provider);
  const cells = new Map<string, any[]>();
  for (const e of evidence) {
    const k = `${e.provider}|${e.taskId}`;
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k)!.push(e);
  }
  for (const list of cells.values()) list.sort((a, b) => a.round - b.round);

  const cell = (p: string, t: Task) => {
    const rs = cells.get(`${p}|${t.id}`) ?? [];
    if (!rs.length) return `<td class="h na">–</td>`;
    const mean = rs.reduce((s, r) => s + r.score, 0) / rs.length;
    const passed = rs.filter((r) => r.pass).length;
    const cls = passed === rs.length ? "ok" : passed > 0 ? "mid" : mean > 0 ? "low" : "no";
    return `<td class="h ${cls}" data-p="${esc(p)}" data-t="${esc(t.id)}" title="mean score ${mean.toFixed(2)}">${passed}/${rs.length}</td>`;
  };

  const tasks = TASKS.map((t) => ({
    id: t.id, tier: t.tier, track: trackOf(t), request: t.request, site: t.site ?? null, url: t.url ?? null,
    facts: t.facts?.map((f) => ({ q: f.q, re: `/${f.pattern.source}/${f.pattern.flags}` })) ?? null,
    constraints: t.constraints ?? null,
  }));
  const data = {
    tasks,
    cells: Object.fromEntries(cells),
    refs: Object.fromEntries(refs.map((r) => [`${r.round}|${r.taskId}`, { items: r.items, error: r.error ?? null, capturedAt: r.capturedAt }])),
  };

  const body = `
<h1>Task inspector</h1>
<p class="sub">Run <b>${esc(runId)}</b>. Each cell shows rounds passed / rounds run for one provider on one task. Click a cell to see exactly what happened: the search results, which pages were fetched and how big they were, what the reader answered or what each judge decided (with the evidence it quoted), the opening of the first fetched page, and why it passed or failed. Full prompts and answer keys: <a href="methodology.html">methodology.html</a>.</p>
<div class="scroll"><table><thead><tr><th>task</th><th>request</th>${providers.map((p) => `<th>${esc(L(p))}</th>`).join("")}</tr></thead><tbody>
${TRACKS.flatMap((track) => [`<tr><th colspan="${providers.length + 2}">${esc(track)} track · ${Math.round(TRACK_WEIGHTS[track] * 100)}% of overall</th></tr>`, ...TASKS.filter((t) => trackOf(t) === track).map((t) => `<tr><td class="mono"><a href="methodology.html#${esc(t.id)}">${esc(t.id)}</a></td><td>${esc(t.request.length > 70 ? t.request.slice(0, 68) + "…" : t.request)}</td>${providers.map((p) => cell(p, t)).join("")}</tr>`)]).join("")}
</tbody></table></div>
<div id="detail" class="pane">Click a cell above.</div>`;

  const script = `<script>
const D = ${scriptJson(data)};
const esc = (s) => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const link = (u) => '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(u) + '</a>';
function show(p, id) {
  const t = D.tasks.find((x) => x.id === id);
  const rs = D.cells[p + "|" + id] || [];
  let h = '<h2>' + esc(p) + ' · ' + esc(id) + '</h2><p><b>' + esc(t.request) + '</b></p><p class="sub">' + t.track + ' track · tier ' + t.tier + (t.site ? ' · site ' + esc(t.site) : '') + (t.url ? ' · url ' + link(t.url) : '') + '</p>';
  if (t.facts) h += '<h3>Answer key</h3><ul>' + t.facts.map((f) => '<li>' + esc(f.q) + ' → <span class="mono">' + esc(f.re) + '</span></li>').join('') + '</ul>';
  for (const r of rs) {
    h += '<div class="round"><h3>Round ' + r.round + ' · <span class="' + (r.pass ? 'pass">PASS' : 'fail">FAIL') + '</span> · score ' + r.score.toFixed(2) + ' · ' + (r.totalMs/1000).toFixed(1) + 's · $' + (r.costUsd ?? 0).toFixed(4) + '</h3>';
    h += '<p><b>Verdict:</b> ' + esc(r.detail) + (r.error ? ' <span class="fail">(' + esc(r.errorClass) + ': ' + esc(r.error) + ')</span>' : '') + '</p>';
    if (r.searchResults) h += '<b>Search results (top 5, as ranked)</b><ol>' + r.searchResults.map((u) => '<li>' + link(u) + '</li>').join('') + '</ol>';
    h += '<b>Fetched</b><ul>' + (r.fetched || []).map((f) => '<li>' + link(f.url) + ' — ' + (f.chars ? f.chars.toLocaleString() + ' chars' : '<span class="fail">' + esc(f.error || 'empty') + '</span>') + ', ' + f.ms + 'ms</li>').join('') + '</ul>';
    const ref = D.refs[r.round + '|' + id];
    if (ref) h += '<details><summary>Reference captured ' + esc(ref.capturedAt) + ' (ground truth)</summary>' + (ref.error ? '<p class="fail">' + esc(ref.error) + '</p>' : '<ol>' + ref.items.slice(0, 15).map((x) => '<li>' + esc(x) + '</li>').join('') + '</ol>') + '</details>';
    if (r.reader) h += '<b>Reader answer</b><pre>' + esc(JSON.stringify(r.reader, null, 1)) + '</pre>';
    if (r.constraints) {
      h += '<b>Constraints</b><table><thead><tr><th>constraint</th><th>value</th>' + (r.judgeEvidence || []).map((j) => '<th>' + esc(j.judge) + '</th>').join('') + '</tr></thead><tbody>';
      r.constraints.forEach((c, i) => {
        h += '<tr><td>' + esc(c.text) + '</td><td class="n">' + c.value + '</td>' + (r.judgeEvidence || []).map((j) => '<td>' + (j.error ? '<span class="fail">' + esc(j.error) + '</span>' : (j.met[i] ? '✓ ' : '✗ ') + esc(j.evidence[i])) + '</td>').join('') + '</tr>';
      });
      h += '</tbody></table>';
    }
    if (r.excerpt) h += '<details><summary>Excerpt of the first fetched page (redacted)</summary><pre>' + esc(r.excerpt) + '</pre></details>';
    h += '</div>';
  }
  const el = document.getElementById('detail');
  el.innerHTML = h;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
document.querySelectorAll('td[data-p]').forEach((td) => td.addEventListener('click', () => {
  document.querySelectorAll('td.sel').forEach((x) => x.classList.remove('sel'));
  td.classList.add('sel');
  show(td.dataset.p, td.dataset.t);
  history.replaceState(null, '', '#' + td.dataset.p + '/' + td.dataset.t);
}));
const m = location.hash.slice(1).split('/');
if (m.length === 2 && D.cells[m[0] + '|' + m[1]]) show(m[0], m[1]);
</script>`;
  return page(`SurfBench inspector — ${runId}`, "INSPECT.EXE", body, script);
}

async function main() {
  const latest = JSON.parse(await fs.readFile("results/v2-latest.json", "utf8"));
  const runId: string = arg("run") ?? latest.runId;
  const dir = path.join("results", "runs", runId);
  const manifest = JSON.parse(await fs.readFile(path.join(dir, "manifest.json"), "utf8"));
  const evidence: any[] = JSON.parse(await fs.readFile(path.join(dir, "evidence.json"), "utf8"));
  const board = readCsv(await fs.readFile(path.join(dir, "leaderboard.csv"), "utf8"));
  await fs.writeFile(path.join(dir, "methodology.html"), methodology(runId, manifest));
  await fs.writeFile(path.join(dir, "inspect.html"), inspector(runId, evidence, board, manifest.references ?? []));
  console.log(`wrote ${dir}/methodology.html, ${dir}/inspect.html`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

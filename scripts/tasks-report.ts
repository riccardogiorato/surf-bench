import fs from "fs/promises";
import path from "path";
import { execSync } from "child_process";
import { NON_SCORING, classifyError, type ErrorClass } from "../src/lib/errorClass.js";
import { READER_ID, TASK_RUBRIC_ID } from "../src/lib/judge/rubrics.js";
import { PRICES } from "../src/lib/pricing.js";
import { PASS_SCORE, READER_MODEL } from "../src/lib/taskGrading.js";
import { TRACK_WEIGHTS, WEIGHTS } from "../src/lib/scoring.js";
import { scoreProviders, type RunOutcome } from "../src/lib/taskScoring.js";
import { AGENT_CHECK, AGENT_DRAFT, LIVE_ROUNDS, TASK_GROUPS, TASKS, TRACKS, groupOf, trackOf, type TaskTier, type Track } from "../src/lib/tasks.js";
import { GRADE_STAMP, gradeIsCurrent, onSite, readJsonl, runKey } from "./tasks-grade.js";

// Builds the v2 run package: results/runs/<runId>/ with the leaderboard
// (95% CIs + tie groups), the site × provider access matrix, per-tier
// sub-scores, cost, every task's evidence, and a manifest that pins
// everything needed to re-grade the snapshot.

const RAW = "results/raw";
const TASK_SET_VERSION = "tasks-v2.2";
const EXCERPT_CHARS = 600;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const fmt = (v: number | null | undefined, d = 1) => (v === null || v === undefined || Number.isNaN(v) ? "n/a" : v.toFixed(d));
const csv = (rows: (string | number | null)[][]) =>
  rows.map((r) => r.map((c) => (c === null ? "" : /[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c)).join(",")).join("\n") + "\n";

async function main() {
  const records = await readJsonl(`${RAW}/tasks.jsonl`);
  const runId = arg("run") ?? records[records.length - 1]?.runId;
  if (!runId) throw new Error("no runs recorded");
  const runs = new Map<string, any>();
  for (const r of records.filter((r) => r.runId === runId)) runs.set(runKey(r), r);
  const grades = new Map<string, any>();
  for (const g of await readJsonl(`${RAW}/tasks-graded.jsonl`)) if (g.runId === runId) grades.set(runKey(g), g);
  const refs = (await readJsonl(`${RAW}/tasks-refs.jsonl`)).filter((r) => r.runId === runId);

  const taskById = new Map(TASKS.map((t) => [t.id, t]));
  const runTaskIds = [...new Set([...runs.values()].map((r) => r.taskId))].filter((id) => taskById.has(id));
  const taskIds = TASKS.map((t) => t.id).filter((id) => runTaskIds.includes(id));

  let ungraded = 0;
  const outcomes: RunOutcome[] = [];
  const evidence: any[] = [];
  for (const r of runs.values()) {
    if (!taskById.has(r.taskId)) continue;
    const g = grades.get(runKey(r));
    const gradedOk = gradeIsCurrent(g, r);
    // Reclassified from stored data so taxonomy and alias fixes apply to old runs.
    r.errorClass = classifyError(r.error);
    r.onSite = taskById.get(r.taskId)!.site ? onSite(taskById.get(r.taskId)!, r) : null;
    const nonScoringError = !r.answered && r.errorClass && NON_SCORING.has(r.errorClass as ErrorClass);
    if (!gradedOk && !nonScoringError) ungraded++;
    outcomes.push({
      provider: r.provider,
      taskId: r.taskId,
      score: gradedOk ? g.score : 0,
      pass: gradedOk ? g.pass : false,
      totalMs: r.totalMs,
      answered: r.answered,
      // Ungraded is "no verdict yet", never a zero; the audit blocks on it.
      nonScoring: Boolean(nonScoringError || !gradedOk),
      costUsd: r.costUsd,
    });
    const first = (r.fetches ?? []).find((f: any) => f.chars > 0);
    evidence.push({
      provider: r.provider,
      taskId: r.taskId,
      round: r.round,
      startedAt: r.startedAt,
      score: gradedOk ? Number(g.score.toFixed(3)) : null,
      pass: gradedOk ? g.pass : null,
      detail: g?.detail ?? null,
      reader: g?.reader ?? null,
      constraints: g?.constraints ?? null,
      judgeEvidence: g?.verdicts?.map((v: any) => ({ judge: v.judge, met: v.met, evidence: v.evidence, error: v.error })) ?? null,
      onSite: r.onSite,
      siteInResults: r.siteInResults,
      searchResults: r.search?.results?.map((x: any) => x.url) ?? null,
      fetched: (r.fetches ?? []).map((f: any) => ({ url: f.url, chars: f.chars, ms: f.ms, error: f.error ?? null })),
      totalMs: r.totalMs,
      dnf: r.dnf,
      error: r.error,
      errorClass: r.errorClass,
      costUsd: r.costUsd,
      excerpt: first ? first.content.slice(0, EXCERPT_CHARS) : null,
    });
  }

  const trackDefs = TRACKS.map((name) => ({ name, weight: TRACK_WEIGHTS[name], taskIds: taskIds.filter((id) => trackOf(id) === name) }));
  const board = scoreProviders(outcomes, trackDefs);
  const tr = (b: (typeof board)[number], t: Track) => b.tracks[t]?.score ?? null;
  const providers = board.map((b) => b.provider);

  // Per-tier quality sub-scores (task-averaged, same rules as the main score).
  const tiers: TaskTier[] = ["stable-read", "stable-lookup", "live-feed", "live-judge"];
  const tierScore = (p: string, tier: TaskTier) => {
    const ids = taskIds.filter((id) => taskById.get(id)!.tier === tier);
    const per = ids
      .map((id) => outcomes.filter((o) => o.provider === p && o.taskId === id && !o.nonScoring))
      .filter((os) => os.length)
      .map((os) => os.reduce((s, o) => s + o.score, 0) / os.length);
    return per.length ? (per.reduce((a, b) => a + b, 0) / per.length) * 100 : null;
  };

  // Per task group, the same task-averaged quality and pass rate as the tracks.
  const groupRows = TASK_GROUPS.flatMap((g) => {
    const ids = taskIds.filter((id) => groupOf(id) === g.id);
    return providers.map((p) => {
      const per = ids
        .map((id) => outcomes.filter((o) => o.provider === p && o.taskId === id && !o.nonScoring))
        .filter((os) => os.length)
        .map((os) => ({ score: os.reduce((s, o) => s + o.score, 0) / os.length, pass: os.filter((o) => o.pass).length / os.length }));
      const mean = (f: (x: (typeof per)[number]) => number) => (per.length ? (per.reduce((s, x) => s + f(x), 0) / per.length) * 100 : null);
      return [g.id, g.label, ids.length, p, per.length, fmt(mean((x) => x.score)), fmt(mean((x) => x.pass))];
    });
  });

  // Access matrix: per target site, passes / attempts across its tasks and rounds.
  const sites = [...new Set(taskIds.map((id) => taskById.get(id)!.site).filter(Boolean))] as string[];
  const access = sites.map((site) => {
    const ids = taskIds.filter((id) => taskById.get(id)!.site === site);
    return {
      site,
      tasks: ids,
      cells: Object.fromEntries(
        providers.map((p) => {
          const os = outcomes.filter((o) => o.provider === p && ids.includes(o.taskId) && !o.nonScoring);
          return [p, { passed: os.filter((o) => o.pass).length, attempts: os.length }];
        }),
      ),
    };
  });

  const dir = path.join("results", "runs", runId);
  await fs.mkdir(dir, { recursive: true });

  const unverified = TASKS.filter((t) => t.verified.by === AGENT_DRAFT).map((t) => t.id);
  const agentChecked = TASKS.filter((t) => t.verified.by === AGENT_CHECK).map((t) => t.id);
  let commit = "unknown";
  try {
    commit = execSync("git rev-parse --short HEAD").toString().trim();
  } catch {}

  await fs.writeFile(
    path.join(dir, "manifest.json"),
    JSON.stringify(
      {
        runId,
        taskSet: TASK_SET_VERSION,
        commit,
        liveRounds: LIVE_ROUNDS,
        pipeline: { searchResults: 5, fetchTop: 3, legTimeoutMs: 30000, query: "request sent verbatim, no site filters" },
        reader: { model: READER_MODEL, promptId: READER_ID },
        judges: { models: ["moonshotai/Kimi-K3", "zai-org/GLM-5.3"], rubricId: TASK_RUBRIC_ID },
        gradeStamp: GRADE_STAMP,
        passScore: PASS_SCORE,
        tracks: trackDefs,
        pricing: Object.fromEntries(Object.entries(PRICES).map(([k, v]) => [k, { searchUsd: v.searchUsd, fetchUsd: v.fetchUsd("https://example.com/"), source: v.source, asOf: v.asOf, note: v.note ?? null }])),
        tasks: TASKS.filter((t) => taskIds.includes(t.id)).map((t) => ({ ...t, track: trackOf(t), facts: t.facts?.map((f) => ({ q: f.q, pattern: f.pattern.source })) })),
        references: refs,
        counts: { runs: runs.size, ungraded, unverifiedTasks: unverified.length, agentCheckedTasks: agentChecked.length },
      },
      null,
      2,
    ),
  );
  await fs.writeFile(path.join(dir, "evidence.json"), JSON.stringify(evidence, null, 1));
  await fs.writeFile(
    path.join(dir, "leaderboard.csv"),
    csv([
      ["rank_group", "provider", "overall", "ci_low", "ci_high", ...TRACKS.map((t) => `${t}_score`), "quality", "pass_rate", "p50_ms", "speed", "usd_per_1k_passed", "tasks_scored", "coverage", ...TRACKS.flatMap((t) => [`${t}_quality`, `${t}_pass_rate`, `${t}_p50_ms`]), ...tiers.map((t) => `quality_${t}`), "withheld"],
      ...board.map((b) => [b.group, b.provider, fmt(b.overall), fmt(b.ci?.[0]), fmt(b.ci?.[1]), ...TRACKS.map((t) => fmt(tr(b, t))), fmt(b.quality), fmt(b.reliability), Math.round(b.p50Ms), fmt(b.speed), fmt(b.usdPer1kPassed, 2), b.tasksScored, fmt(b.coverage, 2), ...TRACKS.flatMap((t) => [fmt(b.tracks[t]?.quality), fmt(b.tracks[t]?.reliability), Math.round(b.tracks[t]?.p50Ms ?? 0)]), ...tiers.map((t) => fmt(tierScore(b.provider, t))), b.withheld ?? null]),
    ]),
  );
  await fs.writeFile(
    path.join(dir, "groups.csv"),
    csv([["group", "label", "tasks", "provider", "tasks_scored", "quality", "pass_rate"], ...groupRows]),
  );
  await fs.writeFile(
    path.join(dir, "access.csv"),
    csv([["site", "tasks", ...providers], ...access.map((a) => [a.site, a.tasks.join(" "), ...providers.map((p) => `${a.cells[p].passed}/${a.cells[p].attempts}`)])]),
  );

  // ---------- REPORT.md ----------
  const lines: string[] = [];
  lines.push(`# SurfBench v2 — run ${runId}`, "");
  if (unverified.length) {
    lines.push(`> **DRAFT — not publishable.** ${unverified.length}/${TASKS.length} answer keys are agent drafts awaiting verification (\`bun run tasks:audit\`).`, "");
  }
  if (ungraded) lines.push(`> ${ungraded} runs have no valid grade yet and are excluded (re-run \`bun run tasks:grade\`).`, "");
  lines.push(
    `${taskIds.length} tasks · ${providers.length} providers · live tasks × ${LIVE_ROUNDS} rounds · fixed pipeline: search top 5 → fetch top 3 · reader \`${READER_MODEL}\` · judges Kimi K3 + GLM-5.3 (live-judge constraints only).`,
    "",
    "## Leaderboard",
    "",
    "Providers in the same **group** are statistically tied (the 95% paired-bootstrap CI of their gap includes 0).",
    "",
    `| group | provider | overall (95% CI) | search (${TRACK_WEIGHTS.search * 100}%) | access (${TRACK_WEIGHTS.access * 100}%) | quality | pass rate | p50 | $ / 1k passed tasks |`,
    "|---|---|---|---|---|---|---|---|---|",
  );
  for (const b of board) {
    lines.push(
      b.overall === null
        ? `| — | ${b.provider} | n/a (${b.withheld}) | | | | | | |`
        : `| ${b.group} | **${b.provider}** | ${fmt(b.overall)} (${fmt(b.ci![0])}–${fmt(b.ci![1])}) | ${fmt(tr(b, "search"))} | ${fmt(tr(b, "access"))} | ${fmt(b.quality)} | ${fmt(b.reliability)}% | ${(b.p50Ms / 1000).toFixed(1)}s | $${fmt(b.usdPer1kPassed, 2)} |`,
    );
  }
  lines.push("", "## Quality by tier", "", `| provider | ${tiers.join(" | ")} |`, `|---|${tiers.map(() => "---").join("|")}|`);
  for (const p of providers) lines.push(`| ${p} | ${tiers.map((t) => fmt(tierScore(p, t))).join(" | ")} |`);
  lines.push("", "## Access matrix", "", "Passed / attempts per target site, across its tasks and rounds.", "", `| site | ${providers.join(" | ")} |`, `|---|${providers.map(() => "---").join("|")}|`);
  for (const a of access) {
    lines.push(`| ${a.site} | ${providers.map((p) => { const c = a.cells[p]; return c.attempts ? `${c.passed === c.attempts ? "✓" : c.passed === 0 ? "✗" : "~"} ${c.passed}/${c.attempts}` : "—"; }).join(" | ")} |`);
  }
  lines.push(
    "",
    "## How to read this",
    "",
    `- **quality** = mean task score (0–100, partial credit); **pass rate** = share of tasks scoring ≥ ${PASS_SCORE * 100}% (live tasks must also come from the named site, and live-judge tasks must be fresh). Repeated rounds are averaged per task.`,
    `- **Tracks.** ${trackDefs.map((t) => `${t.name} (${t.taskIds.length} tasks)`).join(", ")}. Search = find the answer on the open web; access = open a given page or reach a named bot-walled site. Each track's score = ${WEIGHTS.quality} quality + ${WEIGHTS.reliability} pass rate + ${WEIGHTS.speed} speed (p50 vs. the fastest provider in that track, floored at 25).`,
    `- **overall** = ${TRACK_WEIGHTS.search} × search + ${TRACK_WEIGHTS.access} × access. quality and pass rate above are track-weighted the same way. A provider needs ≥ 80% of each track's tasks scorable to get a number.`,
    "- **$ / 1k passed tasks** = list-price spend for one pass over the task set ÷ tasks passed × 1000. Not part of the score. Prices and sources are in `manifest.json`.",
    "- **Live tasks are a snapshot.** Compare providers within this run, never across runs. live-judge tasks have no ground truth: the panel checks explicit constraints.",
    "- Every task's verdict, reader answer, judge evidence, source URLs and a redacted excerpt are in `evidence.json`.",
  );
  await fs.writeFile(path.join(dir, "REPORT.md"), lines.join("\n") + "\n");
  await fs.writeFile("results/v2-latest.json", JSON.stringify({ runId, dir, board }, null, 2));

  console.log(lines.slice(0, 40).join("\n"));
  console.log(`\nwrote ${dir}/ {REPORT.md, leaderboard.csv, groups.csv, access.csv, evidence.json, manifest.json}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

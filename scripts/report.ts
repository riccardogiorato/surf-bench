import fs from "fs";
import path from "path";
import { faviconDataUri } from "./favicons.js";
import { NON_SCORING, classifyError, type ErrorClass } from "../src/lib/errorClass.js";
import { SCRAPE_RUBRIC_ID } from "../src/lib/judge/rubrics.js";
import { ALL_TEST_SITES } from "../src/lib/testSites.js";
import {
  composite,
  quantile,
  scoreEvent,
  scrapePassed,
  speedScore,
  MIN_COVERAGE,
  WEIGHTS,
  type EventScore,
} from "../src/lib/scoring.js";

// Aggregates results/raw/{scrape,search,quest}.jsonl into
// results/{scrape,search,quest}.csv + results/summary.json + the scoreboard SVG.
// Records are deduped by their case key, keeping the latest.
//
// Scores follow src/lib/scoring.ts: three axes (quality / reliability / speed),
// cases that never got a fair answer are excluded, and an event without enough
// scored cases reports "insufficient data" instead of a zero.

const RAW_DIR = path.join("results", "raw");
const OUT_DIR = "results";

type Row = Record<string, string | number | boolean | null>;

function readJsonl(name: string): Row[] {
  const file = path.join(RAW_DIR, `${name}.jsonl`);
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, "utf8").trim().split("\n").filter(Boolean);
  const latest = new Map<string, Row>();
  for (const line of lines) {
    const rec = JSON.parse(line) as Row & { provider: string };
    const key = dedupeKey(name, rec);
    latest.set(key, rec);
  }
  return [...latest.values()];
}

function dedupeKey(event: string, rec: Row): string {
  if (event === "scrape") return `${rec.provider}|${rec.site}`;
  if (event === "search") return `${rec.provider}|${rec.dim}|${rec.query}`;
  return `${rec.provider}|${rec.questId}`;
}

// Records written before the error taxonomy existed have no errorClass, so
// fall back to classifying their stored error text. Without this, a run
// captured by an older harness silently scores a dead billing key as a zero.
function isNonScoringRec(rec: Row): boolean {
  const cls = (rec.errorClass as ErrorClass | null | undefined) ??
    classifyError(
      (rec.error as string | null) ?? (rec.reason as string | null) ?? null,
    );
  return cls != null && NON_SCORING.has(cls);
}

function fmtS(ms: number): string {
  return ms > 0 ? `${(ms / 1000).toFixed(1)}s` : "-";
}

function pct(v: number | null): string {
  return v === null ? "n/a" : `${Math.round(v)}%`;
}

function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

// Capability dims are the legacy substring/domain assertions. They are kept as
// diagnostics because they catch hard breakage cheaply, but they no longer
// feed the quality axis: a keyword in a URL never proved result quality.
const CAPABILITY_DIMS_EXCLUDED = new Set(["answerability"]);

interface ProviderEvent {
  total: number;
  nonScoring: number;
  passed: number;
  judgeScores: number[];
  times: number[];
  extra: Record<string, number[]>;
}

function emptyEvent(): ProviderEvent {
  return { total: 0, nonScoring: 0, passed: 0, judgeScores: [], times: [], extra: {} };
}

function push(agg: ProviderEvent, key: string, value: number) {
  (agg.extra[key] ??= []).push(value);
}

// ---------- scrape ----------
const CURRENT_SITES = new Set(ALL_TEST_SITES.map((s) => s.name));

function collectScrape(): Map<string, ProviderEvent> {
  const by = new Map<string, ProviderEvent>();
  for (const r of readJsonl("scrape")) {
    if (!CURRENT_SITES.has(String(r.site))) continue;
    const p = String(r.provider);
    if (!by.has(p)) by.set(p, emptyEvent());
    const agg = by.get(p)!;
    agg.total++;
    if (isNonScoringRec(r)) {
      agg.nonScoring++;
      continue;
    }
    const substance = typeof r.substanceScore === "number" ? r.substanceScore : null;
    if (substance !== null) push(agg, "substance", substance);
    // Without a verdict under the current rubric there is no pass/fail claim.
    // Excluding it keeps a judge outage from reading as a scrape failure; the
    // audit blocks publishing while any remain.
    const verdict =
      r.judgeRubric === SCRAPE_RUBRIC_ID && typeof r.judgeScore === "number" ? r.judgeScore : null;
    if (verdict === null) {
      agg.nonScoring++;
      push(agg, "ungraded", 1);
      continue;
    }
    agg.judgeScores.push(verdict);
    if (scrapePassed(verdict)) {
      agg.passed++;
      if (typeof r.scrapingTimeMs === "number" && r.scrapingTimeMs > 0) {
        agg.times.push(r.scrapingTimeMs);
      }
    }
  }
  // Coverage is measured against the full gauntlet, not the records present: a
  // run that never reached the hard sites must not score 100% on the easy ones.
  for (const agg of by.values()) {
    const notRun = CURRENT_SITES.size - agg.total;
    if (notRun <= 0) continue;
    agg.total += notRun;
    agg.nonScoring += notRun;
    for (let i = 0; i < notRun; i++) push(agg, "notRun", 1);
  }
  return by;
}

function scrapeRows(by: Map<string, ProviderEvent>): Row[] {
  const rows: Row[] = [];
  for (const [provider, agg] of by) {
    const s = scoreEvent(agg);
    rows.push({
      provider,
      attempts: agg.total,
      scored: s.scored,
      excluded: agg.nonScoring,
      passed: agg.passed,
      reliability: pct(s.reliability),
      quality: pct(s.quality),
      substance_avg: agg.extra.substance ? mean(agg.extra.substance).toFixed(2) : "-",
      p50_s: fmtS(s.p50Ms),
      note: [
        s.reason,
        agg.extra.notRun ? `${agg.extra.notRun.length} sites not run` : "",
        agg.extra.ungraded ? `${agg.extra.ungraded.length} ungraded` : "",
      ]
        .filter(Boolean)
        .join("; "),
    });
  }
  return rows.sort((a, b) => Number(b.passed) - Number(a.passed));
}

// ---------- search ----------
function collectSearch(): {
  quality: Map<string, ProviderEvent>;
  capability: Map<string, { pass: number; total: number }>;
} {
  const quality = new Map<string, ProviderEvent>();
  const capability = new Map<string, { pass: number; total: number }>();

  for (const r of readJsonl("search")) {
    const p = String(r.provider);
    const dim = String(r.dim);

    if (!quality.has(p)) quality.set(p, emptyEvent());
    const agg = quality.get(p)!;

    if (CAPABILITY_DIMS_EXCLUDED.has(dim)) {
      agg.total++;
      if (isNonScoringRec(r)) {
        agg.nonScoring++;
        continue;
      }
      if (!r.error && Number(r.numResults) > 0) agg.passed++;
      if (typeof r.judgeScore === "number") agg.judgeScores.push(r.judgeScore);
      if (typeof r.latencyMs === "number" && r.latencyMs > 0 && !r.error) {
        agg.times.push(r.latencyMs);
      }
      continue;
    }

    // legacy capability dims: diagnostics only
    if (!capability.has(p)) capability.set(p, { pass: 0, total: 0 });
    const cap = capability.get(p)!;
    if (isNonScoringRec(r)) continue;
    cap.total++;
    if (r.assertOk === true) cap.pass++;
    // latency still counts from capability dims so speed has a real sample
    if (typeof r.latencyMs === "number" && r.latencyMs > 0 && !r.error) {
      agg.times.push(r.latencyMs);
    }
  }
  return { quality, capability };
}

function searchRows(
  quality: Map<string, ProviderEvent>,
  capability: Map<string, { pass: number; total: number }>,
): Row[] {
  const rows: Row[] = [];
  for (const [provider, agg] of quality) {
    const s = scoreEvent(agg);
    const cap = capability.get(provider);
    rows.push({
      provider,
      answerability_cases: agg.total,
      scored: s.scored,
      excluded: agg.nonScoring,
      reliability: pct(s.reliability),
      quality: pct(s.quality),
      judge_avg: agg.judgeScores.length ? mean(agg.judgeScores).toFixed(1) : "-",
      capability: cap && cap.total ? `${cap.pass}/${cap.total}` : "-",
      p50_s: fmtS(s.p50Ms),
      note: s.reason ?? "",
    });
  }
  return rows.sort((a, b) => Number(b.judge_avg) - Number(a.judge_avg));
}

// ---------- quest ----------
function collectQuest(): Map<string, ProviderEvent> {
  const by = new Map<string, ProviderEvent>();
  for (const r of readJsonl("quest")) {
    const p = String(r.provider);
    if (!by.has(p)) by.set(p, emptyEvent());
    const agg = by.get(p)!;
    agg.total++;
    if (isNonScoringRec(r)) {
      agg.nonScoring++;
      continue;
    }
    if (!r.error) agg.passed++;
    if (r.wipeout) push(agg, "wipeouts", 1);
    if (typeof r.judgeAverage === "number") agg.judgeScores.push(r.judgeAverage);
    if (typeof r.totalMs === "number" && r.totalMs > 0) agg.times.push(r.totalMs);
  }
  return by;
}

function questRows(by: Map<string, ProviderEvent>): Row[] {
  const rows: Row[] = [];
  for (const [provider, agg] of by) {
    const s = scoreEvent(agg);
    rows.push({
      provider,
      quests: agg.total,
      scored: s.scored,
      excluded: agg.nonScoring,
      delivered: agg.passed,
      reliability: pct(s.reliability),
      quality: pct(s.quality),
      judge_avg: agg.judgeScores.length ? mean(agg.judgeScores).toFixed(1) : "-",
      wipeouts: agg.extra.wipeouts?.length ?? 0,
      p50_s: fmtS(s.p50Ms),
      note: s.reason ?? "",
    });
  }
  return rows.sort((a, b) => Number(b.judge_avg) - Number(a.judge_avg));
}

// ---------- overall ----------
const TURBO_PARENT: Record<string, string> = {
  "exa-fast": "exa",
  "parallel-turbo": "parallel",
};

function overallLeaderboard(
  scrape: Map<string, ProviderEvent>,
  search: Map<string, ProviderEvent>,
  quest: Map<string, ProviderEvent>,
): Row[] {
  const providers = new Set(
    [...scrape.keys(), ...search.keys(), ...quest.keys()].filter(
      (p) => !TURBO_PARENT[p],
    ),
  );

  const scored = new Map<string, { scrape: EventScore; search: EventScore; quest: EventScore }>();
  for (const p of providers) {
    scored.set(p, {
      scrape: scoreEvent(scrape.get(p) ?? emptyEvent()),
      search: scoreEvent(search.get(p) ?? emptyEvent()),
      quest: scoreEvent(quest.get(p) ?? emptyEvent()),
    });
  }

  // Speed anchors come only from providers with a usable sample, so a provider
  // that failed every case cannot define "fastest" with its error latency.
  const best = (pick: (s: { scrape: EventScore; search: EventScore; quest: EventScore }) => EventScore) =>
    Math.min(
      ...[...scored.values()]
        .map((s) => pick(s).p50Ms)
        .filter((v) => v > 0),
      Number.POSITIVE_INFINITY,
    );
  const bestScrape = best((s) => s.scrape);
  const bestSearch = best((s) => s.search);
  const bestQuest = best((s) => s.quest);

  const rows: Row[] = [];
  for (const p of providers) {
    const s = scored.get(p)!;
    const c = composite({
      reliability: [s.scrape.reliability, s.search.reliability, s.quest.reliability],
      quality: [s.scrape.quality, s.search.quality, s.quest.quality],
      speed: [
        speedScore(s.scrape.p50Ms, bestScrape),
        speedScore(s.search.p50Ms, bestSearch),
        speedScore(s.quest.p50Ms, bestQuest),
      ],
    });

    const missing: string[] = [];
    if (s.scrape.insufficient) missing.push(`scrape: ${s.scrape.reason}`);
    if (s.search.insufficient) missing.push(`search: ${s.search.reason}`);
    if (s.quest.insufficient) missing.push(`quest: ${s.quest.reason}`);
    if (c.withheld) missing.push(c.withheld);

    rows.push({
      provider: p,
      agent_ready: c.overall === null ? "n/a" : c.overall.toFixed(0),
      quality: c.quality === null ? "n/a" : c.quality.toFixed(0),
      reliability: c.reliability === null ? "n/a" : c.reliability.toFixed(0),
      speed: c.speed === null ? "n/a" : c.speed.toFixed(0),
      scrape_reliability: pct(s.scrape.reliability),
      search_quality: pct(s.search.quality),
      quest_quality: pct(s.quest.quality),
      data_note: missing.join("; "),
    });
  }
  return rows.sort((a, b) => {
    const av = a.agent_ready === "n/a" ? -1 : Number(a.agent_ready);
    const bv = b.agent_ready === "n/a" ? -1 : Number(b.agent_ready);
    return bv - av;
  });
}

// ---------- output ----------
function markdownTable(name: string, rows: Row[]): string {
  if (rows.length === 0) return `_no ${name} results yet_`;
  const cols = Object.keys(rows[0]);
  return [
    `| ${cols.join(" | ")} |`,
    `| ${cols.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${cols.map((c) => r[c] ?? "").join(" | ")} |`),
  ].join("\n");
}

function main() {
  const scrapeAgg = collectScrape();
  const { quality: searchAgg, capability } = collectSearch();
  const questAgg = collectQuest();

  const scrape = scrapeRows(scrapeAgg);
  const search = searchRows(searchAgg, capability);
  const quest = questRows(questAgg);
  const overall = overallLeaderboard(scrapeAgg, searchAgg, questAgg);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log("== Scrape =="); console.log(markdownTable("scrape", scrape));
  console.log("\n== Search =="); console.log(markdownTable("search", search));
  console.log("\n== Quest =="); console.log(markdownTable("quest", quest));
  console.log("\n== Overall agent-ready =="); console.log(markdownTable("overall", overall));
  console.log(
    `\nweights: quality ${WEIGHTS.quality}, reliability ${WEIGHTS.reliability}, speed ${WEIGHTS.speed} | min coverage ${MIN_COVERAGE}`,
  );

  fs.writeFileSync(
    path.join(OUT_DIR, "summary.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        weights: WEIGHTS,
        minCoverage: MIN_COVERAGE,
        scrape,
        search,
        quest,
        overall,
      },
      null,
      2,
    ) + "\n",
  );

  writeScoreboardSvg(overall);
}

// Overall agent-ready leaderboard SVG: composite plus the three axes, with an
// explicit "n/a" state so a provider with no scorable data is never rendered
// as a zero.
function writeScoreboardSvg(rows: Row[]) {
  const W = 1720;
  const rowH = 76;
  const H = rows.length * rowH + 148;
  const esc = (s: string | number | boolean | null | undefined) =>
    String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const parts: string[] = [];

  const colLogo = 90;
  const colName = 150;
  const medalX = 36;
  const cols: Array<[string, string, number]> = [
    ["agent-ready", `composite 0–100`, 620],
    ["quality", "judge panel", 850],
    ["reliability", "usable output", 1060],
    ["speed", "vs fastest", 1270],
    ["scrape", "fetch reliability", 1470],
  ];
  const medals = ["🥇", "🥈", "🥉"];

  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="SurfBench overall leaderboard">`);
  parts.push(`<rect width="${W}" height="${H}" fill="#c0c0c0"/>`);
  parts.push(`<rect width="${W}" height="64" fill="#000080"/>`);
  parts.push(`<text x="28" y="43" font-family="Verdana,Arial,sans-serif" font-size="26" font-weight="bold" fill="#ffffff">SurfBench — Overall Agent-Ready Leaderboard</text>`);

  parts.push(`<rect y="64" width="${W}" height="52" fill="#c0c0c0"/>`);
  parts.push(`<text x="${medalX}" y="90" font-family="Verdana,Arial,sans-serif" font-size="22" font-weight="bold" fill="#111">rank</text>`);
  parts.push(`<text x="${colName}" y="90" font-family="Verdana,Arial,sans-serif" font-size="22" font-weight="bold" fill="#111">provider</text>`);
  cols.forEach(([label, sub, x]) => {
    parts.push(`<text x="${x}" y="90" font-family="Verdana,Arial,sans-serif" font-size="22" font-weight="bold" fill="#111">${esc(label)}</text>`);
    parts.push(`<text x="${x}" y="110" font-family="Verdana,Arial,sans-serif" font-size="13" fill="#555">${esc(sub)}</text>`);
  });

  rows.forEach((r, ri) => {
    const y = 128 + ri * rowH + rowH / 2;
    const stripe = ri % 2 ? "#ffffff" : "#f4f2ea";
    parts.push(`<rect y="${128 + ri * rowH}" width="${W}" height="${rowH}" fill="${stripe}"/>`);
    const uri = faviconDataUri(String(r.provider));
    if (uri) {
      parts.push(`<image x="${colLogo}" y="${y - 17}" width="34" height="34" href="${uri}"/>`);
    }
    const unscored = r.agent_ready === "n/a";
    parts.push(`<text x="${medalX}" y="${y + 10}" font-family="Verdana,Arial,sans-serif" font-size="24">${unscored ? "" : (medals[ri] ?? "")}</text>`);
    parts.push(`<text x="${colName}" y="${y + 9}" font-family="Verdana,Arial,sans-serif" font-size="24" font-weight="bold" fill="#111">${esc(r.provider)}</text>`);
    parts.push(`<text x="${cols[0][2]}" y="${y + 6}" font-family="Verdana,Arial,sans-serif" font-size="30" font-weight="bold" fill="${unscored ? "#888" : "#000080"}">${esc(r.agent_ready)}</text>`);
    if (!unscored) {
      parts.push(`<text x="${cols[0][2] + 70}" y="${y + 6}" font-family="Verdana,Arial,sans-serif" font-size="14" fill="#666">/100</text>`);
    }
    const cells: Array<[string, number]> = [
      ["quality", cols[1][2]],
      ["reliability", cols[2][2]],
      ["speed", cols[3][2]],
      ["scrape_reliability", cols[4][2]],
    ];
    cells.forEach(([key, x]) => {
      parts.push(`<text x="${x}" y="${y - 2}" font-family="Verdana,Arial,sans-serif" font-size="24" font-weight="bold" fill="#111">${esc(r[key] ?? "-")}</text>`);
    });
    if (r.data_note) {
      parts.push(`<text x="${cols[1][2]}" y="${y + 22}" font-family="Verdana,Arial,sans-serif" font-size="12" fill="#a00">${esc(String(r.data_note).slice(0, 90))}</text>`);
    }
  });

  parts.push(`</svg>`);
  fs.writeFileSync("assets/benchmark-summary.svg", parts.join("\n"));
}

main();

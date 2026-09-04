import fs from "fs";
import path from "path";
import { faviconDataUri } from "./favicons.js";

// Aggregates results/raw/{scrape,search,quest}.jsonl into
// results/{scrape,search,quest}.csv + results/summary.json + the scoreboard SVG.
// Records are deduped by their case key, keeping the latest.

const RAW_DIR = path.join("results", "raw");
const OUT_DIR = "results";

type Row = Record<string, string | number>;

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

// ---------- stats ----------
function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function stats(values: number[]): { p50: number; p95: number; avg: number } {
  const s = values.filter((v) => v > 0).sort((a, b) => a - b);
  return {
    p50: quantile(s, 0.5),
    p95: quantile(s, 0.95),
    avg: s.length ? s.reduce((a, b) => a + b, 0) / s.length : 0,
  };
}

function fmtS(ms: number): string {
  return ms > 0 ? `${(ms / 1000).toFixed(1)}s` : "-";
}

// ---------- scrape ----------
function scrapeRows(): Row[] {
  const records = readJsonl("scrape");
  const byProvider = new Map<string, {
    attempts: number; passed: number; times: number[];
  }>();
  for (const r of records) {
    if (!byProvider.has(r.provider as string)) {
      byProvider.set(r.provider as string, { attempts: 0, passed: 0, times: [] });
    }
    const agg = byProvider.get(r.provider as string)!;
    agg.attempts++;
    if (r.ok) {
      agg.passed++;
      if (typeof r.scrapingTimeMs === "number" && r.scrapingTimeMs > 0) {
        agg.times.push(r.scrapingTimeMs);
      }
    }
  }
  const rows: Row[] = [];
  for (const [provider, agg] of byProvider) {
    const st = stats(agg.times);
    rows.push({
      provider,
      attempts: agg.attempts,
      passed: agg.passed,
      success: `${Math.round((agg.passed / agg.attempts) * 100)}%`,
      avg_usable_s: fmtS(st.avg),
      p50_s: fmtS(st.p50),
      p95_s: fmtS(st.p95),
    });
  }
  return rows.sort((a, b) => (b.passed as number) - (a.passed as number));
}

// ---------- search ----------
function searchRows(): Row[] {
  const records = readJsonl("search");
  const byProvider = new Map<string, {
    attempts: number; ok: number; latencies: number[];
  }>();
  for (const r of records) {
    if (!byProvider.has(r.provider as string)) {
      byProvider.set(r.provider as string, { attempts: 0, ok: 0, latencies: [] });
    }
    const agg = byProvider.get(r.provider as string)!;
    agg.attempts++;
    if (!r.error) {
      agg.ok++;
      if (typeof r.latencyMs === "number") agg.latencies.push(r.latencyMs);
    }
  }
  const rows: Row[] = [];
  for (const [provider, agg] of byProvider) {
    const st = stats(agg.latencies);
    rows.push({
      provider,
      queries: agg.attempts,
      ok: agg.ok,
      success: `${Math.round((agg.ok / agg.attempts) * 100)}%`,
      p50_s: fmtS(st.p50),
      p95_s: fmtS(st.p95),
    });
  }
  return rows.sort((a, b) => (b.ok as number) - (a.ok as number));
}

// ---------- quest ----------
function questRows(): Row[] {
  const records = readJsonl("quest");
  const byProvider = new Map<string, {
    quests: number; answered: number; totalMs: number[]; judgeScores: number[]; wipeouts: number;
  }>();
  for (const r of records) {
    if (!byProvider.has(r.provider as string)) {
      byProvider.set(r.provider as string, { quests: 0, answered: 0, totalMs: [], judgeScores: [], wipeouts: 0 });
    }
    const agg = byProvider.get(r.provider as string)!;
    agg.quests++;
    if (!r.error) agg.answered++;
    if (r.wipeout) agg.wipeouts++;
    if (typeof r.judgeAverage === "number") agg.judgeScores.push(r.judgeAverage);
    if (typeof r.totalMs === "number" && r.totalMs > 0) agg.totalMs.push(r.totalMs);
  }
  const rows: Row[] = [];
  for (const [provider, agg] of byProvider) {
    const st = stats(agg.totalMs);
    const judgeAvg = agg.judgeScores.length
      ? agg.judgeScores.reduce((a, b) => a + b, 0) / agg.judgeScores.length
      : 0;
    rows.push({
      provider,
      quests: agg.quests,
      answered: agg.answered,
      success: agg.quests ? `${Math.round((agg.answered / agg.quests) * 100)}%` : "-",
      total_s: fmtS(st.avg),
      p50_s: fmtS(st.p50),
      wipeouts: agg.wipeouts,
      judge_score: judgeAvg ? judgeAvg.toFixed(1) : "-",
    });
  }
  return rows.sort((a, b) => (b.answered as number) - (a.answered as number));
}

// ---------- overall agent-ready composite ----------
// Explainable composite per event (0-100), then averaged:
//   scrape: success% x (fastest avg / provider avg), speed floored at 0.25
//   search: success% x (fastest p50 / provider p50), speed floored at 0.25
//   quest:  answered% x 60 + judge/10 x 40 (judge = answer quality)
function overallLeaderboard(
  scrape: Row[],
  search: Row[],
  quest: Row[],
): Row[] {
  const bestAvgS = Math.min(
    ...scrape.filter((r) => parseS(r.avg_usable_s) > 0).map((r) => parseS(r.avg_usable_s)),
  );
  const bestSearchP50 = Math.min(
    ...search.filter((r) => parseS(r.p50_s) > 0).map((r) => parseS(r.p50_s)),
  );
  const bestQuestS = Math.min(
    ...quest.filter((r) => parseS(r.total_s) > 0).map((r) => parseS(r.total_s)),
  );

  const providers = new Set<string>([
    ...scrape.map((r) => String(r.provider)),
    ...search.map((r) => String(r.provider)),
    ...quest.map((r) => String(r.provider)),
  ]);

  const rows: Row[] = [];
  for (const p of providers) {
    const s = scrape.find((r) => r.provider === p);
    const se = search.find((r) => r.provider === p);
    const q = quest.find((r) => r.provider === p);

    const scrapeScore = s && s.attempts > 0
      ? (Number(s.passed) / Number(s.attempts)) * 100 *
        Math.max(0.25, bestAvgS / Math.max(parseS(s.avg_usable_s), 0.01))
      : 0;
    const searchScore = se && se.queries > 0
      ? (Number(se.ok) / Number(se.queries)) * 100 *
        Math.max(0.25, bestSearchP50 / Math.max(parseS(se.p50_s), 0.01))
      : 0;
    const questScore = q && q.quests > 0
      ? (Number(q.answered) / Number(q.quests)) * 60 +
        (parseS(q.judge_score) / 10) * 40
      : 0;

    const overall = (scrapeScore + searchScore + questScore) / 3;
    rows.push({
      provider: p,
      agent_ready: overall.toFixed(0),
      scrape: `${s ? `${s.passed}/${s.attempts} @ ${s.avg_usable_s}` : "-"}`,
      search: se ? `${se.success} @ ${se.p50_s} p50` : "-",
      quest: q ? `${q.answered}/${q.quests} @ ${q.total_s} · judge ${q.judge_score}` : "-",
    });
  }
  return rows.sort((a, b) => Number(b.agent_ready) - Number(a.agent_ready));
}

function parseS(s: string | number): number {
  if (typeof s === "number") return s;
  const m = /^([\d.]+)s$/.exec(String(s));
  return m ? Number(m[1]) : 0;
}

// ---------- output ----------
function writeCsv(name: string, rows: Row[]) {
  if (rows.length === 0) return;
  const cols = Object.keys(rows[0]);
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => r[c]).join(","))].join("\n");
  fs.writeFileSync(path.join("results", `${name}.csv`), csv + "\n");
  fs.writeFileSync(path.join("results", `${name}.json`), JSON.stringify(rows, null, 2) + "\n");
}

function markdownTable(name: string, rows: Row[]): string {
  if (rows.length === 0) return `_no ${name} results yet_`;
  const cols = Object.keys(rows[0]);
  const lines = [
    `| ${cols.join(" | ")} |`,
    `| ${cols.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${cols.map((c) => r[c]).join(" | ")} |`),
  ];
  return lines.join("\n");
}

function main() {
  const scrape = scrapeRows();
  const search = searchRows();
  const quest = questRows();

  fs.mkdirSync(OUT_DIR, { recursive: true });
  writeCsv("scrape", scrape);
  writeCsv("search", search);
  writeCsv("quest", quest);

  console.log("== Scrape =="); console.log(markdownTable("scrape", scrape));
  console.log("== Search =="); console.log(markdownTable("search", search));
  console.log("== Quest =="); console.log(markdownTable("quest", quest));

  const overall = overallLeaderboard(scrape, search, quest);
  console.log("== Overall agent-ready =="); console.log(markdownTable("overall", overall));

  fs.writeFileSync("results/README-tables.md", [
    "## Overall Agent-Ready", markdownTable("overall", overall), "",
    "## Scrape Event", markdownTable("scrape", scrape), "",
    "## Search Event", markdownTable("search", search), "",
    "## Quest Event", markdownTable("quest", quest), "",
  ].join("\n"));

  fs.writeFileSync(
    path.join(OUT_DIR, "summary.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), scrape, search, quest, overall }, null, 2) + "\n"
  );
  writeCsv("overall", overall);

  writeScoreboardSvg(overall);
}

// Overall agent-ready leaderboard across all three events, drawn as the Y2K
// scoreboard window with embedded provider favicons (base64 data URIs).
function writeScoreboardSvg(rows: Row[]) {
  const W = 1500;
  const H = rows.length * 46 + 150;
  const esc = (s: string | number) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="SurfBench overall leaderboard">`);
  parts.push(`<defs><pattern id="dither" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="#008080"/><rect x="1" y="1" width="1" height="1" fill="#007a7a"/></pattern></defs>`);
  parts.push(`<rect width="${W}" height="${H}" fill="url(#dither)"/>`);
  parts.push(`<rect x="30" y="30" width="${W - 60}" height="40" fill="#000080"/>`);
  parts.push(`<text x="50" y="56" font-family="Verdana,Arial,sans-serif" font-size="20" font-weight="bold" fill="#fff">SurfBench — Overall Agent-Ready Leaderboard</text>`);
  parts.push(`<rect x="30" y="70" width="${W - 60}" height="${H - 100}" fill="#c0c0c0"/>`);

  const cols = rows.length ? Object.keys(rows[0]) : ["provider"];
  const bodyX = 92;
  const firstColW = 210;
  const restW = W - 160 - firstColW;
  const restCols = Math.max(cols.length - 1, 1);
  const restW2 = W - 160 - firstColW;
  const restCols2 = restCols;
  const colX = (i: number) => (i === 0 ? bodyX : bodyX + firstColW + (i - 1) * (restW / Math.max(cols.length - 2, 1)));

  cols.forEach((c, i) => {
    parts.push(`<text x="${colX(i)}" y="105" font-family="Verdana,Arial,sans-serif" font-size="15" font-weight="bold" fill="#111">${esc(c)}</text>`);
  });

  rows.forEach((r, ri) => {
    const y = 148 + ri * 46;
    parts.push(`<rect x="50" y="${y - 22}" width="${W - 100}" height="40" fill="${ri % 2 ? "#ffffff" : "#f4f2ea"}"/>`);
    const uri = faviconDataUri(String(r.provider));
    if (uri) {
      parts.push(`<image x="58" y="${y - 15}" width="24" height="24" href="${uri}"/>`);
    }
    cols.forEach((c, ci) => {
      const val = esc(r[c] ?? "");
      const isProvider = ci === 0;
      parts.push(`<text x="${colX(ci) + (isProvider ? 32 : 0)}" y="${y + 5}" font-family="Verdana,Arial,sans-serif" font-size="${isProvider ? 15 : 13}" ${isProvider ? 'font-weight="bold"' : ""} fill="#111">${val}</text>`);
    });
  });

  parts.push(`</svg>`);
  fs.writeFileSync("assets/benchmark-summary.svg", parts.join("\n"));
}

main();
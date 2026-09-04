import fs from "fs";
import path from "path";

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

  fs.writeFileSync(
    path.join(OUT_DIR, "summary.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), scrape, search, quest }, null, 2) + "\n"
  );

  console.log("== Scrape =="); console.log(markdownTable("scrape", scrape));
  console.log("== Search =="); console.log(markdownTable("search", search));
  console.log("== Quest =="); console.log(markdownTable("quest", quest));

  fs.writeFileSync("results/README-tables.md", [
    "## Scrape Event", markdownTable("scrape", scrape), "",
    "## Search Event", markdownTable("search", search), "",
    "## Quest Event", markdownTable("quest", quest), "",
  ].join("\n"));

  writeScoreboardSvg(scrape);
}

function writeScoreboardSvg(rows: Row[]) {
  const W = 1500, H = rows.length * 46 + 150;
  const esc = (s: string | number) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="SurfBench leaderboard">`);
  parts.push(`<rect width="${W}" height="${H}" fill="#008080"/>`);
  // dithered desktop
  parts.push(`<rect width="${W}" height="${H}" fill="url(#dither)"/>`);
  parts.push(`<defs><pattern id="dither" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="#008080"/><rect x="1" y="1" width="1" height="1" fill="#007a7a"/></pattern></defs>`);
  // title bar
  parts.push(`<rect x="30" y="30" width="${W - 60}" height="40" fill="#000080"/>`);
  parts.push(`<text x="50" y="56" font-family="Verdana,Arial,sans-serif" font-size="20" font-weight="bold" fill="#fff">📊 SurfBench Scoreboard</text>`);
  // window body
  parts.push(`<rect x="30" y="70" width="${W - 60}" height="${H - 100}" fill="#c0c0c0"/>`);
  // table header
  const cols = rows.length ? Object.keys(rows[0]) : ["provider"];
  const colW = Math.min(200, (W - 120) / cols.length);
  cols.forEach((c, i) => {
    parts.push(`<text x="${60 + i * colW}" y="105" font-family="Verdana,Arial,sans-serif" font-size="16" font-weight="bold" fill="#111">${esc(c)}</text>`);
  });
  rows.forEach((r, ri) => {
    const y = 145 + ri * 46;
    // beveled row background
    parts.push(`<rect x="50" y="${y - 22}" width="${W - 100}" height="40" fill="${ri % 2 ? "#ffffff" : "#f4f2ea"}"/>`);
    cols.forEach((c, ci) => {
      parts.push(`<text x="${62 + ci * colW}" y="${y + 4}" font-family="Verdana,Arial,sans-serif" font-size="13" fill="#111">${esc(r[c] ?? "")}</text>`);
    });
  });
  parts.push(`</svg>`);
  fs.writeFileSync("assets/benchmark-summary.svg", parts.join("\n"));
}

main();
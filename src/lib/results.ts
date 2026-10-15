import fs from "fs/promises";
import path from "path";
import type {
  QuestResult,
  SearchResponse,
  ScrapedContent,
  TestSite,
} from "./types.js";
import { evaluateScrapedContent } from "./contentQuality.js";
import { classifyError } from "./errorClass.js";
import { substanceMetrics } from "./scrapeSubstance.js";
import { structuralMetrics } from "./searchQuality.js";

// Raw run records land in results/raw/*.jsonl — one line per provider×case.
// scripts/report.ts aggregates them into results/*.csv + summary.json + README tables.
// Content is sanitized: scraped pages can contain other people's leaked secrets
// (a leaked Google API key in a Reddit comment is how this repo once tripped
// GitHub secret scanning), so obvious key patterns are redacted at record time.
const RAW_DIR = "results/raw";

const SECRET_PATTERNS: RegExp[] = [
  /AIzaSy[A-Za-z0-9_-]{30,}/g, // Google API keys
  /sk-[A-Za-z0-9]{20,}/g, // OpenAI-style keys
  /ghp_[A-Za-z0-9]{30,}/g, // GitHub tokens
];

function redact(text: string): string {
  let out = text;
  for (const p of SECRET_PATTERNS) out = out.replace(p, "[REDACTED]");
  return out;
}

// One writer at a time. appendFile is only atomic for small writes; scrape
// records carry page bodies, and concurrent tests were splicing those lines
// into each other (a 500KB Wikipedia extract split mid-JSON).
let writeChain: Promise<void> = Promise.resolve();

async function appendRecord(event: string, provider: string, record: object) {
  const line = JSON.stringify({ provider, ...record }) + "\n";
  const run = writeChain.then(async () => {
    await fs.mkdir(RAW_DIR, { recursive: true });
    await fs.appendFile(path.join(RAW_DIR, `${event}.jsonl`), line);
  });
  // A failed write must not wedge every later record.
  writeChain = run.catch(() => {});
  return run;
}

export async function recordScrapeRun(input: {
  provider: string;
  site: TestSite;
  result: ScrapedContent;
  wallMs: number;
}) {
  const quality = evaluateScrapedContent(input.site, input.result);
  const content = input.result.response?.content ?? "";
  const substance = substanceMetrics(content);
  await appendRecord("scrape", input.provider, {
    site: input.site.name,
    url: input.site.url,
    category: input.site.category ?? "other",
    wallMs: input.wallMs,
    scrapingTimeMs: input.result.response?.scrapingTimeMs ?? null,
    ok: quality.ok,
    reason: quality.reason ?? null,
    errorClass: classifyError(input.result.error ?? quality.reason),
    // Deterministic shell detection — see scrapeSubstance.ts for why this is a
    // floor and a diagnostic, not the quality grade.
    substanceScore: substance.substanceScore,
    proseRatio: substance.proseRatio,
    structuredRatio: substance.structuredRatio,
    shortLineRatio: substance.shortLineRatio,
    linkDensity: substance.linkDensity,
    boilerplateHits: substance.boilerplateHits,
    chars: substance.chars,
    title: input.result.response?.title ?? null,
    // Capped: the judge only reads the first 12k, and an uncapped page body
    // made single jsonl lines large enough to tear under concurrent appends.
    content: content ? redact(content).slice(0, 14000) : undefined,
  });
}

export async function recordSearchRun(input: {
  provider: string;
  dim: string;
  query: string;
  response: SearchResponse;
  assertOk?: boolean;
  judgeScore?: number;
  judgeVerdicts?: unknown;
  judgeFlagged?: boolean;
}) {
  const structure = structuralMetrics(input.response.results);
  await appendRecord("search", input.provider, {
    provider: input.provider,
    dim: input.dim,
    query: input.query,
    latencyMs: input.response.latencyMs,
    numResults: input.response.results.length,
    error: input.response.error ?? null,
    // Separates "bad results" from "we never got a fair answer" (dead billing
    // key, provider rate cap). Scoring must not treat those the same.
    errorClass: classifyError(input.response.error),
    assertOk: input.assertOk ?? null,
    // The ranked list itself, so quality can be re-graded offline without
    // re-billing every provider, and so any published score is auditable.
    results: input.response.results.map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.snippet ? redact(r.snippet).slice(0, 600) : "",
    })),
    uniqueDomains: structure.uniqueDomains,
    duplicateUrlRate: Number(structure.duplicateUrlRate.toFixed(3)),
    snippetCoverage: Number(structure.snippetCoverage.toFixed(3)),
    judgeScore: input.judgeScore ?? null,
    judgeVerdicts: input.judgeVerdicts ?? null,
    judgeFlagged: input.judgeFlagged ?? null,
  });
}

export async function recordQuestRun(result: QuestResult, file = "quest") {
  await appendRecord(file, result.provider, {
    ...result,
    content: result.content ? redact(result.content).slice(0, 14000) : undefined,
  });
}
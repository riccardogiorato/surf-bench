import fs from "fs/promises";
import path from "path";
import type {
  QuestResult,
  SearchResponse,
  ScrapedContent,
  TestSite,
} from "./types.js";
import { evaluateScrapedContent } from "./contentQuality.js";

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

async function appendRecord(event: string, provider: string, record: object) {
  await fs.mkdir(RAW_DIR, { recursive: true });
  const file = path.join(RAW_DIR, `${event}.jsonl`);
  await fs.appendFile(file, JSON.stringify({ provider, ...record }) + "\n");
}

export async function recordScrapeRun(input: {
  provider: string;
  site: TestSite;
  result: ScrapedContent;
  wallMs: number;
}) {
  const quality = evaluateScrapedContent(input.site, input.result);
  await appendRecord("scrape", input.provider, {
    site: input.site.name,
    url: input.site.url,
    category: input.site.category ?? "other",
    wallMs: input.wallMs,
    scrapingTimeMs: input.result.response?.scrapingTimeMs ?? null,
    ok: quality.ok,
    reason: quality.reason ?? null,
  });
}

export async function recordSearchRun(input: {
  provider: string;
  dim: string;
  query: string;
  response: SearchResponse;
  assertOk?: boolean;
}) {
  await appendRecord("search", input.provider, {
    provider: input.provider,
    dim: input.dim,
    query: input.query,
    latencyMs: input.response.latencyMs,
    numResults: input.response.results.length,
    error: input.response.error ?? null,
    assertOk: input.assertOk ?? null,
  });
}

export async function recordQuestRun(result: QuestResult, file = "quest") {
  await appendRecord(file, result.provider, {
    ...result,
    content: result.content ? redact(result.content) : undefined,
  });
}
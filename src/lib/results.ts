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
const RAW_DIR = "results/raw";

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
}) {
  await appendRecord("search", input.provider, {
    provider: input.provider,
    dim: input.dim,
    query: input.query,
    latencyMs: input.response.latencyMs,
    numResults: input.response.results.length,
    error: input.response.error ?? null,
  });
}

export async function recordQuestRun(result: QuestResult) {
  await appendRecord("quest", result.provider, result);
}
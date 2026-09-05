import { ScrapedContent, ScraperFunction, SearchResult } from "./types.js";
import { createConcurrencyLimiter } from "./concurrency.js";

// Keenable: search + fetch REST API (api.keenable.ai), no SDK. Search returns
// ranked results with server-decided mode ("realtime"/"pro"). Fetch serves
// Keenable's indexed copy by default and errors on URLs it hasn't indexed, so
// the scraper falls back to live=true (fetch from source), matching the
// index-first/live-fallback configuration of the other scrapers (exa's
// livecrawl: "fallback", firecrawl's maxAge cache).

const BASE = "https://api.keenable.ai/v1";
const KEENABLE_API_KEY = process.env.KEENABLE_API_KEY ?? "";

export const shouldRunKeenable = !!KEENABLE_API_KEY;

// Keenable rate-limits to 10 requests/second per organization and answers
// bursts with HTTP 429, so every call from both suites goes through this one
// gate: 4 in flight with starts spaced ~110ms (≈9 req/s, under the limit).
const runGated = createConcurrencyLimiter(4);
let nextStart = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function paced<T>(fn: () => Promise<T>): Promise<T> {
  return runGated(async () => {
    const now = Date.now();
    const start = Math.max(now, nextStart);
    nextStart = start + 110;
    if (start > now) await sleep(start - now);
    return fn();
  });
}

// A 429 is retried through the paced gate with jittered backoff instead of
// failing the case — retries that bypassed the gate fired in lockstep and
// re-429'd each other. One deadline spans all attempts so retries can't
// extend past the caller's budget; persistent 429s surface as an error.
const MAX_ATTEMPTS = 4;

async function request(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const deadline = Date.now() + timeoutMs;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      const backoff = Math.min(1000 * 2 ** (attempt - 1), 10000);
      await sleep(backoff * (0.5 + Math.random()));
    }
    const budget = deadline - Date.now();
    if (budget <= 500) break;
    const response = await paced(() =>
      fetch(url, { ...init, signal: AbortSignal.timeout(budget) }),
    );
    if (response.status !== 429) return response;
    await response.body?.cancel().catch(() => {});
  }
  throw new Error("Keenable HTTP 429");
}

export async function keenableSearchResults(
  query: string,
  numResults: number,
): Promise<SearchResult[]> {
  const response = await paced(() =>
    request(
      `${BASE}/search`,
      {
        method: "POST",
        headers: {
          "X-API-Key": KEENABLE_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, max_results: numResults }),
      },
      30000,
    ),
  );
  if (!response.ok) {
    throw new Error(`Keenable HTTP ${response.status}`);
  }
  const data = await response.json();
  return (data.results ?? []).map((item: any) => ({
    title: item.title || "",
    url: item.url || "",
  }));
}

async function fetchOnce(
  url: string,
  live: boolean,
  timeoutMs: number,
  deadline: number,
): Promise<{ title: string; content: string }> {
  const response = await paced(() =>
    request(
      `${BASE}/fetch?url=${encodeURIComponent(url)}${live ? "&live=true" : ""}`,
      { headers: { "X-API-Key": KEENABLE_API_KEY } },
      Math.max(1000, Math.min(timeoutMs, deadline - Date.now())),
    ),
  );
  if (!response.ok) {
    throw new Error(`Keenable HTTP ${response.status}`);
  }
  const data = await response.json();
  return { title: data.title ?? "", content: data.content ?? "" };
}

const keenableScraperImpl: ScraperFunction = async (
  url: string,
  timeout = 30000,
) => {
  const startTime = Date.now();
  const deadline = startTime + timeout;
  try {
    // The indexed copy either serves in well under a second or isn't there —
    // cap this attempt at 10s so the live fallback keeps most of the budget.
    const indexed = await fetchOnce(url, false, Math.min(timeout, 10000), deadline);
    if (indexed.content.trim().length > 0) {
      return {
        url,
        response: { ...indexed, scrapingTimeMs: Date.now() - startTime },
      };
    }
  } catch {
    // not indexed (or the request failed) — retry live below
  }
  try {
    const live = await fetchOnce(url, true, timeout, deadline);
    return {
      url,
      response: { ...live, scrapingTimeMs: Date.now() - startTime },
    };
  } catch (error) {
    return {
      url,
      error: error instanceof Error ? error.message : "unknown error",
    };
  }
};

export { keenableScraperImpl };
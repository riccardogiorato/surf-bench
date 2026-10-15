import {
  firecrawlClientFactory,
  exaClientFactory,
  braveSearchClientFactory,
  linkupClientFactory,
  tavilyClientFactory,
  parallelClientFactory,
} from "./apiClients.js";
import { keenableSearchResults } from "./keenableClient.js";
import { SearchFunction, SearchResponse, SearchResult } from "./types.js";
import { createConcurrencyLimiter } from "./concurrency.js";
import { withSearchCache } from "./cache/withSearchCache.js";

// Cap each provider at 5 in-flight searches, matching the scrape suite's
// per-provider limit so events can run concurrently without hammering vendors.
// One limiter PER PROVIDER, not shared: a single shared instance would let a
// busy provider's queue starve every other provider's slots for no rate-limit
// reason.
const VENDOR_MAX_CONCURRENCY = 5;
const providerLimiters = new Map<string, ReturnType<typeof createConcurrencyLimiter>>();
function limiterFor(vendor: string) {
  if (!providerLimiters.has(vendor)) {
    providerLimiters.set(vendor, createConcurrencyLimiter(VENDOR_MAX_CONCURRENCY));
  }
  return providerLimiters.get(vendor)!;
}

// Exa's org cap is 10 requests/second (see RATE_LIMIT_ATTEMPTS below for the
// reactive side of this). Concurrency alone does not prevent bursts: 5
// in-flight calls that each resolve in under 500ms can still issue well over
// 10 req/s. This paces request STARTS at a fixed minimum spacing, the same
// pattern keenableClient.ts uses for its 10 req/s org cap, so the harness
// mostly never needs the retry path at all instead of leaning on it.
//
// This singleton only coordinates calls across the whole search event because
// vitest.config.ts runs the suite single-threaded with isolate:false — without
// that, each of the search event's 13 separate test files (12 dims +
// answerability) would get its own independent copy of exaNextStart and could
// still burst past the cap by firing from different files at once.
const EXA_MIN_SPACING_MS = 130; // ~7.7 req/s, under the 10/s cap with headroom
let exaNextStart = 0;
async function exaPaced<T>(fn: () => Promise<T>): Promise<T> {
  return limiterFor("exa")(async () => {
    const now = Date.now();
    const start = Math.max(now, exaNextStart);
    exaNextStart = start + EXA_MIN_SPACING_MS;
    if (start > now) await new Promise((r) => setTimeout(r, start - now));
    return fn();
  });
}

// One wrapper for every provider: timing, result mapping, error capture,
// concurrency limit and cache live here; each adapter only defines how to
// call its API and map the response to {title, url} results.
// Retries on the provider's own per-second cap. Without this the harness's
// concurrency becomes the thing being measured: a baseline run scored exa
// 16/29 on search, but 11 of its 13 failures were "Rate limit exceeded: 10
// requests per second" — the org cap, tripped by this harness, recorded as if
// exa had returned bad results. Only the exa-fast variant had backoff before.
// Retry time is excluded from the reported latency so a provider is not also
// punished on speed for the harness's pacing.
const RATE_LIMIT_ATTEMPTS = 4;

function isRateLimit(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  return /rate.?limit|\b429\b|too many requests|requests per second/i.test(msg);
}

function defineSearchProvider(
  vendor: string,
  fetchResults: (
    query: string,
    numResults: number,
  ) => Promise<SearchResult[]>,
  // Optional dedicated pacer for providers with a known per-second org cap
  // (currently only exa). Falls back to the plain per-provider concurrency
  // limiter for everyone else.
  pace: <T>(fn: () => Promise<T>) => Promise<T> = (fn) => limiterFor(vendor)(fn),
): SearchFunction {
  const impl: SearchFunction = async (query, numResults = 5) => {
    let rateLimitWaitMs = 0;
    const startTime = Date.now();
    for (let attempt = 0; ; attempt++) {
      try {
        const results = (await fetchResults(query, numResults)).filter(
          (r) => r.url,
        );
        return {
          results,
          latencyMs: Date.now() - startTime - rateLimitWaitMs,
        };
      } catch (error) {
        if (isRateLimit(error) && attempt < RATE_LIMIT_ATTEMPTS - 1) {
          const backoff = 1500 * 2 ** attempt * (0.5 + Math.random());
          rateLimitWaitMs += backoff;
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }
        return {
          results: [],
          latencyMs: Date.now() - startTime - rateLimitWaitMs,
          error: error instanceof Error ? error.message : "unknown error",
        };
      }
    }
  };
  return withSearchCache(vendor, (q, n) => pace(() => impl(q, n)));
}

// Parallel returns excerpts as an array of strings rather than one snippet.
function excerptText(item: any): string {
  if (Array.isArray(item.excerpts)) return item.excerpts.join(" ").trim();
  return item.excerpt || item.content || "";
}

// ---- provider adapters: only the API call + mapping ----

const firecrawlSearch = defineSearchProvider("firecrawl", async (query, numResults) => {
  const response = await firecrawlClientFactory().search(query, { limit: numResults });
  return (response.web ?? []).map((item: any) => ({
    title: item.title || item.metadata?.title || "",
    url: item.url || "",
    snippet: item.description || item.snippet || "",
  }));
});

const exaSearch = defineSearchProvider(
  "exa",
  async (query, numResults) => {
    const response = await exaClientFactory().search(query, { numResults });
    return (response.results ?? []).map((item: any) => ({
      title: item.title || "",
      url: item.url || "",
      // exa's plain search returns no text unless contents are requested, which
      // would change its latency profile. Graders judge source selection from
      // title+url when a snippet is absent rather than penalising the provider.
      snippet: item.text || item.snippet || "",
    }));
  },
  exaPaced,
);

const linkupSearch = defineSearchProvider("linkup", async (query, numResults) => {
  const response = await linkupClientFactory().search({
    query,
    depth: "standard",
    outputType: "searchResults",
  });
  return (response.results ?? [])
    .slice(0, numResults)
    .map((item: any) => ({
      title: item.name || "",
      url: item.url || "",
      snippet: item.content || "",
    }));
});

const braveSearch = defineSearchProvider("brave", async (query, numResults) => {
  const response = await braveSearchClientFactory().webSearch(query, {
    count: numResults,
  });
  return (response.web?.results ?? [])
    .slice(0, numResults)
    .map((item: any) => ({
      title: item.title || "",
      url: item.url || "",
      snippet: item.description || "",
    }));
});

const tavilySearch = defineSearchProvider("tavily", async (query, numResults) => {
  const response = await tavilyClientFactory().search(query, { maxResults: numResults });
  return (response.results ?? []).map((item: any) => ({
    title: item.title || "",
    url: item.url || "",
    snippet: item.content || "",
  }));
});

const parallelSearch = defineSearchProvider("parallel", async (query, numResults) => {
  const response = await parallelClientFactory().search({
    search_queries: [query],
    advanced_settings: { max_results: numResults },
  });
  return (response.results ?? []).map((item: any) => ({
    title: item.title || "",
    url: item.url || "",
    snippet: excerptText(item),
  }));
});

const keenableSearch = defineSearchProvider("keenable", keenableSearchResults);

// Super-fast variants for the "search turbo" leaderboard column, recorded
// under their own provider names. Gated on SURFBENCH_TURBO so default runs
// never see them: set SURFBENCH_TURBO=1 (plus the provider keys) to include
// exa's type:"fast" and parallel's mode:"turbo" in the search event. The exa
// variant is serialized (1 in flight) with backoff-retry on the org's 10 req/s
// cap — the fast tier trips it even at low client-side concurrency.
const exaFastLimited = createConcurrencyLimiter(1);

async function exaFastCall(query: string, numResults: number) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await exaFastLimited(() =>
        exaClientFactory().search(query, { numResults, type: "fast" }),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (attempt === 3 || !/rate limit/i.test(msg)) throw e;
      await new Promise((r) =>
        setTimeout(r, 2000 * (attempt + 1) * (0.5 + Math.random())),
      );
    }
  }
  throw new Error("exa-fast rate limited");
}

const exaFastSearch = defineSearchProvider("exa-fast", async (query, numResults) => {
  const response = await exaFastCall(query, numResults);
  return (response.results ?? []).map((item: any) => ({
    title: item.title || "",
    url: item.url || "",
    snippet: item.text || item.snippet || "",
  }));
});

const parallelTurboSearch = defineSearchProvider("parallel-turbo", async (query, numResults) => {
  const response = await parallelClientFactory().search({
    search_queries: [query],
    mode: "turbo",
    advanced_settings: { max_results: numResults },
  });
  return (response.results ?? []).map((item: any) => ({
    title: item.title || "",
    url: item.url || "",
    snippet: excerptText(item),
  }));
});

// Serper (Google SERP via google.serper.dev) — plain REST, no SDK.
const serperSearchImpl: SearchFunction = async (query, numResults = 5) => {
  const startTime = Date.now();
  try {
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": process.env.SERPER_API_KEY ?? "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, num: numResults }),
    });
    if (!response.ok) {
      throw new Error(`Serper HTTP ${response.status}`);
    }
    const data = await response.json();
    const results = (data.organic ?? [])
      .slice(0, numResults)
      .map((item: any) => ({
        title: item.title || "",
        url: item.link || "",
        snippet: item.snippet || "",
      }));
    return { results, latencyMs: Date.now() - startTime };
  } catch (error) {
    return {
      results: [],
      latencyMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : "unknown error",
    };
  }
};
const serperSearch = withSearchCache("serper", (q, n) =>
  limiterFor("serper")(() => serperSearchImpl(q, n)),
);

function gateOnKey(
  key: string | undefined,
  name: string,
  search: SearchFunction,
): SearchClient | null {
  return key ? { name, search } : null;
}

export interface SearchClient {
  name: string;
  search: SearchFunction;
}

const gated: (SearchClient | null)[] = [
  gateOnKey(process.env.FIRECRAWL_API_KEY, "firecrawl", firecrawlSearch),
  // SURFBENCH_TURBO swaps exa/parallel for their super-fast variants below —
  // the org rate limit is shared, so the two never run side by side.
  gateOnKey(
    process.env.SURFBENCH_TURBO ? undefined : process.env.EXA_API_KEY,
    "exa",
    exaSearch,
  ),
  gateOnKey(process.env.LINKUP_API_KEY, "linkup", linkupSearch),
  gateOnKey(process.env.TAVILY_API_KEY, "tavily", tavilySearch),
  gateOnKey(process.env.BRAVE_API_KEY, "brave", braveSearch),
  gateOnKey(
    process.env.SURFBENCH_TURBO ? undefined : process.env.PARALLEL_API_KEY,
    "parallel",
    parallelSearch,
  ),
  gateOnKey(process.env.SERPER_API_KEY, "serper", serperSearch),
  gateOnKey(process.env.KEENABLE_API_KEY, "keenable", keenableSearch),
  // search-turbo variants (only when SURFBENCH_TURBO is set)
  gateOnKey(
    process.env.SURFBENCH_TURBO ? process.env.EXA_API_KEY : undefined,
    "exa-fast",
    exaFastSearch,
  ),
  gateOnKey(
    process.env.SURFBENCH_TURBO ? process.env.PARALLEL_API_KEY : undefined,
    "parallel-turbo",
    parallelTurboSearch,
  ),
];

export const searchClients: SearchClient[] = gated.filter(
  (c): c is SearchClient => c !== null,
);

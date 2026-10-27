import {
  firecrawlClientFactory,
  exaClientFactory,
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
// exa had returned bad results.
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

// Fast modes, ranked as their own rows ("exa (lite)", "parallel (turbo)") and
// never merged into the default row: a provider must not pick its best mode
// per task. exa-lite shares exa's pacer because the org cap is shared.
function exaSearchFor(name: string, type: "lite") {
  return defineSearchProvider(
    name,
    async (query, numResults) => {
      // exa-js 2.25 does not type "lite"; lite rejects any parameter outside
      // query/numResults/contents.text, which is all the SDK sends here.
      const response = await exaClientFactory().search(query, { numResults, type: type as any });
      return (response.results ?? []).map((item: any) => ({
        title: item.title || "",
        url: item.url || "",
        snippet: item.text || item.snippet || "",
      }));
    },
    exaPaced,
  );
}
const exaLiteSearch = exaSearchFor("exa-lite", "lite");

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

// Perplexity has no fetch API: its search returns each page's extracted text,
// and that text is the fetch leg (SEARCH_CONTENT below). 10k tokens per page
// is about the reader's 40k-character window.
function perplexitySearchFor(name: string, searchType?: "fast") {
  return defineSearchProvider(name, async (query, numResults) => {
    const res = await fetch("https://api.perplexity.ai/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        max_results: numResults,
        max_tokens_per_page: 10000,
        max_tokens: 50000,
        ...(searchType ? { search_type: searchType } : {}),
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const body: any = await res.json();
    return (body.results ?? []).map((item: any) => ({
      title: item.title || "",
      url: item.url || "",
      snippet: (item.snippet || "").slice(0, 500),
      content: item.snippet || "",
    }));
  });
}
const perplexitySearch = perplexitySearchFor("perplexity");
const perplexityFastSearch = perplexitySearchFor("perplexity-fast", "fast");

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
  gateOnKey(process.env.EXA_API_KEY, "exa", exaSearch),
  gateOnKey(process.env.LINKUP_API_KEY, "linkup", linkupSearch),
  gateOnKey(process.env.TAVILY_API_KEY, "tavily", tavilySearch),
  gateOnKey(process.env.PARALLEL_API_KEY, "parallel", parallelSearch),
  gateOnKey(process.env.KEENABLE_API_KEY, "keenable", keenableSearch),
  gateOnKey(process.env.EXA_API_KEY, "exa-lite", exaLiteSearch),
  gateOnKey(process.env.PARALLEL_API_KEY, "parallel-turbo", parallelTurboSearch),
  gateOnKey(process.env.PERPLEXITY_API_KEY, "perplexity", perplexitySearch),
  gateOnKey(process.env.PERPLEXITY_API_KEY, "perplexity-fast", perplexityFastSearch),
];

// Fast modes have no fetch mode of their own: they fetch with the parent.
export const FETCH_PROVIDER: Record<string, string> = { "exa-lite": "exa", "parallel-turbo": "parallel" };
// Rows no longer benchmarked; report and audit skip their records. exa's
// legacy "fast" type returned the same top 5 as "lite" on 118 of 131 calls
// (run 2026-10-26T16-07), so lite replaced it.
export const RETIRED = new Set(["exa-fast"]);
export const fetchProviderOf = (name: string) => FETCH_PROVIDER[name] ?? name;
// Providers whose search results carry the page text: the top 3 results'
// text is their fetch leg. A direct-URL task becomes a search for that URL.
export const SEARCH_CONTENT = new Set(["perplexity", "perplexity-fast"]);

export const searchClients: SearchClient[] = gated.filter(
  (c): c is SearchClient => c !== null,
);

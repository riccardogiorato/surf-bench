import {
  firecrawlClient,
  exaClient,
  braveSearchClient,
  linkupClient,
  tavilyClient,
  parallelClientFactory,
} from "./apiClients.js";
import { SearchFunction, SearchResponse, SearchResult } from "./types.js";
import { createConcurrencyLimiter } from "./concurrency.js";
import { withSearchCache } from "./cache/withSearchCache.js";

// Cap each provider at 5 in-flight searches, matching the scrape suite's
// per-provider limit so events can run concurrently without hammering vendors.
const VENDOR_MAX_CONCURRENCY = 5;
const runLimited = createConcurrencyLimiter(VENDOR_MAX_CONCURRENCY);

// One wrapper for every provider: timing, result mapping, error capture,
// concurrency limit and cache live here; each adapter only defines how to
// call its API and map the response to {title, url} results.
function defineSearchProvider(
  vendor: string,
  fetchResults: (
    query: string,
    numResults: number,
  ) => Promise<SearchResult[]>,
): SearchFunction {
  const impl: SearchFunction = async (query, numResults = 5) => {
    const startTime = Date.now();
    try {
      const results = (await fetchResults(query, numResults)).filter(
        (r) => r.url,
      );
      return { results, latencyMs: Date.now() - startTime };
    } catch (error) {
      return {
        results: [],
        latencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : "unknown error",
      };
    }
  };
  return withSearchCache(vendor, (q, n) =>
    runLimited(() => impl(q, n)),
  );
}

// ---- provider adapters: only the API call + mapping ----

const firecrawlSearch = defineSearchProvider("firecrawl", async (query, numResults) => {
  const response = await firecrawlClient.search(query, { limit: numResults });
  return (response.web ?? []).map((item: any) => ({
    title: item.title || item.metadata?.title || "",
    url: item.url || "",
  }));
});

const exaSearch = defineSearchProvider("exa", async (query, numResults) => {
  const response = await exaClient.search(query, { numResults });
  return (response.results ?? []).map((item: any) => ({
    title: item.title || "",
    url: item.url || "",
  }));
});

const linkupSearch = defineSearchProvider("linkup", async (query, numResults) => {
  const response = await linkupClient.search({
    query,
    depth: "standard",
    outputType: "searchResults",
  });
  return (response.results ?? [])
    .slice(0, numResults)
    .map((item: any) => ({ title: item.name || "", url: item.url || "" }));
});

const braveSearch = defineSearchProvider("brave", async (query, numResults) => {
  const response = await braveSearchClient.webSearch(query, {
    count: numResults,
  });
  return (response.web?.results ?? [])
    .slice(0, numResults)
    .map((item: any) => ({ title: item.title || "", url: item.url || "" }));
});

const tavilySearch = defineSearchProvider("tavily", async (query, numResults) => {
  const response = await tavilyClient.search(query, { maxResults: numResults });
  return (response.results ?? []).map((item: any) => ({
    title: item.title || "",
    url: item.url || "",
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
      .map((item: any) => ({ title: item.title || "", url: item.link || "" }));
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
  runLimited(() => serperSearchImpl(q, n)),
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
  gateOnKey(process.env.EXA_API_KEY, "exa", exaSearch),
  gateOnKey(process.env.LINKUP_API_KEY, "linkup", linkupSearch),
  gateOnKey(process.env.TAVILY_API_KEY, "tavily", tavilySearch),
  gateOnKey(process.env.BRAVE_API_KEY, "brave", braveSearch),
  gateOnKey(process.env.PARALLEL_API_KEY, "parallel", parallelSearch),
  gateOnKey(process.env.SERPER_API_KEY, "serper", serperSearch),
];

export const searchClients: SearchClient[] = gated.filter(
  (c): c is SearchClient => c !== null,
);

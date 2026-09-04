import {
  firecrawlClient,
  exaClient,
  braveSearchClient,
  linkupClient,
  tavilyClient,
  parallelClientFactory,
  serperKey,
} from "./apiClients.js";
import { SearchFunction, SearchResponse, SearchResult } from "./types.js";
import { createConcurrencyLimiter } from "./concurrency.js";
import { withSearchCache } from "./cache/withSearchCache.js";

// Cap each provider at 5 in-flight searches, matching the scrape suite's
// per-provider limit so events can run concurrently without hammering vendors.
const VENDOR_MAX_CONCURRENCY = 5;

const runLimited = createConcurrencyLimiter(VENDOR_MAX_CONCURRENCY);

function limitVendorConcurrency(fn: SearchFunction): SearchFunction {
  return (query, numResults) => runLimited(() => fn(query, numResults));
}

function emptyResponse(): SearchResponse {
  return { results: [], latencyMs: 0, error: "no results" };
}

// Firecrawl search implementation
const firecrawlSearchImpl: SearchFunction = async (query, numResults = 5) => {
  const startTime = Date.now();
  try {
    const response = await firecrawlClient.search(query, {
      limit: numResults,
    });
    const results: SearchResult[] = (response.web ?? [])
      .map((item: any) => ({
        title: item.title || item.metadata?.title || "",
        url: item.url || "",
      }))
      .filter((r: SearchResult) => r.url);
    return { results, latencyMs: Date.now() - startTime };
  } catch (error) {
    return {
      results: [],
      latencyMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : "unknown error",
    };
  }
};

// Exa search implementation
const exaSearchImpl: SearchFunction = async (query, numResults = 5) => {
  const startTime = Date.now();
  try {
    const response = await exaClient.search(query, { numResults });
    const results: SearchResult[] = (response.results ?? [])
      .map((item: any) => ({
        title: item.title || "",
        url: item.url || "",
      }))
      .filter((r: SearchResult) => r.url);
    return { results, latencyMs: Date.now() - startTime };
  } catch (error) {
    return {
      results: [],
      latencyMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : "unknown error",
    };
  }
};

// Linkup search implementation
const linkupSearchImpl: SearchFunction = async (query, numResults = 5) => {
  const startTime = Date.now();
  try {
    const response = await linkupClient.search({
      query,
      depth: "standard",
      outputType: "searchResults",
    });
    const results: SearchResult[] = (response.results ?? [])
      .slice(0, numResults)
      .map((item: any) => ({
        title: item.name || "",
        url: item.url || "",
      }))
      .filter((r: SearchResult) => r.url);
    return { results, latencyMs: Date.now() - startTime };
  } catch (error) {
    return {
      results: [],
      latencyMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : "unknown error",
    };
  }
};

// Brave search implementation
const braveSearchImpl: SearchFunction = async (query, numResults = 5) => {
  const startTime = Date.now();
  try {
    const response = await braveSearchClient.webSearch(query, {
      count: numResults,
    });
    const results: SearchResult[] = (response.web?.results ?? [])
      .slice(0, numResults)
      .map((item: any) => ({
        title: item.title || "",
        url: item.url || "",
      }))
      .filter((r: SearchResult) => r.url);
    return { results, latencyMs: Date.now() - startTime };
  } catch (error) {
    return {
      results: [],
      latencyMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : "unknown error",
    };
  }
};

// Tavily search implementation
const tavilySearchImpl: SearchFunction = async (query, numResults = 5) => {
  const startTime = Date.now();
  try {
    const response = await tavilyClient.search(query, { maxResults: numResults });
    const results: SearchResult[] = (response.results ?? [])
      .map((item: any) => ({
        title: item.title || "",
        url: item.url || "",
      }))
      .filter((r: SearchResult) => r.url);
    return { results, latencyMs: Date.now() - startTime };
  } catch (error) {
    return {
      results: [],
      latencyMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : "unknown error",
    };
  }
};

// Parallel search implementation using the official parallel-web SDK
const parallelSearchImpl: SearchFunction = async (query, numResults = 5) => {
  const startTime = Date.now();
  try {
    const response = await parallelClientFactory().search({
      search_queries: [query],
      advanced_settings: { max_results: numResults },
    });
    const results: SearchResult[] = (response.results ?? [])
      .map((item: any) => ({
        title: item.title || "",
        url: item.url || "",
      }))
      .filter((r: SearchResult) => r.url);
    return { results, latencyMs: Date.now() - startTime };
  } catch (error) {
    return {
      results: [],
      latencyMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : "unknown error",
    };
  }
};

// Serper implementation (Google SERP via google.serper.dev).
// Free tier is generous; gated on SERPER_API_KEY which the user has yet to add.
const serperSearchImpl: SearchFunction = async (query, numResults = 5) => {
  const startTime = Date.now();
  try {
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": serperKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, num: numResults }),
    });
    if (!response.ok) {
      throw new Error(`Serper HTTP ${response.status}`);
    }
    const data = await response.json();
    const results: SearchResult[] = (data.organic ?? [])
      .slice(0, numResults)
      .map((item: any) => ({
        title: item.title || "",
        url: item.link || "",
      }))
      .filter((r: SearchResult) => r.url);
    return { results, latencyMs: Date.now() - startTime };
  } catch (error) {
    return {
      results: [],
      latencyMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : "unknown error",
    };
  }
};

function gateOnKey(
  vendor: string,
  impl: SearchFunction,
  key: string | undefined,
): SearchFunction | null {
  if (!key) return null;
  return withSearchCache(vendor, limitVendorConcurrency(impl));
}

// Cached, concurrency-limited search functions, gated on key presence
const firecrawlSearch = gateOnKey("firecrawl", firecrawlSearchImpl, process.env.FIRECRAWL_API_KEY);
const exaSearch = gateOnKey("exa", exaSearchImpl, process.env.EXA_API_KEY);
const linkupSearch = gateOnKey("linkup", linkupSearchImpl, process.env.LINKUP_API_KEY);
const tavilySearch = gateOnKey("tavily", tavilySearchImpl, process.env.TAVILY_API_KEY);
const braveSearch = gateOnKey("brave", braveSearchImpl, process.env.BRAVE_API_KEY);
const parallelSearch = gateOnKey("parallel", parallelSearchImpl, process.env.PARALLEL_API_KEY);
const serperSearch = gateOnKey("serper", serperSearchImpl, process.env.SERPER_API_KEY ?? serperKey);

export interface SearchClient {
  name: string;
  search: SearchFunction;
}

export const searchClients: SearchClient[] = [
  ...(firecrawlSearch ? [{ name: "firecrawl", search: firecrawlSearch }] : []),
  ...(exaSearch ? [{ name: "exa", search: exaSearch }] : []),
  ...(linkupSearch ? [{ name: "linkup", search: linkupSearch }] : []),
  ...(tavilySearch ? [{ name: "tavily", search: tavilySearch }] : []),
  ...(braveSearch ? [{ name: "brave", search: braveSearch }] : []),
  ...(parallelSearch ? [{ name: "parallel", search: parallelSearch }] : []),
  ...(serperSearch ? [{ name: "serper", search: serperSearch }] : []),
];
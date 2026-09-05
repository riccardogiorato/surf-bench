import { ScraperFunction, ScrapedContent } from "./types.js";
import {
  firecrawlClientFactory,
  exaClientFactory,
  linkupClientFactory,
  tavilyClientFactory,
  parallelClientFactory,
} from "./apiClients.js";
import { createConcurrencyLimiter } from "./concurrency.js";
import { withCache } from "./cache/withCache.js";
import { fetchParallelContent } from "./parallelClient.js";
import { jinaScraper, shouldRunJina } from "./jinaClient.js";
import { keenableScraperImpl, shouldRunKeenable } from "./keenableClient.js";

// Cap each provider at 5 in-flight scrapes so vendors can run fully in
// parallel without changing the per-provider load of earlier benchmark runs
// (which ran 5-at-a-time through vitest's default maxConcurrency).
const VENDOR_MAX_CONCURRENCY = 5;

function limitVendorConcurrency(fn: ScraperFunction): ScraperFunction {
  const runLimited = createConcurrencyLimiter(VENDOR_MAX_CONCURRENCY);
  return (url, timeout) => runLimited(() => fn(url, timeout));
}

// Scraper client interface
export interface ScraperClient {
  name: string;
  scrape: ScraperFunction;
  healthCheck: () => Promise<boolean>;
}

const CACHE_TIME_FIRECRAWL = 604800000; // 1 week

// Firecrawl scraper implementation
const firecrawlScraperImpl: ScraperFunction = async (
  url: string,
  timeout = 30000
) => {
  const startTime = Date.now();

  try {
    const response = await firecrawlClientFactory().scrape(url, {
      formats: ["markdown"],
      maxAge: CACHE_TIME_FIRECRAWL,
      timeout: timeout,
      storeInCache: true,
    });

    const content = response.markdown || "";
    const title = response.metadata?.title || "";
    const scrapingTimeMs = Date.now() - startTime;

    return {
      url,
      response: {
        title,
        content,
        scrapingTimeMs,
      },
    };
  } catch (error) {
    // Return empty response for failed scrapes
    return {
      url,
      response: {
        title: "",
        content: "",
        scrapingTimeMs: Date.now() - startTime,
      },
    };
  }
};

// Exa scraper implementation
const exaScraperImpl: ScraperFunction = async (
  url: string,
  timeout = 30000
) => {
  const startTime = Date.now();

  try {
    // Note: Exa doesn't support timeout parameter in getContents
    const response = await exaClientFactory().getContents([url], {
      text: true,
      livecrawl: "fallback",
      livecrawlTimeout: timeout,
    });

    if (!response?.results || response.results.length === 0) {
      // Exa doesn't have content for this URL, return empty
      return {
        url,
        response: {
          title: "",
          content: "",
          scrapingTimeMs: Date.now() - startTime,
        },
      };
    }

    const result = response.results[0];
    const content = result.text || "";
    const title = result.title || "";
    const scrapingTimeMs = Date.now() - startTime;

    return {
      url,
      response: {
        title,
        content,
        scrapingTimeMs,
      },
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return {
      url,
      error: errorMessage,
    };
  }
};

// Linkup scraper implementation
const linkupScraperImpl: ScraperFunction = async (
  url: string,
  timeout = 30000
) => {
  const startTime = Date.now();

  try {
    const response = await linkupClientFactory().fetch({
      url,
      renderJs: true, // Execute JavaScript before extracting content
    });

    const content = response.markdown || "";
    const title = response.markdown.slice(0, 100) || "";
    const scrapingTimeMs = Date.now() - startTime;

    return {
      url,
      response: {
        title,
        content,
        scrapingTimeMs,
      },
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return {
      url,
      error: errorMessage,
    };
  }
};

// Parallel Search scraper implementation using the official parallel-web SDK
const parallelScraperImpl: ScraperFunction = async (
  url: string,
  timeout = 30000,
) => {
  try {
    const response = await fetchParallelContent(url, timeout);

    return {
      url,
      response: {
        title: response.title,
        content: response.content,
        scrapingTimeMs: response.scrapingTimeMs,
      },
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return {
      url,
      error: errorMessage,
    };
  }
};

// Tavily scraper implementation
const tavilyScraperImpl: ScraperFunction = async (
  url: string,
  timeout = 30000,
) => {
  const startTime = Date.now();

  try {
    const response = await tavilyClientFactory().extract([url], {
      extractDepth: "advanced",
      format: "markdown",
      timeout: Math.ceil(timeout / 1000),
    });

    const failedResult = response.failedResults?.[0];
    if (failedResult) {
      return {
        url,
        error: failedResult.error,
      };
    }

    const result = response.results?.[0];
    if (!result) {
      return {
        url,
        error: "Tavily returned no extraction result",
      };
    }

    return {
      url,
      response: {
        title: result.title ?? "",
        content: result.rawContent ?? "",
        scrapingTimeMs: Date.now() - startTime,
      },
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return {
      url,
      error: errorMessage,
    };
  }
};

// Health check functions
async function checkFirecrawl(): Promise<boolean> {
  try {
    const result = await firecrawlClientFactory().scrape("https://www.firecrawl.dev/", {
      formats: ["markdown"],
      maxAge: CACHE_TIME_FIRECRAWL,
    });

    return !!result.markdown;
  } catch (error) {
    return false;
  }
}

async function checkExa(): Promise<boolean> {
  try {
    const result = await exaClientFactory().getContents(["https://exa.ai/"], {
      text: true,
    });
    return !!result?.results && result.results.length > 0;
  } catch (error) {
    return false;
  }
}

async function checkLinkup(): Promise<boolean> {
  try {
    const result = await linkupClientFactory().fetch({
      url: "https://linkup.so/",
      renderJs: true,
    });
    return !!result?.markdown;
  } catch (error) {
    return false;
  }
}

async function checkParallel(): Promise<boolean> {
  try {
    const result = await fetchParallelContent("https://parallel.ai/", 30000);
    return result.content.length > 0;
  } catch (error) {
    return false;
  }
}

async function checkTavily(): Promise<boolean> {
  try {
    const result = await tavilyClientFactory().extract(["https://tavily.com/"], {
      extractDepth: "basic",
      format: "markdown",
    });
    return (result.results?.[0]?.rawContent?.length ?? 0) > 0;
  } catch (error) {
    return false;
  }
}

async function checkKeenable(): Promise<boolean> {
  try {
    const result = await keenableScraperImpl("https://keenable.ai/");
    return (result.response?.content?.length ?? 0) > 0;
  } catch (error) {
    return false;
  }
}

// Cached scraper functions, each capped at VENDOR_MAX_CONCURRENCY in-flight
// requests (parallel keeps its own lower cap inside parallelClient.ts)
const firecrawlScraper = withCache(
  "firecrawl",
  limitVendorConcurrency(firecrawlScraperImpl),
);
const exaScraper = withCache(
  "exa",
  limitVendorConcurrency(exaScraperImpl),
);
const linkupScraper = withCache(
  "linkup",
  limitVendorConcurrency(linkupScraperImpl),
);
const parallelScraper = withCache("parallel", parallelScraperImpl);
const tavilyScraper = withCache(
  "tavily",
  limitVendorConcurrency(tavilyScraperImpl),
);
const keenableScraper = withCache(
  "keenable",
  limitVendorConcurrency(keenableScraperImpl),
);

// The official Parallel REST API requires an API key
const shouldRunParallel = !!process.env.PARALLEL_API_KEY;

// Scraper clients array for testing
export const scraperClients: ScraperClient[] = [
  {
    name: "firecrawl",
    scrape: firecrawlScraper,
    healthCheck: checkFirecrawl,
  },
  {
    name: "exa",
    scrape: exaScraper,
    healthCheck: checkExa,
  },
  {
    name: "linkup",
    scrape: linkupScraper,
    healthCheck: checkLinkup,
  },
  {
    name: "tavily",
    scrape: tavilyScraper,
    healthCheck: checkTavily,
  },
  ...(shouldRunParallel
    ? [
        {
          name: "parallel",
          scrape: parallelScraper,
          healthCheck: checkParallel,
        },
      ]
    : []),
  ...(shouldRunJina
    ? [
        {
          name: "jina",
          scrape: jinaScraper,
          healthCheck: async () => true,
        },
      ]
    : []),
  ...(shouldRunKeenable
    ? [
        {
          name: "keenable",
          scrape: keenableScraper,
          healthCheck: checkKeenable,
        },
      ]
    : []),
];

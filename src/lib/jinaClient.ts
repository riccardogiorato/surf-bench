import { ScrapedContent, ScraperFunction } from "./types.js";
import { withCache } from "./cache/withCache.js";
import { createConcurrencyLimiter } from "./concurrency.js";

// Jina Reader: r.jina.ai turns a URL into clean markdown. Plain REST, no SDK.
// Gated on JINA_API_KEY (present in .env); free tier is rate-limited per minute.
const JINA_API_KEY = process.env.JINA_API_KEY ?? "";
const runLimited = createConcurrencyLimiter(5); // free tier is ~20 rpm; 5 in-flight is safe

const jinaScraperImpl: ScraperFunction = async (
  url: string,
  timeout = 30000
) => {
  const startTime = Date.now();
  try {
    const response = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        Authorization: `Bearer ${JINA_API_KEY}`,
        "X-Return-Format": "markdown",
        "X-Timeout": String(Math.ceil(timeout / 1000)),
      },
      signal: AbortSignal.timeout(timeout),
    });

    if (!response.ok) {
      throw new Error(`Jina HTTP ${response.status}`);
    }

    const content = await response.text();
    const titleMatch = content.match(/^Title: (.+)$/m);
    const title = titleMatch ? titleMatch[1] : "";

    // Strip the "Title:...\nURL Source:...\nMarkdown Content:" preamble jina prepends
    const body = content.replace(
      /^Title:.*\nURL Source:.*\nMarkdown Content:\n?/m,
      ""
    );

    return {
      url,
      response: {
        title,
        content: body,
        scrapingTimeMs: Date.now() - startTime,
      },
    };
  } catch (error) {
    return {
      url,
      error: error instanceof Error ? error.message : "unknown error",
    };
  }
};

const VENDOR_MAX_CONCURRENCY = 5;

export const jinaScraper = withCache(
  "jina",
  (url, timeout) => runLimited(() => jinaScraperImpl(url, timeout))
);

export const shouldRunJina = !!JINA_API_KEY;
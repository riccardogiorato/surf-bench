import crypto from "crypto";
import Parallel from "parallel-web";
import { createConcurrencyLimiter } from "./concurrency.js";

const PARALLEL_API_KEY = process.env.PARALLEL_API_KEY;
const DEFAULT_PARALLEL_MAX_CONCURRENCY = 4;
const parsedMaxConcurrency = Number.parseInt(
  process.env.PARALLEL_MAX_CONCURRENCY ??
    String(DEFAULT_PARALLEL_MAX_CONCURRENCY),
  10,
);
const PARALLEL_MAX_CONCURRENCY =
  Number.isFinite(parsedMaxConcurrency) && parsedMaxConcurrency > 0
    ? parsedMaxConcurrency
    : DEFAULT_PARALLEL_MAX_CONCURRENCY;
const PARALLEL_SESSION_ID =
  process.env.PARALLEL_SESSION_ID ??
  `web-scrapers-evals-${crypto.randomUUID()}`;

// The Parallel SDK constructor throws when PARALLEL_API_KEY is missing, so the
// client is created lazily; the scraper is only registered when the key is set.
let parallelClient: Parallel | null = null;

function getParallelClient(): Parallel {
  if (!parallelClient) {
    parallelClient = new Parallel({ apiKey: PARALLEL_API_KEY });
  }

  return parallelClient;
}

const runWithConcurrencyLimit = createConcurrencyLimiter(
  PARALLEL_MAX_CONCURRENCY,
);

function formatExtractError(error: Parallel.ExtractError): string {
  const status = error.http_status_code
    ? ` (HTTP ${error.http_status_code})`
    : "";
  const detail = error.content?.trim() || "no additional detail";
  return `${error.error_type}${status}: ${detail}`;
}

export async function fetchParallelContent(
  url: string,
  timeout: number,
): Promise<{ title: string; content: string; scrapingTimeMs: number }> {
  return runWithConcurrencyLimit(async () => {
    const startTime = Date.now();
    const response = await getParallelClient().extract(
      {
        urls: [url],
        objective:
          "Extract the whole page as markdown for a scraper benchmark.",
        advanced_settings: {
          full_content: true,
          fetch_policy: { timeout_seconds: Math.ceil(timeout / 1000) },
        },
        session_id: PARALLEL_SESSION_ID,
      },
      { timeout },
    );

    if (response.errors.length > 0) {
      throw new Error(response.errors.map(formatExtractError).join("; "));
    }

    const result = response.results[0];

    if (!result) {
      throw new Error("Parallel extract returned no results");
    }

    const fullContent = result.full_content?.trim() ?? "";
    const excerptContent = result.excerpts?.filter(Boolean).join("\n\n") ?? "";
    const content = fullContent.length > 0 ? fullContent : excerptContent;

    return {
      title: result.title ?? "",
      content,
      scrapingTimeMs: Date.now() - startTime,
    };
  });
}
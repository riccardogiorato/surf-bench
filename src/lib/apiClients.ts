import { createTogetherAI } from "@ai-sdk/togetherai";
import { LinkupClient } from "linkup-sdk";
import Firecrawl from "@mendable/firecrawl-js";
import { Exa } from "exa-js";
import { BraveSearch } from "brave-search";
import { tavily } from "@tavily/core";
import Parallel from "parallel-web";
import "dotenv/config";

export const firecrawlClient = new Firecrawl({
  apiKey: process.env.FIRECRAWL_API_KEY ?? "",
});

export const togetheraiClient = createTogetherAI({
  apiKey: process.env.TOGETHER_API_KEY ?? "",
});

export const linkupClient = new LinkupClient({
  apiKey: process.env.LINKUP_API_KEY ?? "",
});

export const exaClient = new Exa(process.env.EXA_API_KEY ?? "");

export const braveSearchClient = new BraveSearch(
  process.env.BRAVE_API_KEY ?? ""
);

export const tavilyClient = tavily({
  apiKey: process.env.TAVILY_API_KEY ?? "",
});

// The Parallel SDK constructor throws when PARALLEL_API_KEY is missing, so the
// client is created lazily; adapters are only registered when the key is set.
let parallelClient: Parallel | null = null;

export function parallelClientFactory(): Parallel {
  if (!parallelClient) {
    parallelClient = new Parallel({ apiKey: process.env.PARALLEL_API_KEY });
  }
  return parallelClient;
}

// Serper is key-gated like every other provider (no SDK, plain REST).
export const serperKey = process.env.SERPER_API_KEY ?? "";
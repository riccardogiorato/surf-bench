import { LinkupClient } from "linkup-sdk";
import Firecrawl from "@mendable/firecrawl-js";
import { Exa } from "exa-js";
import { BraveSearch } from "brave-search";
import { tavily } from "@tavily/core";
import Parallel from "parallel-web";
import "dotenv/config";

// Some SDK constructors throw when their key is missing (Exa, Parallel), and
// providers are key-gated only AFTER these modules import — so every client is
// constructed lazily through a memoized factory (the parallelClientFactory
// pattern): a provider without a key in .env never runs its constructor.

let firecrawlClient: Firecrawl | null = null;

export function firecrawlClientFactory(): Firecrawl {
  if (!firecrawlClient) {
    firecrawlClient = new Firecrawl({
      apiKey: process.env.FIRECRAWL_API_KEY ?? "",
    });
  }
  return firecrawlClient;
}

let linkupClient: LinkupClient | null = null;

export function linkupClientFactory(): LinkupClient {
  if (!linkupClient) {
    linkupClient = new LinkupClient({
      apiKey: process.env.LINKUP_API_KEY ?? "",
    });
  }
  return linkupClient;
}

let exaClient: Exa | null = null;

export function exaClientFactory(): Exa {
  if (!exaClient) {
    exaClient = new Exa(process.env.EXA_API_KEY ?? "");
  }
  return exaClient;
}

let braveSearchClient: BraveSearch | null = null;

export function braveSearchClientFactory(): BraveSearch {
  if (!braveSearchClient) {
    braveSearchClient = new BraveSearch(process.env.BRAVE_API_KEY ?? "");
  }
  return braveSearchClient;
}

let tavilyClient: ReturnType<typeof tavily> | null = null;

export function tavilyClientFactory(): ReturnType<typeof tavily> {
  if (!tavilyClient) {
    tavilyClient = tavily({
      apiKey: process.env.TAVILY_API_KEY ?? "",
    });
  }
  return tavilyClient;
}

// The Parallel SDK constructor throws when PARALLEL_API_KEY is missing, so the
// client is created lazily; adapters are only registered when the key is set.
let parallelClient: Parallel | null = null;

export function parallelClientFactory(): Parallel {
  if (!parallelClient) {
    parallelClient = new Parallel({ apiKey: process.env.PARALLEL_API_KEY });
  }
  return parallelClient;
}
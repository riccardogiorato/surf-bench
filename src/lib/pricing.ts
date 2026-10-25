import { hostMatches } from "./tasks.js";

// List prices per billable call, for the configs the harness actually sends
// (see searchClients.ts / scraperClients.ts). Cost is a published column, never
// a scoring axis. Every entry carries its source and the date it was read;
// `bun run tasks:audit` fails if a provider in the run has no entry.
//
// Failed fetches are not billed: firecrawl, tavily and linkup document this,
// and charging the others for failures would penalise them for our choice.

export interface PriceEntry {
  searchUsd: number; // one search call at the harness's numResults (5)
  fetchUsd: (url: string) => number; // one successful fetch of `url`
  source: string;
  asOf: string;
  note?: string;
}

const flat = (usd: number) => () => usd;

// Firecrawl Standard plan: $83 / 100,000 credits (annual billing).
const FIRECRAWL_CREDIT = 83 / 100_000;

export const PRICES: Record<string, PriceEntry> = {
  exa: {
    searchUsd: 7 / 1000,
    fetchUsd: flat(1 / 1000),
    source: "https://exa.ai/pricing",
    asOf: "2026-09",
  },
  parallel: {
    searchUsd: 5 / 1000,
    fetchUsd: flat(1 / 1000),
    source: "https://docs.parallel.ai/getting-started/pricing",
    asOf: "2026-09",
  },
  "exa-fast": {
    searchUsd: 7 / 1000, // type "fast": same rate as auto
    fetchUsd: flat(1 / 1000),
    source: "https://exa.ai/pricing",
    asOf: "2026-10-22",
    note: "Exa lists fast as a legacy search type; its price is unchanged",
  },
  "parallel-turbo": {
    searchUsd: 1 / 1000, // turbo mode, up to 10 results
    fetchUsd: flat(1 / 1000),
    source: "https://docs.parallel.ai/getting-started/pricing",
    asOf: "2026-10-22",
  },
  perplexity: {
    searchUsd: 5 / 1000, // Search API, page contents included
    fetchUsd: flat(0), // no fetch call: contents come with the search
    source: "https://docs.perplexity.ai/getting-started/pricing",
    asOf: "2026-10-25",
  },
  "perplexity-fast": {
    searchUsd: 1 / 1000, // search_type "fast"
    fetchUsd: flat(0),
    source: "https://docs.perplexity.ai/getting-started/pricing",
    asOf: "2026-10-25",
  },
  keenable: {
    searchUsd: 4 / 1000,
    fetchUsd: flat(4 / 1000),
    source: "https://keenable.ai/pricing",
    asOf: "2026-09",
    note: "pay-as-you-go; the errored index attempt before a live fallback is assumed unbilled",
  },
  firecrawl: {
    searchUsd: 2 * FIRECRAWL_CREDIT, // 2 credits per 10 results
    fetchUsd: (url) =>
      hostMatches(url, "x.com") ? 30 * FIRECRAWL_CREDIT : FIRECRAWL_CREDIT,
    source: "https://docs.firecrawl.dev/billing",
    asOf: "2026-10-22",
    note: "Standard plan credit rate; X/Twitter URLs are routed via Grok at 1 + 29 credits; LinkedIn pages are provider-routed with unpublished pricing (billed here at 1 credit)",
  },
  tavily: {
    searchUsd: 0.008, // basic search: 1 credit, pay-as-you-go
    fetchUsd: flat((2 * 0.008) / 5), // advanced extract: 2 credits per 5 URLs
    source: "https://docs.tavily.com/documentation/api-credits",
    asOf: "2026-10-22",
  },
  linkup: {
    searchUsd: 0.005, // standard depth, searchResults
    fetchUsd: flat(0.005), // standard mode, renderJs: true
    source: "https://docs.linkup.so/pages/documentation/platform/pricing",
    asOf: "2026-10-22",
  },
};

export interface CallLog {
  searches: number;
  fetchedUrls: string[]; // successful fetches only
}

export function costUsd(provider: string, calls: CallLog): number | null {
  const p = PRICES[provider];
  if (!p) return null;
  const fetchCost = calls.fetchedUrls.reduce((s, u) => s + p.fetchUsd(u), 0);
  return calls.searches * p.searchUsd + fetchCost;
}

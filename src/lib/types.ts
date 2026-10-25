// Scraping functionality types
export interface ScrapedContent {
  url: string;
  response?: {
    title?: string;
    content?: string;
    scrapingTimeMs?: number;
  }
  error?: string;
}

export type ScraperFunction = (
  url: string,
  timeout?: number
) => Promise<ScrapedContent>;

// Search functionality types
export interface SearchResult {
  title: string;
  url: string;
  // Provider-supplied snippet/excerpt, when the API returns one for free.
  snippet?: string;
  // Extracted page text, for providers whose search returns it in place of a
  // fetch API (perplexity).
  content?: string;
}

export interface SearchResponse {
  results: SearchResult[];
  latencyMs: number;
  error?: string;
}

export type SearchFunction = (
  query: string,
  numResults?: number
) => Promise<SearchResponse>;

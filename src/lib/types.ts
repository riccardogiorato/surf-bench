
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

// Test site interfaces
export interface TestSite {
  name: string;
  url: string;
  category?: 'academic' | 'news' | 'technical' | 'ecommerce' | 'jobs' | 'realestate' | 'social' | 'extra';
}

// Search functionality types
export interface SearchResult {
  title: string;
  url: string;
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

// Quest (search -> fetch -> grade) types
export interface QuestCase {
  id: string;
  question: string;
  // tokens the final content should contain to be considered on-target
  expectTokens: string[];
}

export interface QuestResult {
  provider: string;
  questId: string;
  searchMs?: number;
  fetchMs?: number;
  totalMs: number;
  urlsFetched: string[];
  contentChars: number;
  content?: string;
  wipeout?: boolean; // exceeded the 30s per-leg rule
  error?: string;
}

// Judge types
export interface Verdict {
  score: number; // 0-10
  rationale: string;
  judge: string;
}

# Web Scrapers Evals

**Finding the best web scraper for giving LLMs and agents reliable access to real web pages.**

This repo benchmarks AI-friendly web extraction providers on 50 real, messy URLs: high-traffic social/video/community pages, marketplaces, local/travel listings, news, technical docs, academic papers, jobs, real estate, and e-commerce.

![Benchmark summary](./assets/benchmark-summary.svg)

## Key Findings

Current 50-site report updated **4 September 2026** (fresh full re-run with latest provider SDKs and a quality gate). Average time is computed over usable successes only:

| Provider                                                                                                              | Usable Success | Avg Time | Takeaway                                                                                  |
| --------------------------------------------------------------------------------------------------------------------- | -------------- | -------- | ----------------------------------------------------------------------------------------- |
| <img src="https://www.google.com/s2/favicons?domain=parallel.ai&sz=32" width="16" height="16" alt=""> **parallel**    | **50/50**      | **0.6s** | Clean sweep: only provider with full coverage, and the fastest, via the official SDK.     |
| <img src="https://www.google.com/s2/favicons?domain=exa.ai&sz=32" width="16" height="16" alt=""> **exa**              | 38/50          | 0.8s     | Big jump with the 2.19 SDK (was 27/50 at 11.8s); still misses some social/marketplace pages. |
| <img src="https://www.google.com/s2/favicons?domain=tavily.com&sz=32" width="16" height="16" alt=""> **tavily**       | 37/50          | 2.9s     | Consistent coverage but slower in this run (was 1.8s).                                    |
| <img src="https://www.google.com/s2/favicons?domain=firecrawl.dev&sz=32" width="16" height="16" alt=""> **firecrawl** | 37/50          | 3.6s     | Still strong on marketplaces, but slower in this run (was 2.5s).                          |
| <img src="https://www.google.com/s2/favicons?domain=linkup.so&sz=32" width="16" height="16" alt=""> **linkup**        | 33/50          | 4.1s     | Faster than before (was 7.4s), but coverage still trails on social and listings.           |

## Why This Matters

If you are building AI tools, agents, research workflows, or content systems, web access quality changes everything:

- **Success rate:** can the provider actually get the page?
- **Latency:** can it run inside an agent loop?
- **Output quality:** is the returned content useful, or just a login wall / blocked page / tiny stub?
- **Coverage:** does it handle social, commerce, docs, real estate, news, and academic pages?

This benchmark is designed to catch the thing simple demos miss: a provider can return "content" and still give your LLM bad context.

## Methodology

- **50 real URLs** across jobs, real estate, social/video/community, academic, news, technical docs, marketplaces, local/travel, e-commerce, and startup pages.
- **Cached benchmark measurements** preserve provider-reported scrape time; all 250 provider-site combinations were fetched fresh on 4 September 2026.
- **Concurrent execution** through Vitest, with all providers running in parallel; each provider is capped at 5 in-flight scrapes (Parallel at 4) so per-provider load stays comparable across runs.
- **Success means usable content**, not merely a non-empty response.
- **Quality gate rejects** short stubs, obvious blocked/error pages, and content that does not match the expected site/page tokens.
- **Timings** are provider-reported scrape times stored in cache by the test harness; summary averages use only pages that passed the quality gate.
- **Expanded site selection** was informed by current high-traffic rankings from [Similarweb](https://www.similarweb.com/top-websites/) and [Semrush](https://www.semrush.com/trending-websites/global/all), plus marketplace traffic context from [Statista](https://www.statista.com/statistics/266203/us-market-share-of-leading-shopping-classifieds-websites/).

## Full Results

> 4 September 2026. SDKs: Firecrawl `4.38.0`, Exa `2.19.0`, Linkup `3.6.0`, Tavily `0.7.8`, Parallel `parallel-web` `1.3.3`.

| Site | tavily | firecrawl | parallel | exa | linkup |
| --- | --- | --- | --- | --- | --- |
| AP News Technology | 2.0s | 1.8s | 0.6s | 1.2s | 4.8s |
| Amazon Product Page | 8.8s | 7.6s | 0.9s | 1.3s | 4.3s |
| Apple iPhone Product | 1.8s | 1.6s | 0.9s | 1.2s | 4.4s |
| BBC Technology News | 1.8s | 1.5s | 0.6s | 1.7s | 5.3s |
| Best Buy Laptop Search | 13.6s | 0.4s | 0.6s | 0.2s | 10.6s |
| Booking.com NYC Hotels | X | 2.9s | 0.7s | X (0.2s) | X |
| CNN World News | 0.1s | 0.8s | 0.4s | 0.3s | 9.3s |
| Craigslist NYC Apartments | 0.4s | X (0.3s) | 0.8s | 0.2s | 6.2s |
| ESPN NBA Scores | 0.1s | X (0.5s) | 0.5s | 0.3s | 4.7s |
| Etsy Handmade Mug Search | X | 2.6s | 0.7s | X (11.3s) | X |
| Facebook NASA Page | 0.2s | X (2.1s) | 0.6s | 0.2s | X (2.1s) |
| GitHub TypeScript README | 0.2s | 0.6s | 0.5s | 0.2s | 1.1s |
| Hacker News Front Page | 0.1s | 0.6s | 0.7s | 0.3s | 0.8s |
| Home Depot Cordless Drill Search | X | 11.1s | 0.5s | X (0.2s) | X |
| IEEE Xplore Technical Paper | 7.6s | X (3.7s) | 0.4s | X (0.3s) | X |
| IMDb Top Movies | 0.4s | 1.1s | 0.6s | 0.6s | X |
| Indeed Product Manager Usa Jobs | X | 13.3s | 0.7s | 0.3s | X |
| Instagram NASA Profile | 0.2s | X (0.3s) | 0.5s | 0.3s | 4.6s |
| Instagram National Geographic Profile | 0.1s | X (0.3s) | 0.4s | X (0.6s) | 3.3s |
| LinkedIn OpenAI Company | 0.1s | X (0.3s) | 0.6s | 0.3s | 0.8s |
| MDN Web API Documentation | 0.2s | 0.6s | 0.4s | 0.2s | 2.2s |
| New York Times Technology | 0.1s | X (2.0s) | 0.5s | 0.3s | 4.6s |
| Nutlope | 0.2s | 3.1s | 0.4s | 0.3s | 1.9s |
| Pinterest Home Decor Ideas | X | X (0.2s) | 0.4s | X (0.3s) | 3.2s |
| PubMed Medical Article | X (36.2s) | X (2.3s) | 0.5s | X (0.2s) | X (2.5s) |
| Realtor.com Property Details | 0.1s | 0.5s | 0.5s | 0.2s | 6.0s |
| Reddit Technology Community | X | X (0.4s) | 0.5s | X (0.3s) | X |
| Redfin Home Listing | 5.0s | 0.6s | 0.4s | 0.3s | 4.7s |
| Reuters Business Article | 0.1s | 0.5s | 0.4s | 0.2s | X |
| Shopify merch store | 4.7s | 3.1s | 0.4s | 0.3s | 3.1s |
| Stack Overflow Question | 9.7s | 4.1s | 0.8s | 0.3s | X |
| Target Wireless Headphones Search | 11.8s | 4.7s | 0.5s | 0.3s | 2.4s |
| Tesla Store Product | X | 17.3s | 0.5s | X (0.2s) | X |
| The Verge Tech News | 0.2s | 0.6s | 0.7s | 0.2s | 4.2s |
| TikTok NASA Profile | 0.2s | X (0.3s) | 0.5s | 0.2s | 1.9s |
| Together AI | 0.2s | 0.5s | 0.5s | 0.3s | 2.9s |
| Tripadvisor NYC Hotels | 0.3s | 0.6s | 0.6s | 0.2s | X |
| Walmart Wireless Headphones Search | X | 7.4s | 0.5s | 0.2s | 8.5s |
| Weather.com New York Forecast | 8.8s | 3.4s | 0.9s | 0.3s | 1.8s |
| Weworkremotely Remote Full Stack Jobs | 3.9s | 0.5s | 0.6s | 0.3s | 6.1s |
| Wikipedia Artificial Intelligence | 0.5s | 1.3s | 0.9s | 0.4s | 5.2s |
| X.com Elon Musk Profile | 0.1s | 4.8s | 0.5s | X (0.2s) | 4.8s |
| X.com Together Compute Profile | 0.2s | 6.7s | 0.4s | X (0.3s) | 2.7s |
| Yelp San Francisco Coffee | X | X (2.1s) | 0.8s | 16.8s | X |
| YouTube TED Channel | X | 0.6s | 1.2s | 0.2s | 0.3s |
| Zillow Condo Listing | 5.7s | 7.0s | 0.5s | 0.2s | X |
| Zillow Single Family Home | 16.9s | 6.2s | 0.6s | 0.3s | X |
| ZipRecruiter Plumber Jobs | X | 2.0s | 0.6s | 0.2s | 7.0s |
| arXiv Computer Science Paper | 1.7s | 1.9s | 0.4s | 1.2s | 3.3s |
| eBay Wireless Headphones Search | X | 9.4s | 1.0s | X (0.3s) | X |
| --- | --- | --- | --- | --- | --- |
| avg usable time | 2.9s | 3.6s | 0.6s | 0.8s | 4.1s |
| usable success | 37/50 | 37/50 | 50/50 | 38/50 | 33/50 |

## Providers

Currently implemented:

- <img src="https://www.google.com/s2/favicons?domain=firecrawl.dev&sz=32" width="16" height="16" alt=""> Firecrawl
- <img src="https://www.google.com/s2/favicons?domain=exa.ai&sz=32" width="16" height="16" alt=""> Exa
- <img src="https://www.google.com/s2/favicons?domain=linkup.so&sz=32" width="16" height="16" alt=""> Linkup
- <img src="https://www.google.com/s2/favicons?domain=tavily.com&sz=32" width="16" height="16" alt=""> Tavily
- <img src="https://www.google.com/s2/favicons?domain=parallel.ai&sz=32" width="16" height="16" alt=""> Parallel Search (official `parallel-web` SDK)

Parallel uses the official [`parallel-web`](https://www.npmjs.com/package/parallel-web) TypeScript SDK and its `extract` endpoint (the REST equivalent of the MCP `web_fetch` tool). The scraper requests `full_content: true` for full-page markdown and falls back to excerpts when full content is empty. Results are cached through the same provider cache wrapper as the other clients. Parallel timing measures the actual extract request window, excluding the client-side concurrency queue wait.

## Getting Started

```bash
git clone https://github.com/riccardogiorato/web-scrapers-evals.git
cd web-scrapers-evals
pnpm install
cp .example.env .env
```

Add the provider keys you want to test:

```env
FIRECRAWL_API_KEY=
EXA_API_KEY=
LINKUP_API_KEY=
TAVILY_API_KEY=
PARALLEL_API_KEY=
```

Run the benchmark:

```bash
pnpm test
```

The custom Vitest reporter prints a provider-by-site table and stores results in `cache/<provider>`.

Parallel is included in the default matrix when `PARALLEL_API_KEY` is set. Requests are capped at 4 concurrent extracts by default; tune with `PARALLEL_MAX_CONCURRENCY`.

## How Success Is Scored

A scrape must pass both checks:

1. The provider returns content without an error.
2. The content passes `evaluateScrapedContent`, which checks:
   - minimum content length
   - obvious blocked/error-page language
   - relevance to the expected URL/site tokens

This is intentionally stricter than "did the API return text?" because LLMs need relevant context, not just bytes.

## Contributing

Good contributions:

- Add another scraper provider.
- Add new hard URLs.
- Improve the quality evaluator.
- Add cost/credit tracking.
- Split results by category.
- Add a CI-friendly benchmark mode.

Provider integrations live in `src/lib/scraperClients.ts`; test fixtures live in `src/lib/testSites.ts`.

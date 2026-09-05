# SurfBench Results — 5 September 2026 run

Canonical data: [`summary.json`](summary.json). Raw run records (`raw/*.jsonl`) stay local (they carry full page content and are gitignored).

## Scrape Event — 50 real, messy URLs (bot-prevention obstacle course)

| provider | usable success | avg usable | p50 | p95 |
|---|---|---|---|---|
| <img src="https://www.google.com/s2/favicons?domain=parallel.ai&sz=32" width="16" height="16" alt=""> **parallel** | **50/50** | **0.6s** | 0.5s | 0.9s |
| <img src="https://www.google.com/s2/favicons?domain=exa.ai&sz=32" width="16" height="16" alt=""> exa | 38/50 | 0.8s | 0.3s | 1.4s |
| <img src="https://www.google.com/s2/favicons?domain=firecrawl.dev&sz=32" width="16" height="16" alt=""> firecrawl | 37/50 | 3.6s | 1.9s | 11.5s |
| <img src="https://www.google.com/s2/favicons?domain=tavily.com&sz=32" width="16" height="16" alt=""> tavily | 37/50 | 2.9s | 0.3s | 12.2s |
| <img src="https://www.google.com/s2/favicons?domain=keenable.ai&sz=32" width="16" height="16" alt=""> keenable | 36/50 | 1.7s | 1.4s | 5.1s |
| <img src="https://www.google.com/s2/favicons?domain=linkup.so&sz=32" width="16" height="16" alt=""> linkup | 33/50 | 4.1s | 4.3s | 8.8s |
| <img src="https://www.google.com/s2/favicons?domain=jina.ai&sz=32" width="16" height="16" alt=""> jina | 33/50 | 11.9s | 8.8s | 39.2s |

**Takeaway**: parallel is the only provider with full coverage — and it's fast (p95 0.9s). Tavily has the quickest p50 but misses the hardest pages. Jina is the slowest leg on the board. Keenable is the surprise of this run: 36/50 with the second-best p95 (5.1s) behind parallel — it fetches X.com and LinkedIn profiles that defeat most providers (its index holds social pages the others can't render), but its live fallback gets 403'd by Etsy/Yelp/Zillow/ZipRecruiter and its indexed copy is wrong/stale on PubMed and arXiv.

**Where exa's 12 misses come from** (all quality-gate rejections, not crashes):

| failure kind | count | sites |
|---|---|---|
| empty/tiny stub (JS-heavy or bot-guarded page shell returned instead of rendered content) | 10 | eBay, Etsy, Home Depot, Pinterest, Reddit, X.com ×2, Tesla ("Powered and protected by Privacy"), Booking.com, Instagram |
| login wall ("sign in to continue") | 1 | IEEE Xplore |
| wrong/irrelevant content | 1 | PubMed |

By category: 5 social, 4 ecommerce, 2 academic, 1 other — exa's misses concentrate exactly on bot-prevention-heavy sites. Its 0.3s p50 is partly *because* it gives up fast on hard pages.

## Search Event — 29 queries × 12 quality dims

| provider | quality assertions passed | API success | p50 | p95 |
|---|---|---|---|---|
| <img src="https://www.google.com/s2/favicons?domain=exa.ai&sz=32" width="16" height="16" alt=""> **exa** | **28/29** | 97% | 1.6s | 2.3s |
| <img src="https://www.google.com/s2/favicons?domain=parallel.ai&sz=32" width="16" height="16" alt=""> parallel | 28/29 | 100% | 2.4s | 4.4s |
| <img src="https://www.google.com/s2/favicons?domain=brave.com&sz=32" width="16" height="16" alt=""> brave | 27/29 | 100% | **0.8s** | 3.4s |
| <img src="https://www.google.com/s2/favicons?domain=firecrawl.dev&sz=32" width="16" height="16" alt=""> firecrawl | 27/29 | 100% | 2.0s | 4.6s |
| <img src="https://www.google.com/s2/favicons?domain=keenable.ai&sz=32" width="16" height="16" alt=""> keenable | 27/29 | 100% | 1.5s | 3.7s |
| <img src="https://www.google.com/s2/favicons?domain=tavily.com&sz=32" width="16" height="16" alt=""> tavily | 25/29 | 100% | 2.3s | 3.9s |
| <img src="https://www.google.com/s2/favicons?domain=linkup.so&sz=32" width="16" height="16" alt=""> linkup | 20/29 | 100% | 1.7s | 2.8s |

**Takeaway**: each cell counts deterministic quality assertions passed out of 29 queries (12 dims: factuality, recency, diversity, entity disambiguation, intent, multilingual, spam, safe-search, citation, link quality, brand homepage, latency — e.g. "does `Apple` return apple.com"). Every provider API-returned results for ~all queries; the differences are in result *quality*. exa leads (28/29); brave is the fastest (0.8s p50); keenable debuts at 27/29 with the second-best p50 (1.5s), missing only citation quality and the `Jaguar` intent disambiguation; linkup trails badly (20/29 — 9 misses across entity disambiguation, factuality, safe-search). Serper is implemented but key-gated (no key yet).

## Quest Event — 15 questions × (search → fetch → judge)

| provider | answered | avg total | p50 | wipeouts | judge |
|---|---|---|---|---|---|
| <img src="https://www.google.com/s2/favicons?domain=exa.ai&sz=32" width="16" height="16" alt=""> **exa** | 15/15 | **7.7s** | 7.9s | 0 | 8.0 |
| <img src="https://www.google.com/s2/favicons?domain=keenable.ai&sz=32" width="16" height="16" alt=""> keenable | 15/15 | 10.3s | 11.4s | 0 | **8.3** |
| <img src="https://www.google.com/s2/favicons?domain=firecrawl.dev&sz=32" width="16" height="16" alt=""> firecrawl | 15/15 | 11.5s | 10.9s | 0 | 7.0 |
| <img src="https://www.google.com/s2/favicons?domain=linkup.so&sz=32" width="16" height="16" alt=""> linkup | 14/15 | 29.3s | 29.7s | 0 | 6.9 |
| <img src="https://www.google.com/s2/favicons?domain=tavily.com&sz=32" width="16" height="16" alt=""> tavily | 15/15 | 24.2s | 25.5s | 0 | 6.7 |
| <img src="https://www.google.com/s2/favicons?domain=parallel.ai&sz=32" width="16" height="16" alt=""> parallel | 15/15 | 36.7s | 38.1s | 0 | 7.1 |

**Takeaway**: exa is the fastest full quest (7.7s); keenable takes the top judge score (8.3) at 10.3s — its search leg finds pages its own index can serve instantly, so the whole loop stays fast. parallel, despite the best scrape leg, is the slowest full quest (36.7s) — its search leg is the slowest. Keenable's one low score is q9 (2.0 — its top-3 results didn't cover the answer); one keenable verdict was flagged (judges disagreed by >2). Linkup dropped one quest.

## Suggested combos

| Use case | Combo | Why |
|---|---|---|
| **Best overall agent stack** | **brave search + parallel fetch** | Brave is the fastest search (0.8s p50); parallel is the only 100% fetch coverage (50/50) at the fastest usable time (0.6s avg). |
| **Fastest single-vendor stack** | exa search + exa fetch | 1.6s search + 0.3s p50 fetch, one key, one SDK. |
| **Best single-vendor free stack** | keenable search + keenable fetch | One key covers both legs; 100,000 free requests/month (≈1 credit per search or fetch) — enough for ~50k agent quests. Top quest judge (8.3), 36/50 on the gauntlet. |
| **Cheapest paid stack** | brave search + jina reader | free tiers on both legs (brave 2k/mo, jina free tier). |
| **Max quality gate survival** | firecrawl search + parallel fetch | firecrawl search 100% assertion pass + parallel 100% fetch coverage. |

## How Success Is Scored

A result passes only if the provider returned content that:

1. is not an error, and
2. passes `evaluateScrapedContent`: minimum length (120 chars), no blocked/error-page language, and relevance to the expected page tokens.

This is stricter than "did the API return text?" — LLMs need relevant context, not just bytes.

## Methodology

- **Scrape**: 50 real URLs across jobs, real estate, social, academic, news, technical docs, marketplaces, e-commerce, local/travel.
- **Search**: 29 queries across 12 quality dimensions (factuality, recency, diversity, entity disambiguation, intent, multilingual, spam, safe-search, citation & link quality, brand homepage, latency). Assertions are deterministic (expected domains/tokens), no LLM judging.
- **Quest**: 15 graded questions per provider (both legs same vendor) — search → top-3 → extract → assemble; judge panel scores whether the answer is present; 30s-per-leg wipeout rule.
- **Timing**: provider-reported scrape times; search/quest timings are wall-clock; p50/p95 per provider.
- **Judges**: Kimi K3 + GLM-5.3 via Together AI — `grade(question, content) → {score 0-10, rationale}`; verdicts cached by content hash; disagreement > 2 points flagged; a failed judge call never counts as a 0-quality vote.
- **Concurrency**: capped at 5 in-flight per provider (parallel at 4), matching earlier runs.
- **Keenable** (added 5 September): REST client for search + fetch. Its fetch serves Keenable's indexed copy by default and errors on non-indexed URLs, so the scraper falls back to `live=true` (fetch from source) — mirroring the index-first/live-fallback setup of exa (`livecrawl: "fallback"`) and firecrawl (`maxAge`). Keenable rate-limits to 10 requests/second per organization, so all its calls go through one client-side paced gate (~9 req/s, 4 in flight) with 429 backoff; its timings include that pacing. Search mode is server-decided per call (came back `pro`). Pricing: 1 credit = 1 search or 1 fetch, 100,000 free requests/month (credit packages are bought in the console, no public list price).

## Data integrity note

The first judge pass under-scored every provider: Kimi K3 ran with a mis-configured reasoning flag (empty replies recorded as 0), and stale cache entries amplified it. All affected records were re-graded with both judges healthy; judge averages above come from the corrected pass. Two parallel quests still score 0–1 legitimately (GitHub-trending shell content, cookie-consent page) — that's real quality signal, not an artifact.

## Data files

- `summary.json` — everything: per-event rows + overall agent-ready composite (scrape/search/quest scores all on one 0–100 scale; overall = mean of the three).
- `raw/*.jsonl` (local only) — one record per provider×case, redacted, deduped-by-latest.
# SurfBench v2 — run 2026-10-22T16-00-frozen

50 tasks · 8 providers · live tasks × 3 rounds · fixed pipeline: search top 5 → fetch top 3 · reader `MiniMaxAI/MiniMax-M3` · judges Kimi K3 + GLM-5.3 (live-judge constraints only).

## Leaderboard

Providers in the same **group** are statistically tied (the 95% paired-bootstrap CI of their gap includes 0).

| group | provider | overall (95% CI) | quality | pass rate | p50 | $ / 1k passed tasks |
|---|---|---|---|---|---|---|
| 1 | **exa-fast** | 70.6 (60.9–79.9) | 70.6 | 58.0% | 1.0s | $15.74 |
| 1 | **parallel** | 69.3 (60.3–76.9) | 81.3 | 69.3% | 3.6s | $10.59 |
| 2 | **exa** | 65.4 (55.7–75.1) | 71.3 | 58.0% | 1.7s | $15.74 |
| 2 | **firecrawl** | 64.1 (53.1–74.0) | 68.2 | 62.0% | 1.9s | $9.18 |
| 2 | **parallel-turbo** | 62.0 (51.8–71.2) | 69.0 | 58.7% | 2.3s | $6.27 |
| 2 | **tavily** | 61.2 (50.7–71.2) | 65.9 | 56.7% | 1.9s | $28.13 |
| 2 | **keenable** | 57.5 (47.4–66.9) | 68.7 | 55.3% | 6.3s | $24.55 |
| 3 | **linkup** | 49.9 (39.2–60.4) | 56.9 | 50.7% | 4.3s | $31.19 |

## Quality by tier

| provider | stable-read | stable-lookup | live-feed | live-judge |
|---|---|---|---|---|
| exa-fast | 65.0 | 100.0 | 55.0 | 63.8 |
| parallel | 81.7 | 100.0 | 70.0 | 75.5 |
| exa | 65.0 | 100.0 | 55.0 | 65.8 |
| firecrawl | 61.7 | 91.7 | 67.2 | 55.3 |
| parallel-turbo | 81.7 | 83.3 | 60.0 | 57.0 |
| tavily | 85.0 | 83.3 | 43.3 | 57.7 |
| keenable | 61.7 | 100.0 | 57.2 | 58.1 |
| linkup | 75.0 | 100.0 | 33.1 | 31.3 |

## Access matrix

Passed / attempts per target site, across its tasks and rounds.

| site | exa-fast | parallel | exa | firecrawl | parallel-turbo | tavily | keenable | linkup |
|---|---|---|---|---|---|---|---|---|
| instagram.com | ✗ 0/4 | ✓ 4/4 | ✗ 0/4 | ✗ 0/4 | ✓ 4/4 | ~ 1/4 | ✓ 4/4 | ~ 1/4 |
| x.com | ✗ 0/7 | ✓ 7/7 | ✗ 0/7 | ✓ 7/7 | ~ 4/7 | ✓ 7/7 | ~ 4/7 | ~ 1/7 |
| nytimes.com | ✗ 0/4 | ✗ 0/4 | ✗ 0/4 | ✗ 0/4 | ✗ 0/4 | ~ 1/4 | ✗ 0/4 | ✗ 0/4 |
| bbc.com | ✓ 4/4 | ~ 3/4 | ✓ 4/4 | ✓ 4/4 | ~ 2/4 | ✓ 4/4 | ~ 3/4 | ✓ 4/4 |
| amazon.com | ✓ 7/7 | ~ 2/7 | ~ 4/7 | ✓ 7/7 | ~ 4/7 | ~ 3/7 | ~ 4/7 | ~ 6/7 |
| target.com | ✗ 0/1 | ✗ 0/1 | ✗ 0/1 | ✗ 0/1 | ✗ 0/1 | ✗ 0/1 | ✗ 0/1 | ✗ 0/1 |
| homedepot.com | ✓ 1/1 | ✗ 0/1 | ✓ 1/1 | ✗ 0/1 | ✗ 0/1 | ✓ 1/1 | ✗ 0/1 | ✗ 0/1 |
| youtube.com | ✗ 0/4 | ✓ 4/4 | ✗ 0/4 | ✓ 4/4 | ✓ 4/4 | ~ 2/4 | ~ 1/4 | ~ 1/4 |
| linkedin.com | ✓ 4/4 | ~ 1/4 | ✓ 4/4 | ✗ 0/4 | ~ 1/4 | ✓ 4/4 | ~ 3/4 | ~ 1/4 |
| arxiv.org | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✗ 0/1 | ✓ 1/1 |
| imdb.com | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✗ 0/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 |
| delta.com | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✗ 0/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 |
| britishmuseum.org | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 |
| stackoverflow.com | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✗ 0/1 | ✓ 1/1 | ✗ 0/1 | ✓ 1/1 | ✓ 1/1 |
| walmart.com | ~ 1/4 | ~ 1/4 | ~ 1/4 | ~ 1/4 | ~ 1/4 | ~ 1/4 | ~ 1/4 | ~ 1/4 |
| github.com | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 |
| wikipedia.org | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ~ 1/4 | ~ 1/4 | ✓ 4/4 | ~ 2/4 |
| reddit.com | ✗ 0/6 | ~ 5/6 | ✗ 0/6 | ✗ 0/6 | ✓ 6/6 | ✗ 0/6 | ✗ 0/6 | ✗ 0/6 |
| news.ycombinator.com | ✓ 3/3 | ~ 1/3 | ✓ 3/3 | ✓ 3/3 | ~ 2/3 | ✗ 0/3 | ✓ 3/3 | ✗ 0/3 |
| lemonde.fr | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✓ 3/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 |
| spiegel.de | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 |
| facebook.com | ✗ 0/3 | ~ 1/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 |
| tiktok.com | ✗ 0/3 | ~ 2/3 | ✗ 0/3 | ✗ 0/3 | ~ 1/3 | ✓ 3/3 | ✗ 0/3 | ✗ 0/3 |
| ebay.com | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✗ 0/3 | ✓ 3/3 | ~ 1/3 |
| bestbuy.com | ✗ 0/3 | ✓ 3/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 |
| zillow.com | ✓ 3/3 | ~ 1/3 | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✗ 0/3 | ✓ 3/3 |
| craigslist.org | ✗ 0/3 | ✓ 3/3 | ✗ 0/3 | ✗ 0/3 | ✓ 3/3 | ✗ 0/3 | ~ 1/3 | ✗ 0/3 |
| airbnb.com | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 |
| espn.com | ✗ 0/3 | ✗ 0/3 | ✓ 3/3 | ✓ 3/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 |
| mercadolibre.com.mx | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 |

## How to read this

- **quality** = mean task score (0–100, partial credit); **pass rate** = share of tasks scoring ≥ 80% (live tasks must also come from the named site, and live-judge tasks must be fresh). Repeated rounds are averaged per task.
- **overall** = 0.50 quality + 0.35 pass rate + 0.15 speed (p50 vs. the fastest provider, floored at 25).
- **$ / 1k passed tasks** = list-price spend for one pass over the task set ÷ tasks passed × 1000. Not part of the score. Prices and sources are in `manifest.json`.
- **Live tasks are a snapshot.** Compare providers within this run, never across runs. live-judge tasks have no ground truth: the panel checks explicit constraints.
- Every task's verdict, reader answer, judge evidence, source URLs and a redacted excerpt are in `evidence.json`.

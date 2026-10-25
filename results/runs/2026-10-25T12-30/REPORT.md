# SurfBench v2 — run 2026-10-25T12-30

84 tasks · 10 providers · live tasks × 3 rounds · fixed pipeline: search top 5 → fetch top 3 · reader `MiniMaxAI/MiniMax-M3` · judges Kimi K3 + GLM-5.3 (live-judge constraints only).

## Leaderboard

Providers in the same **group** are statistically tied (the 95% paired-bootstrap CI of their gap includes 0).

| group | provider | overall (95% CI) | search (85%) | access (15%) | quality | pass rate | p50 | $ / 1k passed tasks |
|---|---|---|---|---|---|---|---|---|
| 1 | **exa-fast** | 82.3 (77.1–86.8) | 87.0 | 56.1 | 90.1 | 83.8% | 0.8s | $12.66 |
| 1 | **perplexity-fast** | 80.9 (72.8–88.1) | 83.0 | 69.0 | 81.6 | 74.5% | 0.3s | $1.42 |
| 1 | **perplexity** | 79.9 (71.6–87.1) | 81.9 | 68.3 | 81.7 | 74.5% | 0.3s | $7.12 |
| 2 | **exa** | 79.3 (73.0–84.8) | 83.8 | 53.7 | 87.1 | 81.7% | 1.4s | $13.08 |
| 2 | **parallel** | 77.9 (70.5–84.2) | 80.5 | 63.2 | 85.7 | 80.7% | 2.8s | $10.02 |
| 2 | **keenable** | 76.6 (70.5–82.2) | 81.6 | 48.1 | 85.8 | 76.9% | 3.3s | $21.34 |
| 3 | **firecrawl** | 71.0 (63.5–77.9) | 75.2 | 47.5 | 79.8 | 70.4% | 3.2s | $9.34 |
| 3 | **linkup** | 66.6 (57.8–74.6) | 71.2 | 40.5 | 74.2 | 66.4% | 3.7s | $29.19 |
| 3 | **tavily** | 66.2 (57.0–74.7) | 69.0 | 50.8 | 73.9 | 66.0% | 2.4s | $25.70 |
| 3 | **parallel-turbo** | 64.5 (55.3–73.0) | 67.3 | 49.0 | 72.3 | 63.5% | 1.7s | $6.63 |

## Quality by tier

| provider | stable-read | stable-lookup | live-feed | live-judge |
|---|---|---|---|---|
| exa-fast | 65.0 | 96.7 | 67.8 | 70.6 |
| perplexity-fast | 85.0 | 88.0 | 45.8 | 72.6 |
| perplexity | 85.0 | 88.0 | 45.8 | 74.2 |
| exa | 65.0 | 93.5 | 66.1 | 65.9 |
| parallel | 76.7 | 94.6 | 48.9 | 77.7 |
| keenable | 68.3 | 93.8 | 50.6 | 62.8 |
| firecrawl | 61.7 | 84.8 | 63.3 | 55.9 |
| linkup | 75.0 | 88.0 | 22.2 | 34.8 |
| tavily | 88.3 | 82.6 | 30.8 | 50.2 |
| parallel-turbo | 76.7 | 83.7 | 21.7 | 58.1 |

## Access matrix

Passed / attempts per target site, across its tasks and rounds.

| site | exa-fast | perplexity-fast | perplexity | exa | parallel | keenable | firecrawl | linkup | tavily | parallel-turbo |
|---|---|---|---|---|---|---|---|---|---|---|
| instagram.com | ✗ 0/4 | ✗ 0/4 | ✗ 0/4 | ✗ 0/4 | ✓ 4/4 | ~ 3/4 | ✗ 0/4 | ~ 1/4 | ~ 1/2 | ✓ 4/4 |
| x.com | ✗ 0/7 | ✓ 7/7 | ✓ 7/7 | ✗ 0/7 | ✓ 7/7 | ✓ 7/7 | ✓ 7/7 | ~ 2/7 | ✓ 3/3 | ~ 1/7 |
| nytimes.com | ✗ 0/4 | ~ 1/4 | ~ 1/4 | ✗ 0/4 | ✗ 0/4 | ✗ 0/4 | ✗ 0/4 | ✗ 0/4 | ~ 1/2 | ✗ 0/4 |
| bbc.com | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ✗ 0/4 | ~ 3/4 | ✓ 4/4 | ✓ 4/4 | ✓ 2/2 | ✗ 0/4 |
| amazon.com | ✓ 7/7 | ✓ 7/7 | ✓ 7/7 | ✓ 7/7 | ~ 2/7 | ~ 4/7 | ✓ 7/7 | ~ 5/7 | ~ 1/3 | ~ 4/7 |
| target.com | ✗ 0/1 | ✓ 1/1 | ✓ 1/1 | ✗ 0/1 | ✗ 0/1 | ✗ 0/1 | ✗ 0/1 | ✗ 0/1 | ✗ 0/1 | ✗ 0/1 |
| homedepot.com | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✗ 0/1 | ✗ 0/1 | ✗ 0/1 | ✗ 0/1 | ✓ 1/1 | ✗ 0/1 |
| youtube.com | ✗ 0/4 | ✗ 0/4 | ✗ 0/4 | ✗ 0/4 | ✓ 4/4 | ~ 1/4 | ✓ 4/4 | ~ 1/4 | ~ 1/2 | ~ 1/4 |
| linkedin.com | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ~ 1/4 | ~ 3/4 | ✗ 0/4 | ~ 1/4 | ✓ 2/2 | ~ 1/4 |
| arxiv.org | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✗ 0/1 | ✓ 1/1 | ✓ 1/1 | ✗ 0/1 | ✓ 1/1 |
| imdb.com | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 |
| delta.com | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✗ 0/1 |
| britishmuseum.org | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✗ 0/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 |
| stackoverflow.com | ✓ 1/1 | ✗ 0/1 | ✗ 0/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✗ 0/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 |
| walmart.com | ✓ 4/4 | ~ 1/4 | ~ 1/4 | ✓ 4/4 | ~ 1/4 | ~ 1/4 | ~ 1/4 | ~ 1/4 | ~ 1/2 | ~ 1/4 |
| github.com | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ✓ 2/2 | ✓ 4/4 |
| wikipedia.org | ✓ 4/4 | ~ 1/4 | ~ 1/4 | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ~ 1/4 | ~ 1/2 | ~ 1/4 |
| reddit.com | ✗ 0/6 | ✗ 0/6 | ✗ 0/6 | ✗ 0/6 | ✗ 0/6 | ✗ 0/6 | ✗ 0/6 | ✗ 0/6 | ✗ 0/2 | ✗ 0/6 |
| news.ycombinator.com | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ~ 2/3 | ✓ 3/3 | ✗ 0/3 | ✗ 0/1 | ✗ 0/3 |
| lemonde.fr | ✓ 3/3 | ✗ 0/3 | ✗ 0/3 | ✓ 3/3 | ✗ 0/3 | ~ 2/3 | ✓ 3/3 | ✗ 0/3 | ✓ 1/1 | ✗ 0/3 |
| spiegel.de | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✓ 3/3 | ✗ 0/3 | ✗ 0/1 | ✗ 0/3 |
| facebook.com | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✓ 3/3 | ✗ 0/3 | ✗ 0/3 | ~ 1/3 | ✗ 0/1 | ✗ 0/3 |
| tiktok.com | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✓ 3/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/1 | ✗ 0/3 |
| ebay.com | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ~ 1/3 | ✗ 0/1 | ✓ 3/3 |
| bestbuy.com | ✗ 0/3 | ✓ 3/3 | ✓ 3/3 | ✗ 0/3 | ~ 1/3 | ~ 2/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/1 | ✗ 0/3 |
| zillow.com | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✗ 0/3 | ✓ 3/3 | ✓ 3/3 | — | ✓ 3/3 |
| craigslist.org | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✓ 3/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/1 | ✗ 0/3 |
| airbnb.com | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | — | ✗ 0/3 |
| espn.com | ✓ 3/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | — | ✗ 0/3 |
| mercadolibre.com.mx | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | — | ✓ 3/3 |

## How to read this

- **quality** = mean task score (0–100, partial credit); **pass rate** = share of tasks scoring ≥ 80% (live tasks must also come from the named site, and live-judge tasks must be fresh). Repeated rounds are averaged per task.
- **Tracks.** search (53 tasks), access (31 tasks). Search = find the answer on the open web; access = open a given page or reach a named bot-walled site. Each track's score = 0.55 quality + 0.35 pass rate + 0.1 speed (p50 vs. the fastest provider in that track, floored at 25).
- **overall** = 0.85 × search + 0.15 × access. quality and pass rate above are track-weighted the same way. A provider needs ≥ 80% of each track's tasks scorable to get a number.
- **$ / 1k passed tasks** = list-price spend for one pass over the task set ÷ tasks passed × 1000. Not part of the score. Prices and sources are in `manifest.json`.
- **Live tasks are a snapshot.** Compare providers within this run, never across runs. live-judge tasks have no ground truth: the panel checks explicit constraints.
- Every task's verdict, reader answer, judge evidence, source URLs and a redacted excerpt are in `evidence.json`.

# SurfBench v2 — run 2026-10-25T12-30

84 tasks · 10 providers · live tasks × 3 rounds · fixed pipeline: search top 5 → fetch top 3 · reader `MiniMaxAI/MiniMax-M3` · judges Kimi K3 + GLM-5.3 (live-judge constraints only).

## Leaderboard

Providers in the same **group** are statistically tied (the 95% paired-bootstrap CI of their gap includes 0).

| group | provider | overall (95% CI) | search (85%) | access (15%) | quality | pass rate | p50 | $ / 1k passed tasks |
|---|---|---|---|---|---|---|---|---|
| 1 | **perplexity-fast** | 84.2 (76.9–90.5) | 86.5 | 71.0 | 83.9 | 77.7% | 0.3s | $1.38 |
| 2 | **perplexity** | 81.3 (73.3–88.1) | 83.3 | 69.9 | 82.6 | 76.1% | 0.3s | $7.00 |
| 2 | **exa-fast** | 79.5 (74.5–83.8) | 83.9 | 54.7 | 90.1 | 83.8% | 0.8s | $12.66 |
| 2 | **exa** | 76.6 (70.8–81.6) | 80.8 | 52.8 | 87.3 | 82.2% | 1.4s | $13.01 |
| 3 | **parallel** | 74.7 (67.8–80.7) | 77.3 | 60.1 | 85.6 | 80.6% | 2.8s | $10.08 |
| 3 | **keenable** | 73.6 (67.9–79.0) | 78.3 | 47.0 | 85.9 | 76.9% | 3.3s | $21.34 |
| 3 | **firecrawl** | 68.3 (61.0–74.9) | 72.2 | 45.9 | 79.8 | 70.4% | 3.2s | $9.34 |
| 4 | **linkup** | 64.1 (55.7–71.7) | 68.5 | 39.3 | 74.2 | 66.4% | 3.7s | $29.19 |
| 4 | **tavily** | 63.9 (55.2–71.9) | 66.4 | 49.7 | 74.1 | 66.0% | 2.4s | $25.70 |
| 4 | **parallel-turbo** | 62.2 (53.6–70.2) | 64.8 | 47.7 | 72.5 | 63.5% | 1.7s | $6.63 |

## Quality by tier

| provider | stable-read | stable-lookup | live-feed | live-judge |
|---|---|---|---|---|
| perplexity-fast | 85.0 | 91.3 | 47.5 | 72.4 |
| perplexity | 85.0 | 89.1 | 48.6 | 74.5 |
| exa-fast | 65.0 | 96.7 | 67.8 | 69.8 |
| exa | 65.0 | 93.5 | 67.2 | 66.2 |
| parallel | 76.7 | 94.6 | 48.9 | 76.5 |
| keenable | 68.3 | 93.8 | 51.7 | 64.1 |
| firecrawl | 61.7 | 84.8 | 63.3 | 55.3 |
| linkup | 75.0 | 88.0 | 22.2 | 34.1 |
| tavily | 91.7 | 82.6 | 30.8 | 50.2 |
| parallel-turbo | 76.7 | 83.7 | 23.9 | 58.3 |

## Access matrix

Passed / attempts per target site, across its tasks and rounds.

| site | perplexity-fast | perplexity | exa-fast | exa | parallel | keenable | firecrawl | linkup | tavily | parallel-turbo |
|---|---|---|---|---|---|---|---|---|---|---|
| instagram.com | ✗ 0/4 | ✗ 0/4 | ✗ 0/4 | ✗ 0/4 | ✓ 4/4 | ~ 3/4 | ✗ 0/4 | ~ 1/4 | ~ 1/2 | ✓ 4/4 |
| x.com | ✓ 7/7 | ✓ 7/7 | ✗ 0/7 | ✗ 0/7 | ✓ 7/7 | ✓ 7/7 | ✓ 7/7 | ~ 2/7 | ✓ 3/3 | ~ 1/7 |
| nytimes.com | ~ 1/4 | ~ 1/4 | ✗ 0/4 | ✗ 0/4 | ✗ 0/4 | ✗ 0/4 | ✗ 0/4 | ✗ 0/4 | ~ 1/2 | ✗ 0/4 |
| bbc.com | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ✗ 0/4 | ~ 3/4 | ✓ 4/4 | ✓ 4/4 | ✓ 2/2 | ✗ 0/4 |
| amazon.com | ✓ 7/7 | ✓ 7/7 | ✓ 7/7 | ✓ 7/7 | ~ 2/7 | ~ 4/7 | ✓ 7/7 | ~ 5/7 | ~ 1/3 | ~ 4/7 |
| target.com | ✓ 1/1 | ✓ 1/1 | ✗ 0/1 | ✗ 0/1 | ✗ 0/1 | ✗ 0/1 | ✗ 0/1 | ✗ 0/1 | ✗ 0/1 | ✗ 0/1 |
| homedepot.com | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✗ 0/1 | ✗ 0/1 | ✗ 0/1 | ✗ 0/1 | ✓ 1/1 | ✗ 0/1 |
| youtube.com | ✗ 0/4 | ✗ 0/4 | ✗ 0/4 | ✗ 0/4 | ✓ 4/4 | ~ 1/4 | ✓ 4/4 | ~ 1/4 | ~ 1/2 | ~ 1/4 |
| linkedin.com | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ~ 1/4 | ~ 3/4 | ✗ 0/4 | ~ 1/4 | ✓ 2/2 | ~ 1/4 |
| arxiv.org | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✗ 0/1 | ✓ 1/1 | ✓ 1/1 | ✗ 0/1 | ✓ 1/1 |
| imdb.com | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 |
| delta.com | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✗ 0/1 |
| britishmuseum.org | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✗ 0/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 |
| stackoverflow.com | ✓ 1/1 | ✗ 0/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✗ 0/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 |
| walmart.com | ~ 1/4 | ~ 1/4 | ✓ 4/4 | ✓ 4/4 | ~ 1/4 | ~ 1/4 | ~ 1/4 | ~ 1/4 | ~ 1/2 | ~ 1/4 |
| github.com | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ✓ 2/2 | ✓ 4/4 |
| wikipedia.org | ~ 1/4 | ~ 1/4 | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ~ 1/4 | ~ 1/2 | ~ 1/4 |
| reddit.com | ✗ 0/6 | ✗ 0/6 | ✗ 0/6 | ✗ 0/6 | ✗ 0/6 | ✗ 0/6 | ✗ 0/6 | ✗ 0/6 | ✗ 0/2 | ✗ 0/6 |
| news.ycombinator.com | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ~ 2/3 | ✓ 3/3 | ✗ 0/3 | ✗ 0/1 | ✗ 0/3 |
| lemonde.fr | ✗ 0/3 | ✗ 0/3 | ✓ 3/3 | ✓ 3/3 | ✗ 0/3 | ~ 2/3 | ✓ 3/3 | ✗ 0/3 | ✓ 1/1 | ✗ 0/3 |
| spiegel.de | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ~ 1/3 | ✗ 0/3 | ✗ 0/3 | ✓ 3/3 | ✗ 0/3 | ✗ 0/1 | ✗ 0/3 |
| facebook.com | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✓ 3/3 | ✗ 0/3 | ✗ 0/3 | ~ 1/3 | ✗ 0/1 | ✗ 0/3 |
| tiktok.com | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ~ 2/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/1 | ✗ 0/3 |
| ebay.com | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ~ 1/3 | ✗ 0/1 | ✓ 3/3 |
| bestbuy.com | ✓ 3/3 | ✓ 3/3 | ✗ 0/3 | ✗ 0/3 | ~ 1/3 | ~ 2/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/1 | ✗ 0/3 |
| zillow.com | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✗ 0/3 | ✓ 3/3 | ✓ 3/3 | — | ✓ 3/3 |
| craigslist.org | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✓ 3/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/1 | ✗ 0/3 |
| airbnb.com | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | — | ✗ 0/3 |
| espn.com | ✗ 0/3 | ✗ 0/3 | ✓ 3/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | — | ✗ 0/3 |
| mercadolibre.com.mx | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | — | ✓ 3/3 |

## How to read this

- **quality** = mean task score (0–100, partial credit); **pass rate** = share of tasks scoring ≥ 80% (live tasks must also come from the named site, and live-judge tasks must be fresh). Repeated rounds are averaged per task.
- **Tracks.** search (53 tasks), access (31 tasks). Search = find the answer on the open web; access = open a given page or reach a named bot-walled site. Each track's score = 0.50 quality + 0.35 pass rate + 0.15 speed (p50 vs. the fastest provider in that track, floored at 25).
- **overall** = 0.85 × search + 0.15 × access. quality and pass rate above are track-weighted the same way. A provider needs ≥ 80% of each track's tasks scorable to get a number.
- **$ / 1k passed tasks** = list-price spend for one pass over the task set ÷ tasks passed × 1000. Not part of the score. Prices and sources are in `manifest.json`.
- **Live tasks are a snapshot.** Compare providers within this run, never across runs. live-judge tasks have no ground truth: the panel checks explicit constraints.
- Every task's verdict, reader answer, judge evidence, source URLs and a redacted excerpt are in `evidence.json`.

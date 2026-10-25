# SurfBench v2 — run 2026-10-25T12-30

84 tasks · 10 providers · live tasks × 3 rounds · fixed pipeline: search top 5 → fetch top 3 · reader `MiniMaxAI/MiniMax-M3` · judges Kimi K3 + GLM-5.3 (live-judge constraints only).

## Leaderboard

Providers in the same **group** are statistically tied (the 95% paired-bootstrap CI of their gap includes 0).

| group | provider | overall (95% CI) | search (85%) | access (15%) | quality | pass rate | p50 | $ / 1k passed tasks |
|---|---|---|---|---|---|---|---|---|
| 1 | **perplexity-fast** | 80.8 (72.5–88.0) | 83.0 | 67.9 | 81.3 | 74.5% | 0.3s | $1.42 |
| 2 | **perplexity** | 79.7 (71.2–86.9) | 81.9 | 66.8 | 81.3 | 74.5% | 0.3s | $7.12 |
| 2 | **exa-fast** | 79.2 (72.3–84.8) | 83.6 | 54.4 | 86.4 | 80.5% | 0.8s | $13.08 |
| 2 | **parallel** | 77.9 (70.6–84.3) | 80.5 | 63.5 | 85.8 | 80.7% | 2.8s | $10.02 |
| 2 | **keenable** | 76.5 (70.4–82.1) | 81.6 | 47.5 | 85.6 | 76.9% | 3.3s | $21.34 |
| 2 | **exa** | 75.8 (68.4–82.3) | 80.1 | 51.4 | 83.1 | 77.9% | 1.4s | $13.61 |
| 3 | **firecrawl** | 71.3 (63.6–78.1) | 75.2 | 48.9 | 79.9 | 70.9% | 3.2s | $9.17 |
| 3 | **linkup** | 66.5 (57.7–74.5) | 71.2 | 40.0 | 74.1 | 66.4% | 3.7s | $29.19 |
| 3 | **tavily** | 66.2 (57.0–74.7) | 69.0 | 50.8 | 73.9 | 66.0% | 2.4s | $25.70 |
| 3 | **parallel-turbo** | 64.4 (55.1–73.0) | 67.3 | 48.3 | 72.1 | 63.5% | 1.7s | $6.63 |

## Quality by tier

| provider | stable-read | stable-lookup | live-feed | live-judge |
|---|---|---|---|---|
| perplexity-fast | 85.0 | 88.0 | 38.5 | 76.6 |
| perplexity | 85.0 | 88.0 | 38.5 | 76.6 |
| exa-fast | 65.0 | 96.7 | 47.2 | 68.6 |
| parallel | 76.7 | 94.6 | 49.0 | 80.7 |
| keenable | 68.3 | 93.8 | 46.7 | 64.5 |
| exa | 65.0 | 93.5 | 37.9 | 67.8 |
| firecrawl | 61.7 | 84.8 | 66.2 | 53.8 |
| linkup | 75.0 | 88.0 | 23.1 | 32.7 |
| tavily | 88.3 | 82.6 | 30.8 | 50.2 |
| parallel-turbo | 76.7 | 83.7 | 20.0 | 59.4 |

## Access matrix

Passed / attempts per target site, across its tasks and rounds.

| site | perplexity-fast | perplexity | exa-fast | parallel | keenable | exa | firecrawl | linkup | tavily | parallel-turbo |
|---|---|---|---|---|---|---|---|---|---|---|
| instagram.com | ✗ 0/4 | ✗ 0/4 | ✗ 0/4 | ✓ 4/4 | ~ 3/4 | ✗ 0/4 | ✗ 0/4 | ~ 1/4 | ~ 1/2 | ✓ 4/4 |
| x.com | ✓ 7/7 | ✓ 7/7 | ✗ 0/7 | ✓ 7/7 | ✓ 7/7 | ✗ 0/7 | ✓ 7/7 | ~ 2/7 | ✓ 3/3 | ~ 1/7 |
| nytimes.com | ~ 1/4 | ~ 1/4 | ✗ 0/4 | ✗ 0/4 | ✗ 0/4 | ✗ 0/4 | ✗ 0/4 | ✗ 0/4 | ~ 1/2 | ✗ 0/4 |
| bbc.com | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ✗ 0/4 | ~ 3/4 | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ✓ 2/2 | ✗ 0/4 |
| amazon.com | ✓ 7/7 | ✓ 7/7 | ✓ 7/7 | ~ 2/7 | ~ 4/7 | ✓ 7/7 | ✓ 7/7 | ~ 5/7 | ~ 1/3 | ~ 4/7 |
| target.com | ✓ 1/1 | ✓ 1/1 | ✗ 0/1 | ✗ 0/1 | ✗ 0/1 | ✗ 0/1 | ✗ 0/1 | ✗ 0/1 | ✗ 0/1 | ✗ 0/1 |
| homedepot.com | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✗ 0/1 | ✗ 0/1 | ✓ 1/1 | ✗ 0/1 | ✗ 0/1 | ✓ 1/1 | ✗ 0/1 |
| youtube.com | ✗ 0/4 | ✗ 0/4 | ✗ 0/4 | ✓ 4/4 | ~ 1/4 | ✗ 0/4 | ✓ 4/4 | ~ 1/4 | ~ 1/2 | ~ 1/4 |
| linkedin.com | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ~ 1/4 | ~ 3/4 | ✓ 4/4 | ✗ 0/4 | ~ 1/4 | ✓ 2/2 | ~ 1/4 |
| arxiv.org | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✗ 0/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✗ 0/1 | ✓ 1/1 |
| imdb.com | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 |
| delta.com | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✗ 0/1 |
| britishmuseum.org | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✗ 0/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 |
| stackoverflow.com | ✗ 0/1 | ✗ 0/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✗ 0/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 |
| walmart.com | ~ 1/4 | ~ 1/4 | ✓ 4/4 | ~ 1/4 | ~ 1/4 | ✓ 4/4 | ~ 1/4 | ~ 1/4 | ~ 1/2 | ~ 1/4 |
| github.com | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ✓ 2/2 | ✓ 4/4 |
| wikipedia.org | ~ 1/4 | ~ 1/4 | ~ 1/4 | ✓ 4/4 | ✓ 4/4 | ~ 1/4 | ✓ 4/4 | ~ 1/4 | ~ 1/2 | ~ 1/4 |
| reddit.com | ✗ 0/6 | ✗ 0/6 | ✗ 0/6 | ✗ 0/6 | ✗ 0/6 | ✗ 0/6 | ✗ 0/6 | ✗ 0/6 | ✗ 0/2 | ✗ 0/6 |
| news.ycombinator.com | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ~ 2/3 | ~ 2/3 | ✓ 3/3 | ✗ 0/3 | ✗ 0/1 | ✗ 0/3 |
| lemonde.fr | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ~ 2/3 | ✗ 0/3 | ✓ 3/3 | ✗ 0/3 | ✓ 1/1 | ✗ 0/3 |
| spiegel.de | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✓ 3/3 | ✗ 0/3 | ✗ 0/1 | ✗ 0/3 |
| facebook.com | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✓ 3/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ~ 1/3 | ✗ 0/1 | ✗ 0/3 |
| tiktok.com | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✓ 3/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/1 | ✗ 0/3 |
| ebay.com | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ~ 1/3 | ✗ 0/1 | ✓ 3/3 |
| bestbuy.com | ✓ 3/3 | ✓ 3/3 | ✗ 0/3 | ~ 1/3 | ~ 2/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/1 | ✗ 0/3 |
| zillow.com | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✗ 0/3 | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | — | ✓ 3/3 |
| craigslist.org | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✓ 3/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/1 | ✗ 0/3 |
| airbnb.com | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | — | ✗ 0/3 |
| espn.com | ✗ 0/3 | ✗ 0/3 | ✓ 3/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✓ 3/3 | ✗ 0/3 | — | ✗ 0/3 |
| mercadolibre.com.mx | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✗ 0/3 | ✓ 3/3 | ✗ 0/3 | ✗ 0/3 | — | ✓ 3/3 |

## How to read this

- **quality** = mean task score (0–100, partial credit); **pass rate** = share of tasks scoring ≥ 80% (live tasks must also come from the named site, and live-judge tasks must be fresh). Repeated rounds are averaged per task.
- **Tracks.** search (53 tasks), access (31 tasks). Search = find the answer on the open web; access = open a given page or reach a named bot-walled site. Each track's score = 0.55 quality + 0.35 pass rate + 0.1 speed (p50 vs. the fastest provider in that track, floored at 25).
- **overall** = 0.85 × search + 0.15 × access. quality and pass rate above are track-weighted the same way. A provider needs ≥ 80% of each track's tasks scorable to get a number.
- **$ / 1k passed tasks** = list-price spend for one pass over the task set ÷ tasks passed × 1000. Not part of the score. Prices and sources are in `manifest.json`.
- **Live tasks are a snapshot.** Compare providers within this run, never across runs. live-judge tasks have no ground truth: the panel checks explicit constraints.
- Every task's verdict, reader answer, judge evidence, source URLs and a redacted excerpt are in `evidence.json`.

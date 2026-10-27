# SurfBench v2 — run 2026-10-26T16-07

80 tasks · 10 providers · live tasks × 3 rounds · fixed pipeline: search top 5 → fetch top 3 · reader `MiniMaxAI/MiniMax-M3` · no LLM judge: every task has an answer key or an official same-round reference.

## Leaderboard

Providers in the same **group** are statistically tied (the 95% paired-bootstrap CI of their gap includes 0).

| group | provider | overall (95% CI) | search (85%) | access (15%) | quality | pass rate | p50 | $ / 1k passed tasks |
|---|---|---|---|---|---|---|---|---|
| 1 | **perplexity-fast** | 80.4 (72.6–87.4) | 84.8 | 55.8 | 80.5 | 74.7% | 0.3s | $1.44 |
| 1 | **exa-lite** | 79.3 (73.4–84.8) | 83.9 | 53.7 | 86.4 | 83.4% | 1.4s | $8.41 |
| 1 | **exa** | 77.9 (71.4–83.6) | 82.2 | 53.8 | 84.8 | 81.9% | 2.3s | $12.17 |
| 1 | **parallel** | 76.6 (69.5–83.1) | 79.2 | 61.6 | 84.6 | 78.7% | 3.9s | $9.98 |
| 2 | **perplexity** | 75.9 (67.1–83.8) | 79.9 | 52.8 | 78.4 | 72.1% | 0.5s | $7.41 |
| 2 | **keenable** | 73.3 (65.8–79.6) | 77.9 | 46.8 | 81.1 | 74.8% | 3.6s | $20.69 |
| 2 | **firecrawl** | 67.1 (58.7–75.0) | 69.7 | 52.4 | 75.0 | 66.7% | 2.5s | $6.45 |
| 2 | **linkup** | 66.7 (58.4–74.5) | 69.0 | 53.5 | 74.1 | 67.0% | 7.3s | $24.82 |
| 3 | **parallel-turbo** | 66.3 (57.5–74.4) | 68.1 | 56.1 | 73.3 | 67.1% | 2.5s | $5.75 |
| — | tavily | n/a (only 0% of search tasks scorable; only 0% of access tasks scorable) | | | | | | |

## Quality by tier

| provider | stable-read | stable-lookup | live-feed |
|---|---|---|---|
| perplexity-fast | 80.0 | 88.0 | 50.8 |
| exa-lite | 61.7 | 96.7 | 61.4 |
| exa | 61.7 | 94.6 | 61.1 |
| parallel | 76.7 | 91.3 | 67.6 |
| perplexity | 80.0 | 85.9 | 49.2 |
| keenable | 66.7 | 89.5 | 54.4 |
| firecrawl | 61.7 | 81.5 | 58.3 |
| linkup | 75.0 | 83.0 | 46.8 |
| parallel-turbo | 76.7 | 82.6 | 48.6 |
| tavily | n/a | n/a | n/a |

## Access matrix

Passed / attempts per target site, across its tasks and rounds.

| site | perplexity-fast | exa-lite | exa | parallel | perplexity | keenable | firecrawl | linkup | parallel-turbo | tavily |
|---|---|---|---|---|---|---|---|---|---|---|
| instagram.com | ✗ 0/1 | ✗ 0/1 | ✗ 0/1 | ✓ 1/1 | ✗ 0/1 | ✓ 1/1 | ✗ 0/1 | ✓ 1/1 | ✓ 1/1 | — |
| x.com | ✓ 1/1 | ✗ 0/1 | ✗ 0/1 | ✓ 1/1 | ✓ 1/1 | ✗ 0/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | — |
| nytimes.com | ✗ 0/4 | ~ 3/4 | ~ 3/4 | ✗ 0/4 | ✗ 0/4 | ✗ 0/4 | ✗ 0/4 | ~ 1/4 | ✗ 0/4 | — |
| bbc.com | ~ 3/4 | ✓ 4/4 | ✓ 4/4 | ~ 3/4 | ~ 1/4 | ~ 3/4 | ~ 1/4 | ✓ 4/4 | ~ 3/4 | — |
| amazon.com | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | — |
| target.com | ✓ 1/1 | ✗ 0/1 | ✗ 0/1 | ✗ 0/1 | ✓ 1/1 | ✗ 0/1 | ✗ 0/1 | ✗ 0/1 | ✗ 0/1 | — |
| homedepot.com | ✓ 1/1 | ✗ 0/1 | ✗ 0/1 | ✗ 0/1 | ✓ 1/1 | ✗ 0/1 | ✗ 0/1 | ✗ 0/1 | ✗ 0/1 | — |
| youtube.com | ✗ 0/4 | ✗ 0/4 | ✗ 0/4 | ✓ 4/4 | ✗ 0/4 | ~ 1/4 | ✓ 4/4 | ~ 1/4 | ~ 1/4 | — |
| linkedin.com | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✗ 0/1 | ✓ 1/1 | ✓ 1/1 | — |
| arxiv.org | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | — |
| imdb.com | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | — |
| delta.com | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✗ 0/1 | — |
| britishmuseum.org | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✗ 0/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | — |
| stackoverflow.com | ✗ 0/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✗ 0/1 | ✓ 1/1 | ✗ 0/1 | ✓ 1/1 | ✓ 1/1 | — |
| walmart.com | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | ✓ 1/1 | — |
| github.com | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | — |
| wikipedia.org | ✓ 4/4 | ~ 1/4 | ~ 1/4 | ✓ 4/4 | ✓ 4/4 | ✓ 4/4 | ~ 1/4 | ~ 3/4 | ~ 1/4 | — |
| reddit.com | ✗ 0/6 | ✗ 0/6 | ✗ 0/6 | ✗ 0/6 | ✗ 0/6 | ✗ 0/6 | ✗ 0/6 | ✗ 0/6 | ~ 1/6 | — |
| news.ycombinator.com | ✗ 0/3 | ✓ 3/3 | ✓ 3/3 | ~ 1/3 | ✗ 0/3 | ~ 2/3 | ✓ 3/3 | ✗ 0/3 | ✗ 0/3 | — |
| lemonde.fr | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✓ 3/3 | ✗ 0/3 | ✗ 0/3 | — |
| spiegel.de | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✗ 0/3 | ✓ 3/3 | ~ 2/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | — |
| espn.com | ✗ 0/6 | ✗ 0/6 | ✗ 0/6 | ✗ 0/6 | ✗ 0/6 | ~ 1/6 | ✗ 0/6 | ~ 5/6 | ✗ 0/6 | — |
| npmjs.com | ✗ 0/3 | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✗ 0/3 | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | — |
| coinmarketcap.com | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | — |
| bsky.app | ✗ 0/3 | ✓ 3/3 | ✓ 3/3 | ~ 1/3 | ✗ 0/3 | ✗ 0/3 | ✓ 3/3 | ✗ 0/3 | ~ 1/3 | — |
| nfl.com | ✗ 0/3 | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✗ 0/3 | ✓ 3/3 | ✓ 3/3 | ✗ 0/3 | ✓ 3/3 | — |
| finance.yahoo.com | ✗ 0/3 | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✗ 0/3 | ✓ 3/3 | ✗ 0/3 | ✓ 3/3 | ✓ 3/3 | — |
| store.steampowered.com | ✓ 3/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✓ 3/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | ✗ 0/3 | — |
| apps.apple.com | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✓ 3/3 | ✗ 0/3 | ✓ 3/3 | ~ 1/3 | ✓ 3/3 | — |

## How to read this

- **quality** = mean task score (0–100, partial credit); **pass rate** = share of tasks scoring ≥ 80% (live tasks must also come from the named site). Repeated rounds are averaged per task.
- **Tracks.** search (56 tasks), access (24 tasks). Search = find the answer on the open web; access = open a given page or reach a named bot-walled site. Each track's score = 0.55 quality + 0.35 pass rate + 0.1 speed (p50 vs. the fastest provider in that track, floored at 25).
- **overall** = 0.85 × search + 0.15 × access. quality and pass rate above are track-weighted the same way. A provider needs ≥ 80% of each track's tasks scorable to get a number.
- **$ / 1k passed tasks** = list-price spend for one pass over the task set ÷ tasks passed × 1000. Not part of the score. Prices and sources are in `manifest.json`.
- **Live tasks are a snapshot.** Compare providers within this run, never across runs.
- Every task's verdict, reader answer, source URLs and a redacted excerpt are in `evidence.json`.

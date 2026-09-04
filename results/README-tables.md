## Scrape Event
| provider | attempts | passed | success | avg_usable_s | p50_s | p95_s |
| --- | --- | --- | --- | --- | --- | --- |
| parallel | 50 | 50 | 100% | 0.6s | 0.5s | 0.9s |
| exa | 50 | 38 | 76% | 0.8s | 0.3s | 1.4s |
| firecrawl | 50 | 37 | 74% | 3.6s | 1.9s | 11.5s |
| tavily | 50 | 37 | 74% | 2.9s | 0.3s | 12.2s |
| linkup | 50 | 33 | 66% | 4.1s | 4.3s | 8.8s |
| jina | 50 | 33 | 66% | 11.9s | 8.8s | 39.2s |

## Search Event
| provider | queries | ok | success | p50_s | p95_s |
| --- | --- | --- | --- | --- | --- |
| brave | 29 | 29 | 100% | 0.9s | 3.2s |
| firecrawl | 29 | 29 | 100% | 1.9s | 4.3s |
| linkup | 29 | 29 | 100% | 1.7s | 2.8s |
| tavily | 29 | 29 | 100% | 2.3s | 3.8s |
| parallel | 29 | 29 | 100% | 2.4s | 4.4s |
| exa | 29 | 28 | 97% | 1.5s | 2.3s |

## Quest Event
| provider | quests | answered | success | total_s | p50_s | wipeouts | judge_score |
| --- | --- | --- | --- | --- | --- | --- | --- |
| firecrawl | 15 | 15 | 100% | 11.5s | 10.9s | 0 | - |
| exa | 15 | 15 | 100% | 7.7s | 7.9s | 0 | - |
| tavily | 15 | 15 | 100% | 24.2s | 25.5s | 0 | - |
| parallel | 15 | 15 | 100% | 36.7s | 38.1s | 0 | - |
| linkup | 15 | 14 | 93% | 29.3s | 29.7s | 0 | - |

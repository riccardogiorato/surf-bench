## Overall Agent-Ready
| provider | agent_ready | scrape | search | quest |
| --- | --- | --- | --- | --- |
| parallel | 64 | 50/50 @ 0.6s | 100% @ 2.4s p50 | 15/15 @ 36.7s · judge - |
| exa | 55 | 38/50 @ 0.8s | 97% @ 1.6s p50 | 15/15 @ 7.7s · judge 7.4 |
| firecrawl | 39 | 37/50 @ 3.6s | 100% @ 2.0s p50 | 15/15 @ 11.5s · judge 5.5 |
| tavily | 36 | 37/50 @ 2.9s | 100% @ 2.3s p50 | 15/15 @ 24.2s · judge 5.4 |
| linkup | 35 | 33/50 @ 4.1s | 100% @ 1.7s p50 | 14/15 @ 29.3s · judge 4.9 |
| brave | 31 | - | 100% @ 0.8s p50 | - |
| jina | 6 | 33/50 @ 11.9s | - | - |

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
| provider | queries | ok | assertions | success | p50_s | p95_s |
| --- | --- | --- | --- | --- | --- | --- |
| brave | 29 | 29 | 27 | 100% | 0.8s | 3.4s |
| firecrawl | 29 | 29 | 27 | 100% | 2.0s | 4.6s |
| linkup | 29 | 29 | 20 | 100% | 1.7s | 2.8s |
| tavily | 29 | 29 | 25 | 100% | 2.3s | 3.9s |
| parallel | 29 | 29 | 28 | 100% | 2.4s | 4.4s |
| exa | 29 | 28 | 28 | 97% | 1.6s | 2.3s |

## Quest Event
| provider | quests | answered | success | total_s | p50_s | wipeouts | judge_score |
| --- | --- | --- | --- | --- | --- | --- | --- |
| firecrawl | 15 | 15 | 100% | 11.5s | 10.9s | 0 | 5.5 |
| exa | 15 | 15 | 100% | 7.7s | 7.9s | 0 | 7.4 |
| tavily | 15 | 15 | 100% | 24.2s | 25.5s | 0 | 5.4 |
| parallel | 15 | 15 | 100% | 36.7s | 38.1s | 0 | - |
| linkup | 15 | 14 | 93% | 29.3s | 29.7s | 0 | 4.9 |

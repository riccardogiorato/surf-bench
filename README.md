# SurfBench 🌊

**The benchmark that hires the best web assistant for your agent.**

SurfBench compares web-access APIs on the three things agents actually do: **search**, **scrape**, and **quest** (search → fetch → judge-graded answer). A Kimi K3 + GLM-5.3 judge panel grades the rides. Slow is a disqualification — the 30-second wipeout rule.

![SurfBench hero](assets/hero.svg)

## Overall Agent-Ready Leaderboard — 4 September 2026

![Overall agent-ready leaderboard](assets/benchmark-summary.svg)

| provider | agent-ready | scrape | search | quest |
|---|---|---|---|---|
| <img src="https://www.google.com/s2/favicons?domain=parallel.ai&sz=32" width="16" height="16" alt=""> **parallel** | **64** | 50/50 @ 0.6s | 100% @ 2.4s p50 | 15/15 @ 36.7s · judge 3.6 |
| <img src="https://www.google.com/s2/favicons?domain=exa.ai&sz=32" width="16" height="16" alt=""> **exa** | 55 | 38/50 @ 0.8s | 97% @ 1.6s p50 | 15/15 @ 7.7s · judge 7.4 |
| <img src="https://www.google.com/s2/favicons?domain=linkup.so&sz=32" width="16" height="16" alt=""> linkup | 40 | 33/50 @ 4.1s | 61% @ 1.7s p50 | 14/15 @ 29.3s · judge 3.8 |
| <img src="https://www.google.com/s2/favicons?domain=firecrawl.dev&sz=32" width="16" height="16" alt=""> firecrawl | 39 | 37/50 @ 3.6s | 100% @ 2.0s p50 | 15/15 @ 11.5s · judge 5.5 |
| <img src="https://www.google.com/s2/favicons?domain=tavily.com&sz=32" width="16" height="16" alt=""> tavily | 36 | 37/50 @ 2.9s | 100% @ 2.3s p50 | 15/15 @ 24.2s · judge 5.2 |
| <img src="https://www.google.com/s2/favicons?domain=brave.com&sz=32" width="16" height="16" alt=""> brave | 31 | – | 94% @ 0.8s p50 | – |
| <img src="https://www.google.com/s2/favicons?domain=jina.ai&sz=32" width="16" height="16" alt=""> jina | 6 | 33/50 @ 11.9s | – | – |

*The two strongest providers overall: **parallel** owns pure fetching (only 100% coverage at 0.6s avg; it renders the bot-guarded pages the others fail) and **exa** owns search quality + the fastest full quest with the best judge score (7.4). Practical picks: pair an exa/brave search leg with a parallel fetch leg, or use exa when you need speed and parallel when you need coverage. Full per-event leaderboards, methodology, and judge details: [results/README.md](results/README.md).*

## Run it yourself

```bash
git clone https://github.com/riccardogiorato/surf-bench.git
cd surf-bench
bun install
cp .example.env .env   # add the provider keys you have (all key-gated)
bun run test           # all three events
bun run report         # rebuild results/summary.json + leaderboard SVG
```

Providers: firecrawl · exa · linkup · tavily · parallel · jina · brave · serper — all key-gated, absent keys skip that provider. Judge panel: Kimi K3 + GLM-5.3 via Together AI, verdicts cached by content hash. Concurrency capped per provider. License: MIT.
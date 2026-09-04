# SurfBench 🌊

**The benchmark that hires the best web assistant for your agent.**

SurfBench compares web-access APIs on the three things agents actually do: **search**, **scrape**, and **quest** (search → fetch → judge-graded answer). A Kimi K3 + GLM-5.3 judge panel grades the rides. Slow is a disqualification — the 30-second wipeout rule.

![SurfBench hero](assets/hero.svg)

## Overall Agent-Ready Leaderboard — 4 September 2026

![Overall agent-ready leaderboard](assets/benchmark-summary.svg)

| rank | provider | agent-ready (0–100) | scrape — fetch 50 URLs | search — find 29 queries | quest — search→fetch→judge (15 questions) |
|---|---|---|---|---|---|
| 🥇 | <img src="https://www.google.com/s2/favicons?domain=parallel.ai&sz=32" width="16" height="16" alt=""> **parallel** | **74** | 50/50 @ 0.6s | 28/29 @ 2.8s | 15/15 @ 36.7s · judge 7.1 |
| 🥈 | <img src="https://www.google.com/s2/favicons?domain=exa.ai&sz=32" width="16" height="16" alt=""> **exa** | 66 | 38/50 @ 0.8s | 28/29 @ 1.6s | 15/15 @ 7.7s · judge 8.0 |
|  | <img src="https://www.google.com/s2/favicons?domain=linkup.so&sz=32" width="16" height="16" alt=""> linkup | 44 | 33/50 @ 4.1s | 20/29 @ 1.7s | 14/15 @ 29.3s · judge 6.9 |
| 🥉 | <img src="https://www.google.com/s2/favicons?domain=firecrawl.dev&sz=32" width="16" height="16" alt=""> firecrawl | 48 | 37/50 @ 3.6s | 27/29 @ 2.2s | 15/15 @ 11.5s · judge 7.0 |
|  | <img src="https://www.google.com/s2/favicons?domain=tavily.com&sz=32" width="16" height="16" alt=""> tavily | 45 | 37/50 @ 2.9s | 25/29 @ 2.3s | 15/15 @ 24.2s · judge 6.7 |
|  | <img src="https://www.google.com/s2/favicons?domain=brave.com&sz=32" width="16" height="16" alt=""> brave | 31 | – | 27/29 @ 1.2s | – |
|  | <img src="https://www.google.com/s2/favicons?domain=jina.ai&sz=32" width="16" height="16" alt=""> jina | 6 | 33/50 @ 11.9s | – | – |

*The two strongest providers overall: **parallel** owns pure fetching (only 100% coverage at 0.6s avg; it renders the bot-guarded pages the others fail) and **exa** owns search quality + the fastest full quest with the best judge score (8.0). Practical picks: pair an exa/brave search leg with a parallel fetch leg, or use exa when you need speed and parallel when you need coverage. Full per-event leaderboards, methodology, and judge details: [results/README.md](results/README.md).*

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
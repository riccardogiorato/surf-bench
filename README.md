# SurfBench 🌊

**The benchmark that hires the best web assistant for your agent.**

SurfBench compares web-access APIs on the three things agents actually do: **search**, **scrape**, and **quest** (search → fetch → judge-graded answer). A Kimi K3 + GLM-5.3 judge panel grades the rides. Slow is a disqualification — the 30-second wipeout rule.

![SurfBench hero](assets/hero.svg)

## Overall Agent-Ready Leaderboard — 4 September 2026

![Overall agent-ready leaderboard](assets/benchmark-summary.svg)

## Recommendation

**The best overall solution is pairing an exa or parallel search leg with parallel's extraction.** Parallel is the only provider that scraped all 50 hard URLs — it renders the bot-protected pages (marketplaces, social, X.com) where every other provider fails, at 0.6s average. For the search leg, exa and parallel tie on quality (28/29) while exa is ~2× faster; brave is the fastest raw search (1.2s avg) if you want to mix providers. Judge panel (Kimi K3 + GLM-5.3) scores parallel's extracted content 7.1/10 and exa's quest pipeline 8.0/10 — both comfortably usable for agents.

**Pricing at 1,000 searches + 1,000 scraped URLs** (pay-as-you-go list prices, September 2026):

| leg | exa | parallel |
|---|---|---|
| 1,000 searches | $7 ([search, up to 10 results with contents](https://exa.ai/pricing)) | $5 ([search basic/advanced](https://docs.parallel.ai/getting-started/pricing); $1 with turbo/fast mode) |
| 1,000 scraped URLs | $1 ([contents](https://exa.ai/pricing)) | $1 ([extract](https://parallel.ai/products/extract)) |
| **total / 1k+1k** | **$8** | **$6** ($2 with turbo search) |

Both give free credits to start (exa $20 + $10/mo; parallel 5,000 requests/mo free + $5/mo). Prices are list rates — confirm on the vendors' pricing pages before committing.

Full per-event leaderboards, methodology, and judge details: [results/README.md](results/README.md).

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
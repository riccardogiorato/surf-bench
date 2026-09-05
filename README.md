# SurfBench 🌊

**The benchmark that hires the best web assistant for your agent.**

SurfBench compares web-access APIs on the three things agents actually do: **search**, **scrape**, and **quest** (search → fetch → judge-graded answer). A Kimi K3 + GLM-5.3 judge panel grades the rides. Slow is a disqualification — the 30-second wipeout rule.

![SurfBench hero](assets/hero.svg)

## Overall Agent-Ready Leaderboard — 5 September 2026

![Overall agent-ready leaderboard](assets/benchmark-summary.svg)

## Recommendation

**Pair an exa or parallel search leg with parallel's extraction.** Parallel is the only provider that scraped all 50 hard URLs — it renders the bot-protected pages the others fail, at 0.6s average. For search, exa and parallel tie on quality (28/29) while exa is ~2× faster; brave is the fastest raw search if you want to mix providers. New this run: **keenable** — one key for both search and fetch, 100,000 free requests/month, top quest judge score (8.3) and the second-best scrape p95, though it can't render the hardest bot-walled pages (36/50).

**Pricing at 1,000 searches + 1,000 scraped URLs** (list prices, September 2026):

| leg | exa | parallel | keenable |
|---|---|---|---|
| 1,000 searches | $7 ([search](https://exa.ai/pricing)) | $5 ([search basic/advanced](https://docs.parallel.ai/getting-started/pricing); $1 with turbo/fast mode) | free ([100k requests/mo](https://docs.keenable.ai/credits), 1 credit per search) |
| 1,000 scraped URLs | $1 ([contents](https://exa.ai/pricing)) | $1 ([extract](https://parallel.ai/products/extract)) | free (1 credit per fetch) |
| **total / 1k+1k** | **$8** | **$6** ($2 with turbo search) | **$0 within the free tier** |

Both give free credits to start. Prices are list rates — confirm on the vendors' pricing pages before committing.

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

Providers: firecrawl · exa · linkup · tavily · parallel · jina · brave · serper · keenable — all key-gated, absent keys skip that provider. Judge panel: Kimi K3 + GLM-5.3 via Together AI, verdicts cached by content hash. Concurrency capped per provider. License: MIT.
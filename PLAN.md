# SurfBench — 80 Checked Tasks, Two Tracks

> Status: harness built and run. Answer keys cross-checked by independent agents
> (`agent-check`); human verification still to do.
> The task set is frozen per published run: `manifest.json` records the contract hash.
> Run package: `results/runs/<runId>/`. Every prompt, rubric and key, verbatim:
> `results/runs/<runId>/methodology.html` (generated from the code).

## Principles

1. **Few tasks, each checked.** 80 tasks, each with an answer key or an official
   live source, the evidence for it, who checked it, and when.
2. **Graded against a key, not vibes.** A fixed reader model turns every bundle into a
   short answer, and that answer is checked against the key. The answer must also be in
   the pages the reader was given: a correct answer it knew by heart earns nothing. There
   is no LLM judge: a task without an official answer source is not in the set.
3. **Reproducible where the web allows it.** Stable tasks give the same score on every
   re-run. Live tasks are dated snapshots with the true answer captured in the same
   round, so anyone can re-grade them, but nobody should compare them across runs.
4. **Honest statistics.** Paired comparisons with confidence intervals; overlapping
   providers are shown as tied, not ranked.

## Pipeline (fixed, identical for every provider)

```
request ─search(top 5)─▶ results ─fetch(top 3, same provider)─▶ bundle ─reader─▶ answer ─grade─▶ verdict
                                                                      ▲
                                   reference capture (live-feed tasks, same round) ─┘
```

- The request is sent **verbatim** as the query. No rewriting, no `site:` filters:
  finding the right platform is part of the test. (Penalizes keyword-only engines.)
- Fetch takes the top 3 **as ranked**. `stable-read` tasks skip search and fetch the given URL.
- **Reader**: `MiniMaxAI/MiniMax-M3` on Together, temperature 0, one prompt per grader
  type, same for everyone, 40k chars per document (stored up to 100k). It answers only
  from the bundle and says NOT FOUND otherwise.
- 30 s per leg = DNF. Rate-limited calls are retried twice with backoff; survivors stay non-scoring.
- Runs bypass the search/scrape caches; providers fetch with their vendor-default cache policy.
- Fast modes (`exa-lite`, `parallel-turbo`, `perplexity-fast`) are separate ranked rows; the first two fetch with their parent. `exa-fast` (Exa's legacy `fast` type) was retired after run 2026-10-26T16-07: it returned the same top 5 as `lite` on 118 of 131 searches (`RETIRED` in `searchClients.ts`).
- Perplexity has no fetch API: its search returns each page's extracted text (query-focused excerpts), and the top 3 results' text is its fetch leg (0 ms, no fetch cost). On stable-read tasks it searches for the given URL.

## Tracks (weights fixed before the run)

| Track | Weight | Tasks | What it asks |
|---|---|---|---|
| **search** | 0.85 | 56 | Find the answer on the open web: docs and specs, multi-hop questions, official figures, long-tail and non-English facts, recent events, open-web live feeds |
| **access** | 0.15 | 24 | Open a given page, or get a live answer from a named bot-walled site (X, Instagram, LinkedIn, Reddit, Amazon, ESPN, Steam, the App Store…) |

Why: agents mostly search. Some vendors keep site-specific scrapers (e.g. Reddit) off by
default for legal reasons; site access is still measured and published, but it can't
dominate the board. Assignment: `trackOf()` in `src/lib/tasks.ts`.

## Task tiers

| Tier | Count | Answer key | How it's graded | Reproducible? |
|---|---|---|---|---|
| **stable-read** | 10 | Key facts on a given URL | Regex per fact on the reader's answers | Yes |
| **stable-lookup** | 46 | Fixed answer, written in the task file | Regex / numeric tolerance / allowed variants | Yes |
| **live-feed** | 24 | Captured at run time from an official feed or API (finals of a past game day: any time) | Overlap with the captured top items, match the newest item, or match official final scores; on a named site only its own pages count | Re-gradable snapshot |

Notes from building it:
- Reddit references use RSS (its JSON API returns 403 to servers) and union top + hot; news keys keep up to 100 feed items; S&P uses FRED.
- The 15 judged tasks (X posts, eBay, Zillow, Airbnb…) were replaced by keyed live-feed tasks on sites with a public API (ESPN, npm, PyPI, the App Store, Steam, Yahoo Finance, Bluesky, Coinbase/CoinGecko, Jolpica F1, ECB). A Polymarket task was dropped after its first run: the API ranks events while pages list markets, so no answer could match.

## Scoring

- Per-task score in [0, 1] with partial credit (facts matched, overlap share, games matched). Empty/error bundle = 0.
- **Pass** = score ≥ 0.8 **and**, for live tasks on a named site, found on that site's own pages. Correct answers taken from a mirror or aggregator fail, but are counted in their own "right, via mirror" column.
- Per track: quality 0.55 (mean score) / reliability 0.35 (pass rate) / speed 0.10 (p50 vs. the fastest row in that track).
- **Overall = 0.85 × search + 0.15 × access** (`TRACK_WEIGHTS` in `src/lib/scoring.ts`). Both track scores are published.
- `quota` / `rate_limit` are NON-SCORING; coverage guard ≥ 80% of each track's tasks.
- **Repeats**: live tasks run 3× per run (score = mean over rounds); stable tasks run once.
- **Uncertainty**: paired bootstrap over tasks, resampled within each track → 95% CI on overall; tie groups against each group's head.
- **Cost column** (not scored): `$ per 1k passed tasks` from real call counts × `src/lib/pricing.ts`.

## Run package

Every run publishes `results/runs/<runId>/`: `REPORT.md`, `leaderboard.csv`,
`groups.csv` (quality and pass rate per task group), `access.csv`, `evidence.json` (per-task verdicts, source URLs, redacted excerpts),
`manifest.json` (task set version and contract hash, provider configs, reader and judge
model, prompts, captured references), `recap.html`, `inspect.html` and
`methodology.html`. `bun run tasks:grade --run <id>` re-grades a snapshot offline
without calling any provider.

## Known limits

- **No live questions on sites without an official source.** X posts, eBay, Zillow and Airbnb can't be graded against ground truth, so they are out (X and Instagram stay as fixed-page reads). Best Buy and eBay have official APIs behind free developer keys and are the next candidates.
- **Live tasks aren't comparable across runs.** Compare providers within a run.
- **80 tasks is small.** Pairwise CIs often overlap; ties are reported as ties.
- **Recent-event and "current limit" keys age.** `s-new-*` test index freshness only for a few weeks; `s-doc-6` (Lambda limits) and `s-doc-7` (Actions limits) must be re-checked the morning of each run (last: 2026-10-25, both unchanged) and the key edited if a page has moved.
- **Verbatim queries** favor natural-language search APIs over keyword engines.
- **Public content only.** No logged-in sessions.
- **One round of tool use**, not a multi-step agent loop.

## Remaining work

- [ ] Human verification of all 80 answer keys (second person spot-checks).
- [ ] Archive evidence pages (archive.org) for every stable key.

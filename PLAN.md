# SurfBench — 50 Checked Tasks

> Status: harness built and run. Answer keys cross-checked by independent agents
> (`agent-check`); human verification and human judge calibration still to do.
> The task set is frozen per published run: `manifest.json` records the contract hash.
> Run package: `results/runs/<runId>/`. Every prompt, rubric and key, verbatim:
> `results/runs/<runId>/methodology.html` (generated from the code).

## Principles

1. **Few tasks, each checked.** 50 tasks, each with an answer key or explicit
   constraints, the evidence for it, who checked it, and when.
2. **Graded against a key, not vibes.** A fixed reader model turns every bundle into a
   short answer, and that answer is checked against the key. The judge panel only
   handles tasks with no possible key, and answers yes/no constraints, not a 0–10 opinion.
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
  from the bundle and says NOT FOUND otherwise. live-judge bundles go straight to the
  panel, so a reader summary can't hide or invent evidence.
- 30 s per leg = DNF. Rate-limited calls are retried twice with backoff; survivors stay non-scoring.
- Runs bypass the search/scrape caches; providers fetch with their vendor-default cache policy.
- Fast modes (`exa-fast`, `parallel-turbo`) are separate ranked rows that fetch with their parent.

## Task tiers

| Tier | Count | Answer key | How it's graded | Reproducible? |
|---|---|---|---|---|
| **stable-read** | 10 | Key facts on a given URL | Regex per fact on the reader's answers | Yes |
| **stable-lookup** | 12 | Fixed answer, written in the task file | Regex / numeric tolerance / allowed variants | Yes |
| **live-feed** | 12 | Captured at run time from an official feed or API | Overlap with the captured top items, or match the newest item | Re-gradable snapshot |
| **live-judge** | 16 | None possible (X, Instagram, marketplaces…) | Panel checks yes/no constraints, plus auto-added on-site and freshness checks | Re-gradable snapshot |

Notes from building it:
- Reddit references use RSS (its JSON API returns 403 to servers) and union top + hot; news keys keep up to 100 feed items; S&P uses FRED.
- Product/listing tasks carry no freshness constraint: those pages show no date. Product pages must look currently purchasable instead. eBay/Amazon country storefronts count as on-site.
- live-judge passes only if every constraint is supported by at least one judge (averaging passed an over-budget Airbnb at 4/5) and the evidence is on the target site itself.

## Scoring

- Per-task score in [0, 1] with partial credit (facts matched, overlap share, constraints met). Empty/error bundle = 0.
- **Pass** = score ≥ 0.8 **and**, for live tasks, on-site and fresh. Correct answers taken from a mirror or aggregator fail, but are counted in their own "right, via mirror" column.
- Weights: quality 0.50 (mean score) / reliability 0.35 (pass rate) / speed 0.15 (p50 vs. fastest).
- `quota` / `rate_limit` are NON-SCORING; coverage guard ≥ 80%.
- **Repeats**: live tasks run 3× per run (score = mean over rounds); stable tasks run once.
- **Uncertainty**: paired bootstrap over tasks → 95% CI on each composite; tie groups against the leader.
- **Cost column** (not scored): `$ per 1k passed tasks` from real call counts × `src/lib/pricing.ts`.

## Judge calibration

24 judged results were labelled blind by independent agents (`calibration.json`); each
judge's agreement is published there. Still to do: hand-label ~60 live-judge bundles by a
human; if agreement on a constraint is < 85%, that constraint becomes diagnostic-only.

## Run package

Every run publishes `results/runs/<runId>/`: `REPORT.md`, `leaderboard.csv`,
`access.csv`, `evidence.json` (per-task verdicts, source URLs, redacted excerpts),
`manifest.json` (task set version and contract hash, provider configs, reader and judge
models, prompts, captured references), `recap.html`, `inspect.html` and
`methodology.html`. `bun run tasks:grade --run <id>` re-grades a snapshot offline
without calling any provider.

## Known limits

- **live-judge tasks have no ground truth.** The judge checks constraints, not that the item is *the* newest.
- **Live tasks aren't comparable across runs.** Compare providers within a run.
- **50 tasks is small.** Pairwise CIs often overlap; ties are reported as ties.
- **Verbatim queries** favor natural-language search APIs over keyword engines.
- **Public content only.** No logged-in sessions.
- **One round of tool use**, not a multi-step agent loop.

## Remaining work

- [ ] Human verification of all 50 answer keys (second person spot-checks).
- [ ] Human calibration of the judge panel (~60 bundles).
- [ ] Archive evidence pages (archive.org) for every stable key.

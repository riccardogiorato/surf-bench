# SurfBench — Execution Plan

> Design: `docs/surfbench-design.html` · Repo: `web-scrapers-evals` → **`surf-bench`**
>
> **Goal today:** one repo, three events run (search / scrape / quest), leaderboards per
> event + overall + suggested combos, published as README + `results/` CSV & JSON —
> 1kpapers-style docs, WebBench-style "results live in the repo".

Legend: **[S]** = sequential (blocks the next phase) · **[P]** = parallelizable
· ⏱ = wall-clock estimate · 💳 = spends provider credits

---

## Phase 0 — Housekeeping **[S]** · ⏱ 15 min

- [x] **0.1** Commit the dirty tree: `parallelClient.ts` work, updated env/workspace files;
      delete `src/tests/zz-scratch-*.test.ts`. One commit: `chore: parallel client + housekeeping`.
- [x] **0.2** `gh repo rename surf-bench` (GitHub auto-redirects the old URL; local folder
      rename optional — do it last, it invalidates the shell cwd).
- [x] **0.3** Update `package.json` name + README clone URL strings.

## Phase 1 — Restructure **[S for moves, P for new code]** · ⏱ 3–4 h

- [x] **1.1** Reorganize to the locked structure:
      ```
      src/lib/           registry · cache · concurrency · quality · types · reporter
      src/suites/search/  12 quality dims + latency   (port from web-search-evals, modernize)
      src/suites/scrape/  50-URL gauntlet             (existing, as-is)
      src/suites/quest/   question → search → fetch → grade (new)
      ```
- [x] **1.2** Provider seam: one `Provider` registry with capability flags (`search`/`fetch`);
      every suite consumes adapters only. 8 adapters, gated on key presence.
      Scrape roster: firecrawl, exa, linkup, tavily, parallel, **jina** (new reader client).
      Search roster: firecrawl, exa, linkup, tavily, parallel†, **serper** (new), **brave** (port).
- [x] **1.3** Port the 12 search dims onto the modern harness (factuality, recency,
      diversity, entity disambiguation, intent, multilingual, spam, safe-search,
      citation, link quality, brand homepage + latency p50/p95).
- [x] **1.4** Build the **quest** harness: ~15 graded questions, per provider
      (both-legs roster): search → pick top-k → extract → assemble content; 30s per
      leg = wipeout (DNF). Plus **cross-provider combos** for the suggested-combos table.
- [x] **1.5** **Judge module** `src/lib/judge/`: Kimi K3 + GLM-5 panel via Together
      (`TOGETHER_API_KEY` present). `grade(artifact, rubric) → Verdict {score, rationale}`;
      verdicts cached by content hash; disagreement > 2 pts flagged.
- [x] **1.6** Reporter: per-event tables + composite **agent-ready score**
      (quality-gated success × speed factor) + themed scoreboard SVG.

## Phase 2 — Run the bench **[P across events, P across providers]** · ⏱ 1–2 h 💳

- [x] **2.1** Scrape run — mostly **cache hits** (July run covers the 5 incumbents);
      only **jina** fetches fresh (50 URLs).
- [x] **2.2** Search run — fresh: ~8 providers × ~24 queries (2 per dim).
      Serper free tier (~2.5k credits) + Brave free tier (2k/mo) cover their legs;
      exa/firecrawl/linkup/tavily legs are cheap paid calls.
- [x] **2.3** Quest run — 5 both-legs providers × ~15 questions (+ 2–3 curated
      cross-combos to validate the suggested-combos table).
- [x] **2.4** Judge pass — grades every run's artifacts (cached verdicts keep re-runs free).
- [x] *(2.1-2.4 ran concurrently in background tasks; Vitest parallelizes within each.)*

## Phase 3 — Ship results **[S, after runs]** · ⏱ 1–2 h

- [x] **3.1** `results/` — per event: `<event>.csv` + `<event>.json` (per-provider rows:
      success %, p50/p95, judge scores, per-category breakdown) + `summary.json`
      with the composite agent-ready ranking.
- [x] **3.2** README rewrite (1kpapers treatment): Y2K hero illustration (flattened
      portal graphic — pixel Curl, search box, badges), per-event leaderboards,
      overall table, **suggested combos** (e.g. best-search × best-fetch pairing),
      methodology, wipeout rule, judge panel disclosure.
- [x] **3.3** Regenerate `assets/benchmark-summary.svg` in the Y2K style.
- [ ] **3.4** Retire `web-search-evals`: **delete** (user decision, locked) —
      `gh repo delete riccardogiorato/web-search-evals --yes` after surf-bench is live
      with results, so nothing points at a gap.
- [ ] **3.5** Logo: placeholder = hero illustration for now; a dedicated mark is a
      follow-up (tracked in the design doc).

---

## Dependency notes

- 0.1 → everything (clean tree before restructure).
- Phase 1's three workstreams are independent once 1.1 lands: search suite port,
  jina client, judge module → can go to parallel agents.
- 2.1 needs only 1.2 (jina client) — can start while search/quest suites are built.
- 2.2/2.3 need their suites; 2.4 needs artifacts from any finished run.
- 3.x needs 2.x; README + SVG can be drafted against cached scrape results early.

## Definition of done (today)

`surf-bench` repo where `pnpm test` runs all three events; README shows three
leaderboards + overall + suggested combos; `results/` holds CSV/JSON for each event
plus a summary; scoreboard SVG in-theme; old search repo archived/deleted.
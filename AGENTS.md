# SurfBench

Benchmark comparing web-access API providers for AI agents across three events:
**search** (12 quality dims), **scrape** (50-URL gauntlet), **quest** (search → fetch → judge-graded).

## Commands

```bash
bun run test      # all three events (Vitest; providers run concurrently, key-gated)
bun run report    # aggregate results/raw/*.jsonl → results/*.csv + summary.json + SVG
npx tsx scripts/hero.ts   # regenerate assets/hero.svg
```

## Structure

- `src/lib/` — shared core: clients (`searchClients.ts`, `scraperClients.ts`, `jinaClient.ts`, `parallelClient.ts`), cache, concurrency limiter, quality gate (`contentQuality.ts`), judge panel (`judge/judge.ts`), results recorder (`results.ts`)
- `src/suites/{search,scrape,quest}/` — the three events. Suites import clients through the lib seam only; never an SDK directly.
- `scripts/` — `report.ts` (aggregation + leaderboard SVG), `hero.ts` (README hero), `favicons.ts` (shared favicon data-URI helper)
- `results/` — committed: per-event CSV/JSON + `summary.json` + `overall.csv`. `results/raw/` is gitignored (full page content; NEVER commit it — scraped pages can contain other people's leaked secrets; content is redacted at record time but keep it out of git regardless).

## Conventions

- All providers are key-gated: absent `*_API_KEY` in `.env` → provider skipped, no errors.
- Judge panel: Kimi K3 + GLM-5.3 via Together AI REST (case-sensitive model slugs `moonshotai/Kimi-K3`, `zai-org/GLM-5.3`). Together rate-limits aggressively — judge calls are throttled (2 in flight) with backoff; verdicts cached by content hash; judge-error verdicts are never cached.
- Wipeout rule: >30s per leg = DNF.
- Records dedupe by (provider, case) keeping the LAST line in the jsonl.
- The Y2K theme: retro windows, bevels, Silkscreen pixel accents. Design doc lives locally at `docs/surfbench-design.html` (gitignored on purpose).
- Type-check with `npx tsc --noEmit` before committing.
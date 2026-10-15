# SurfBench

Benchmark comparing web-access API providers for AI agents across three events:
**search** (12 quality dims), **scrape** (50-URL gauntlet), **quest** (search → fetch → judge-graded).

## Commands

```bash
bun run test      # all three events (Vitest; providers run concurrently, key-gated)
bun run judge     # grade quest content (offline, resumable, cached)
bun run judge:search  # grade recorded search result sets — the quality axis
bun run judge:scrape  # grade scrape extractions on a fixed site subset
bun run audit     # integrity check: coverage, judge health, cross-checks
bun run report    # aggregate results/raw/*.jsonl → results/*.csv + summary.json + SVG
npx tsx scripts/hero.ts   # regenerate assets/hero.svg
```

Order matters: capture (`test`) → grade (`judge*`) → verify (`audit`) → publish
(`report`). Judge passes never run inside the suites: awaiting a throttled panel
from concurrent tests made 71 of 84 answerability cases blow their timeout.

## Structure

- `src/lib/` — shared core: clients (`searchClients.ts`, `scraperClients.ts`, `jinaClient.ts`, `parallelClient.ts`, `keenableClient.ts`), cache, concurrency limiter, quality gate (`contentQuality.ts`), judge panel (`judge/judge.ts`), results recorder (`results.ts`)
- `src/suites/{search,scrape,quest}/` — the three events. Suites import clients through the lib seam only; never an SDK directly.
- `scripts/` — `report.ts` (aggregation + leaderboard SVG), `hero.ts` (README hero), `favicons.ts` (shared favicon data-URI helper)
- `results/` — committed: per-event CSV/JSON + `summary.json` + `overall.csv`. `results/raw/` is gitignored (full page content; NEVER commit it — scraped pages can contain other people's leaked secrets; content is redacted at record time but keep it out of git regardless).

## Conventions

- All providers are key-gated: absent `*_API_KEY` in `.env` → provider skipped, no errors.
- Judge panel: Kimi K3 + GLM-5.3 via Together AI REST (case-sensitive model slugs `moonshotai/Kimi-K3`, `zai-org/GLM-5.3`). Together rate-limits aggressively — judge calls are throttled (4 in flight) with backoff; verdicts cached by content hash; judge-error verdicts are never cached.
- Wipeout rule: >30s per leg = DNF.

## Scoring

Three axes (`src/lib/scoring.ts`), weighted **quality 0.50 / reliability 0.35 /
speed 0.15**. Quality comes from the judge panel; it is never a string match.

- **Error taxonomy** (`errorClass.ts`): `quota` and `rate_limit` are NON-SCORING.
  A provider that never got a fair answer must publish as "no data", never as a
  low score — an unfunded key returning HTTP 402 on every case would otherwise
  render as a perfect 0 and read as a quality verdict. Order matters:
  `rate_limit` is matched before `quota` because providers link their billing
  docs inside 429 text. Covered by `errorClass.test.ts`.
- **Coverage guard**: an event needs ≥80% of cases scorable to produce a number;
  a composite needs a quality axis plus ≥2 scored events, otherwise it is
  withheld as `n/a`. Covered by `scoring.test.ts`.
- **Search quality** is the `answerability` dim: the ranked result set is graded
  by the panel. The legacy 12 substring/domain dims are retained as cheap
  breakage diagnostics only and no longer feed any score.
- **Scrape**: `substanceScore` (`scrapeSubstance.ts`) is a deterministic SHELL
  DETECTOR, not a quality grade — calibration showed it tracks prose volume, so
  a concise correct extraction scored 2.59 while a long error page scored 9.13.
  It is used as a low floor; the judge carries quality.
- `expectTokens` in `questCases.ts` is a diagnostic, never a gate.
- Rubrics live in `judge/rubrics.ts` and are sent as the system message. They
  also salt the verdict cache, so editing one re-grades from scratch. (They used
  to only salt the cache, leaving judges scoring on an undefined 0–10 scale.)
- Always `bun run audit` before publishing; it exits non-zero on blocking issues.
- Keenable is org-rate-limited to 10 req/s: all its search + fetch calls share the paced gate in `keenableClient.ts` (~9 req/s, 429 backoff); its timings include that pacing. To run a single provider's suite, blank the other keys on the command line (`EXA_API_KEY= ... bunx vitest run src/suites`) — SDK clients construct lazily so absent keys never throw.
- `SURFBENCH_TURBO=1` swaps exa → `exa-fast` (search `type:"fast"`, serialized + rate-limit backoff) and parallel → `parallel-turbo` (search `mode:"turbo"`) for the search event only, recorded under those names. Never run two exa-flavored suites concurrently — the org cap is shared.
- `bun run scripts/quest-turbo.ts` — quest side-event in super-fast configs → `results/raw/quest-turbo.jsonl`.
- Records dedupe by (provider, case) keeping the LAST line in the jsonl.
- The Y2K theme: retro windows, bevels, Silkscreen pixel accents. Design doc lives locally at `docs/surfbench-design.html` (gitignored on purpose).
- Type-check with `npx tsc --noEmit` before committing.
# SurfBench

Benchmark comparing web-access API providers for AI agents. One event: 50 checked
tasks, each run through the same fixed pipeline — the request goes verbatim to the
provider's search (top 5), the provider fetches the top 3, and one pinned reader
model answers only from those pages. Answers are graded against answer keys, a
same-minute official feed, or yes/no constraints checked by a judge panel. Method
details: `PLAN.md`; every prompt verbatim: `results/runs/<runId>/methodology.html`.

## Commands

```bash
bun run tasks          # run: search top 5 → fetch top 3 per provider; live tasks × 3 rounds
bun run tasks:grade    # reader (MiniMax M3) vs answer keys; judge panel for live-judge constraints
bun run tasks:report   # results/runs/<runId>/ REPORT.md, leaderboard.csv, access.csv, evidence.json, manifest.json
bun run tasks:html     # recap.html, inspect.html, methodology.html + assets/v2-*.svg (README panels)
bun run tasks:audit    # publish gate: blocks on agent-draft answer keys, ungraded runs, missing references
bun run test           # unit tests (Vitest)
```

Order matters: run (`tasks`) → grade (`tasks:grade`) → report (`tasks:report`) →
pages (`tasks:html`) → verify (`tasks:audit`).

- Tasks live in `src/lib/tasks.ts`; `verified.by: "agent-draft"` means nobody has checked the key, `"agent-check"` means independent agents cross-checked it but no human has (the audit passes those only with `--provisional`).
- Runs bypass the search/scrape caches (`SURFBENCH_NO_CACHE`); reader and judge verdicts stay cached.
- `--round N --run <id> --tasks a,b` redoes one round with a fresh reference capture; the newer records win.
- `--providers a,b` and `--tasks a,b` narrow a run; `--rounds 1` for smoke tests.

## Structure

- `src/lib/tasks.ts` — the 50 tasks: request, tier, answer key or constraints, verification record.
- `src/lib/references.ts` — live-feed reference capture (RSS / official APIs), same round as the provider calls.
- `src/lib/taskGrading.ts` — reader prompts and graders (facts, overlap, latest, numeric, constraints).
- `src/lib/taskScoring.ts` + `scoring.ts` — per-task score, pass gate, bootstrap CIs, tie groups, composite.
- `src/lib/judge/` — `rubrics.ts` (reader system prompt + constraint rubric), `judge.ts` (Together calls, panel, cache).
- `src/lib/pricing.ts` — list prices per call, each with source URL and date.
- `src/lib/{searchClients,scraperClients,apiClients,parallelClient,keenableClient}.ts` — provider adapters. Scripts import providers through these only, never an SDK directly.
- `scripts/tasks-*.ts` — run, grade, report, html, audit. `favicons.ts` — favicon data URIs for the SVG panels.
- `results/runs/<runId>/` — committed run package. `results/v2-latest.json` points at the published run. `results/raw/` is gitignored (full page content; NEVER commit it — scraped pages can contain other people's leaked secrets; content is redacted at record time but keep it out of git regardless).

## Conventions

- All providers are key-gated: absent `*_API_KEY` in `.env` → provider skipped, no errors.
- Providers: parallel, exa, tavily, firecrawl, keenable, linkup. A provider runs only if it has both a search and a fetch adapter.
- Fast modes are their own ranked rows, never merged into the default row (a provider must not pick its best mode per task): `exa-fast` (search `type:"fast"`) and `parallel-turbo` (search `mode:"turbo"`). They have no fast fetch mode, so they fetch with the parent (`FETCH_PROVIDER` in `searchClients.ts`). `exa-fast` shares exa's request pacer because the org cap is shared.
- Reader: `MiniMaxAI/MiniMax-M3`, temperature 0. Judge panel: Kimi K3 + GLM-5.3 via Together AI REST (case-sensitive slugs `moonshotai/Kimi-K3`, `zai-org/GLM-5.3`). Together rate-limits aggressively — calls are throttled (4 in flight) with backoff; verdicts cached by content hash; judge-error verdicts are never cached.
- Wipeout rule: >30s per leg = DNF.
- Grades are stamped with reader model + prompt hashes + a hash of every task's answer contract (`GRADE_STAMP` in `tasks-grade.ts`) and the record's `startedAt`. Editing a key, a prompt or a rubric re-grades automatically; stale grades are ignored by report and audit.
- Records dedupe by (run, round, provider, task) keeping the LAST line in the jsonl.
- The Y2K theme: retro windows, bevels, Silkscreen pixel accents. Design doc lives locally at `docs/surfbench-design.html` (gitignored on purpose). README panels are SVGs (GitHub strips `<style>` from inline HTML).
- Type-check with `npx tsc --noEmit` before committing.

## Scoring

Three axes (`src/lib/scoring.ts`), weighted **quality 0.50 / reliability 0.35 /
speed 0.15**: quality = mean task score, reliability = pass rate, speed = end-to-end
p50 relative to the fastest row (floored at 25).

- **Pass**: score ≥ 0.8. live-judge also needs every constraint met by at least one judge, the evidence on the target site itself (not a mirror or aggregator), and the freshness window met.
- **Error taxonomy** (`errorClass.ts`): `quota` and `rate_limit` are NON-SCORING. A provider that never got a fair answer must publish as "no data", never as a low score — an unfunded key returning HTTP 402 on every task would otherwise render as a perfect 0 and read as a quality verdict. Order matters: `rate_limit` is matched before `quota` because providers link their billing docs inside 429 text. Error classes are recomputed from stored messages at report time, so taxonomy fixes apply retroactively. Covered by `errorClass.test.ts`.
- **Coverage guard**: a provider needs ≥80% of tasks scorable to get a number, otherwise it is withheld as `n/a`.
- **Uncertainty**: paired bootstrap over tasks; providers whose CIs overlap the leader's share a tie group.
- **Cost** is a published column ($ per 1k passed tasks), never a scoring axis. Reader and judge calls are harness overhead, excluded.
- Keenable is org-rate-limited to 10 req/s: all its search + fetch calls share the paced gate in `keenableClient.ts` (~9 req/s, 429 backoff); its timings include that pacing. Only `request()` may enter the gate — nesting `paced()` deadlocked every run with >4 concurrent fetches.
- Always `bun run tasks:audit` before publishing; it exits non-zero on blocking issues.

import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { SEARCH_CONTENT, fetchProviderOf, searchClients } from "../src/lib/searchClients.js";
import { scraperClients } from "../src/lib/scraperClients.js";
import { createConcurrencyLimiter } from "../src/lib/concurrency.js";
import { classifyError } from "../src/lib/errorClass.js";
import { captureReference } from "../src/lib/references.js";
import { costUsd } from "../src/lib/pricing.js";
import { LIVE_ROUNDS, TASKS, hostMatches, isLive, type Task } from "../src/lib/tasks.js";
import type { ScrapedContent, SearchResponse, SearchResult } from "../src/lib/types.js";

// SurfBench runner: every provider answers every task through the same
// fixed pipeline — search(top 5) → fetch(top 3, same provider) — and the raw
// bundle is recorded for offline grading (`bun run tasks:grade`).
//
//   bun run tasks                               full run
//   bun run tasks --providers exa,tavily        subset of providers
//   bun run tasks --tasks f-hn,j-x1 --rounds 1  smoke test
//   bun run tasks --run <id> --round 2 --tasks f-rd2   redo one round
//
// Round 1 runs all tasks; rounds 2..LIVE_ROUNDS re-run live tasks only. Each
// round first captures the live-feed references, so ground truth and provider
// answers are minutes apart.

const LEG_TIMEOUT_MS = 30000; // wipeout rule
const SEARCH_RESULTS = 5;
const FETCH_TOP = 3;
// Stored in full up to this cap (results/raw is gitignored). A 15k cap cut
// 30-70% of pages and left nav-first extractions graded on their menus alone.
const DOC_CHARS = 100000;
// Two tasks in flight per provider keeps the clients' own limiters (5 calls)
// from queueing, so wall-clock time is the provider's time, not ours.
const TASKS_IN_FLIGHT = 2;

const RAW = "results/raw";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function withTimeout<T>(p: Promise<T>, ms: number, fallback: (msg: string) => T): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback(`timed out after ${ms}ms`)), ms)),
  ]);
}

// One writer at a time: records carry page bodies, and concurrent appends of
// lines that size splice into each other.
let writeChain: Promise<void> = Promise.resolve();
function append(file: string, record: object): Promise<void> {
  const line = JSON.stringify(record) + "\n";
  const run = writeChain.then(() => fs.appendFile(path.join(RAW, file), line));
  writeChain = run.catch(() => {});
  return run;
}

const SECRET_PATTERNS = [/AIzaSy[A-Za-z0-9_-]{30,}/g, /sk-[A-Za-z0-9]{20,}/g, /ghp_[A-Za-z0-9]{30,}/g];
const redact = (s: string) => SECRET_PATTERNS.reduce((t, p) => t.replace(p, "[REDACTED]"), s);

type Search = (q: string, n?: number) => Promise<SearchResponse>;
type Scrape = (url: string, timeout?: number) => Promise<ScrapedContent>;

async function runOne(runId: string, round: number, provider: string, search: Search, scrape: Scrape | null, task: Task) {
  const startedAt = new Date().toISOString();
  let searchLeg: { ms: number; error?: string; results: { title: string; url: string }[] } | null = null;
  let urls: string[];
  let found: SearchResult[] = [];

  // Without a fetch API, a direct-URL task is a search for that URL.
  if (task.url && scrape) {
    urls = [task.url];
  } else {
    const t0 = Date.now();
    const res = await withTimeout(search(task.url ?? task.request, SEARCH_RESULTS), LEG_TIMEOUT_MS, (error) => ({ results: [], latencyMs: LEG_TIMEOUT_MS, error }));
    found = res.results.slice(0, SEARCH_RESULTS);
    searchLeg = {
      ms: Date.now() - t0,
      error: res.error,
      results: found.map((r) => ({ title: r.title, url: r.url })),
    };
    urls = searchLeg.results.map((r) => r.url).slice(0, FETCH_TOP);
  }

  const f0 = Date.now();
  const fetches = await Promise.all(
    urls.map(async (url, i) => {
      const s = Date.now();
      const r: ScrapedContent = scrape
        ? await withTimeout(
            scrape(url, LEG_TIMEOUT_MS).catch((e): ScrapedContent => ({ url, error: e instanceof Error ? e.message : "fetch failed" })),
            LEG_TIMEOUT_MS + 5000,
            (error): ScrapedContent => ({ url, error }),
          )
        : { url, response: { title: found[i]?.title, content: found[i]?.content ?? "" } };
      const content = r.response?.content ?? "";
      // Some providers return the page title only as metadata (exa on YouTube: transcript body).
      const title = r.response?.title?.trim() || undefined;
      return { url, ms: Date.now() - s, chars: content.length, error: r.error ?? (content ? undefined : "empty content"), title, content: redact(content).slice(0, DOC_CHARS) };
    }),
  );
  const fetchMs = urls.length && scrape ? Date.now() - f0 : 0;

  const answered = fetches.filter((f) => f.chars > 0);
  const firstError = searchLeg?.error ?? (answered.length === 0 ? fetches.find((f) => f.error)?.error ?? "no search results" : undefined);
  const record = {
    runId,
    round,
    provider,
    taskId: task.id,
    tier: task.tier,
    startedAt,
    search: searchLeg,
    fetches,
    searchMs: searchLeg?.ms ?? 0,
    fetchMs,
    totalMs: (searchLeg?.ms ?? 0) + fetchMs,
    dnf: (searchLeg?.ms ?? 0) > LEG_TIMEOUT_MS || fetchMs > LEG_TIMEOUT_MS,
    answered: answered.length > 0,
    error: firstError ?? null,
    errorClass: firstError ? classifyError(firstError) : null,
    onSite: task.site ? answered.some((f) => hostMatches(f.url, task.site!)) : null,
    siteInResults: task.site && searchLeg ? searchLeg.results.some((r) => hostMatches(r.url, task.site!)) : null,
    costUsd: costUsd(provider, {
      searches: searchLeg && !searchLeg.error ? 1 : 0,
      fetchedUrls: answered.map((f) => f.url),
    }),
  };
  return record;
}

// A provider's burst cap is not its answer: back off and retry, keeping only
// the final attempt (whose timing excludes the wait). Survivors are still
// classified rate_limit and excluded from scoring.
async function runWithRetry(...args: Parameters<typeof runOne>) {
  for (let attempt = 0; ; attempt++) {
    const r = await runOne(...args);
    if (r.answered || r.errorClass !== "rate_limit" || attempt === 2) {
      await append("tasks.jsonl", { ...r, attempts: attempt + 1 });
      return r;
    }
    await new Promise((res) => setTimeout(res, 15000 * (attempt + 1)));
  }
}

async function main() {
  process.env.SURFBENCH_NO_CACHE = "1";

  const scrapers = new Map(scraperClients.map((c) => [c.name, c.scrape]));
  const only = arg("providers")?.split(",");
  const providers = searchClients
    .filter((c) => SEARCH_CONTENT.has(c.name) || scrapers.has(fetchProviderOf(c.name)))
    .filter((c) => !only || only.includes(c.name));
  const taskFilter = arg("tasks")?.split(",");
  const tasks = TASKS.filter((t) => !taskFilter || taskFilter.includes(t.id));
  const rounds = Number(arg("rounds") ?? LIVE_ROUNDS);
  const runId = arg("run") ?? new Date().toISOString().slice(0, 16).replace(":", "-");

  console.log(`SurfBench v2 run ${runId}: ${providers.map((p) => p.name).join(", ")} × ${tasks.length} tasks, ${rounds} round(s)`);
  await fs.mkdir(RAW, { recursive: true });

  // --round N re-runs one round of a run (with a fresh reference capture),
  // e.g. after a feed failed; the new records supersede the old ones.
  const onlyRound = arg("round") ? Number(arg("round")) : null;
  for (let round = onlyRound ?? 1; round <= (onlyRound ?? rounds); round++) {
    const roundTasks = round === 1 || onlyRound ? tasks : tasks.filter(isLive);
    if (roundTasks.length === 0) break;

    // Sequential on purpose: two Reddit feeds requested together get a 429.
    const refs = [];
    for (const t of roundTasks.filter((t) => t.tier === "live-feed")) refs.push(await captureReference(t));
    for (const r of refs) {
      await append("tasks-refs.jsonl", { runId, round, ...r });
      console.log(`  ref ${r.taskId}: ${r.error ? `ERROR ${r.error}` : `${r.items.length} items, e.g. "${r.items[0]}"`}`);
    }

    const t0 = Date.now();
    await Promise.all(
      providers.map(async ({ name, search }) => {
        const limit = createConcurrencyLimiter(TASKS_IN_FLIGHT);
        let done = 0;
        await Promise.all(
          roundTasks.map((task) =>
            limit(async () => {
              const r = await runWithRetry(runId, round, name, search, SEARCH_CONTENT.has(name) ? null : scrapers.get(fetchProviderOf(name))!, task);
              done++;
              if (r.error && !r.answered) console.log(`  [r${round}] ${name} ${task.id}: ${r.errorClass} — ${String(r.error).slice(0, 90)}`);
              if (done % 10 === 0 || done === roundTasks.length) console.log(`  [r${round}] ${name}: ${done}/${roundTasks.length}`);
            }),
          ),
        );
      }),
    );
    console.log(`round ${round} done in ${Math.round((Date.now() - t0) / 1000)}s`);
  }
  console.log(`\nNext: bun run tasks:grade --run ${runId}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

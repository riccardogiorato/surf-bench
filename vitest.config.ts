import { defineConfig } from "vitest/config";
import type { Reporter } from "vitest/reporters";
import VendorTableReporter from "./vitest-vendor-table-reporter.js";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    testTimeout: 900000,
    // Let every vendor's tests run at once; each provider caps its own
    // in-flight requests inside its scraper (see scraperClients.ts).
    // SURFBENCH_TURBO=1 runs the search event one test at a time instead:
    // the rate-limited fast tiers (exa's type:"fast") are serialized inside
    // the client, and concurrent tests would inflate their recorded latency
    // with queue waits instead of raw API time.
    maxConcurrency: process.env.SURFBENCH_TURBO ? 1 : 250,
    // Single worker, no per-file module reset: the per-provider concurrency
    // limiters and exa's request-spacing pacer (searchClients.ts) are plain
    // module-level singletons. Vitest's default per-file isolation gives each
    // test FILE its own fresh module graph, so with the search event split
    // across 12 dim files + answerability.test.ts, each file got its own
    // independent copy of the pacer and only coordinated requests within
    // itself — bursts across files still tripped exa's 10 req/s cap. This
    // does not serialize actual network calls: `it.concurrent` is JS
    // event-loop concurrency within one process, not OS parallelism, so
    // maxConcurrency above still governs real throughput. (Vitest 4 dropped
    // poolOptions.*.singleThread/singleFork; maxWorkers: 1 is the replacement.)
    isolate: false,
    maxWorkers: 1,
    reporters: ["html", "default", new VendorTableReporter() as Reporter],
  },
});

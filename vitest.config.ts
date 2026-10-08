import { defineConfig } from "vitest/config";
import type { Reporter } from "vitest/node";
import VendorTableReporter from "./vitest-vendor-table-reporter.js";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    testTimeout: 900000,
    // Key-gated providers leave empty describe blocks when their API keys
    // are absent; Vitest 5 fails those suites unless this is set.
    passWithNoTests: true,
    // Let every vendor's tests run at once; each provider caps its own
    // in-flight requests inside its scraper (see scraperClients.ts).
    // SURFBENCH_TURBO=1 runs the search event one test at a time instead:
    // the rate-limited fast tiers (exa's type:"fast") are serialized inside
    // the client, and concurrent tests would inflate their recorded latency
    // with queue waits instead of raw API time.
    maxConcurrency: process.env.SURFBENCH_TURBO ? 1 : 250,
    reporters: ["html", "default", new VendorTableReporter() as Reporter],
  },
});

import { defineConfig } from "vitest/config";
import type { Reporter } from "vitest/reporters";
import VendorTableReporter from "./vitest-vendor-table-reporter.js";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    testTimeout: 900000,
    // Let every vendor's tests run at once; each provider caps its own
    // in-flight requests inside its scraper (see scraperClients.ts).
    maxConcurrency: 250,
    reporters: ["html", "default", new VendorTableReporter() as Reporter],
  },
});

import { describe, it, expect } from "vitest";
import type { TestSite } from "../../lib/types.js";
import { evaluateScrapedContent } from "../../lib/contentQuality.js";
import { scraperClients } from "../../lib/scraperClients.js";
import { ALL_TEST_SITES } from "../../lib/testSites.js";
import { recordScrapeRun } from "../../lib/results.js";

const SCRAPE_TIMEOUT_MS = 90000;
const TEST_TIMEOUT_MS = 900000;

// All vendor suites share one concurrent pool so providers run in parallel;
// per-provider load was capped at 5 in-flight per provider inside each scraper.
describe.concurrent("Scrape Event", () => {
  // Run all vendor-site combinations in parallel
  scraperClients.forEach(({ name, scrape }) => {
    describe(`${name} vendor`, () => {
      ALL_TEST_SITES.forEach((testSite: TestSite) => {
        it.concurrent(
          `should scrape ${testSite.name}`,
          async () => {
            const startTime = Date.now();
            const result = await scrape(testSite.url, SCRAPE_TIMEOUT_MS);
            const endTime = Date.now();
            const totalTime = endTime - startTime;
            await recordScrapeRun({
              provider: name,
              site: testSite,
              result,
              wallMs: totalTime,
            });

            // Check that scraping was successful
            expect(result).toBeDefined();
            expect(result.url).toBe(testSite.url);

            // Track failure without throwing error
            if (result.error) {
              console.error(
                `${name} failed to scrape ${testSite.name}: ${result.error}`,
              );
              console.log(
                `${name} scraping failed for ${testSite.name} in ${totalTime}ms`,
              );

              // Mark test as failed but don't throw
              expect(result.error).toBeUndefined(); // This will fail the test
              return; // Exit early
            }

            // If successful, we should have response data
            expect(result.response).toBeDefined();
            expect(result.response!.scrapingTimeMs).toBeGreaterThan(0);

            // Log timing information
            console.log(
              `${name} scraped ${testSite.name} in ${totalTime}ms (reported: ${result.response!.scrapingTimeMs}ms)`,
            );

            // If successful, we should have some content
            expect(result.response!.content!.length).toBeGreaterThan(0);

            const quality = evaluateScrapedContent(testSite, result);
            if (!quality.ok) {
              console.error(
                `${name} returned low-quality content for ${testSite.name}: ${quality.reason}`,
              );
            }
            expect(quality.ok).toBe(true);
          },
          TEST_TIMEOUT_MS,
        );
      });
    });
  });
});
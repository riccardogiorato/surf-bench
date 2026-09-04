import { describe, it, expect } from "vitest";
import { searchClients } from "../../lib/searchClients.js";
import { scraperClients } from "../../lib/scraperClients.js";
import { QUEST_CASES } from "./questCases.js";
import { recordQuestRun, recordSearchRun } from "../../lib/results.js";
import type { QuestResult, ScrapedContent } from "../../lib/types.js";

const SEARCH_TIMEOUT_MS = 30000; // wipeout rule: 30s per leg
const FETCH_TIMEOUT_MS = 30000;
const TEST_TIMEOUT_MS = 900000;

// Providers that have both legs — the quest event is a both-legs event.
const scrapers = new Map(scraperClients.map((c) => [c.name, c.scrape]));
const questProviders = searchClients.filter((c) => scrapers.has(c.name));

describe.concurrent("Quest Event", () => {
  questProviders.forEach(({ name, search }) => {
    describe(`${name} vendor`, () => {
      QUEST_CASES.forEach((quest) => {
        it.concurrent(
          `quest: ${quest.id} — ${quest.question}`,
          async () => {
            // Leg 1: search with the wipeout rule
            const searchStart = Date.now();
            const searchResponse = await search(quest.question, 3);
            const searchMs = Date.now() - searchStart;

            if (searchResponse.error || searchResponse.results.length === 0) {
              const result = {
                provider: name,
                questId: quest.id,
                searchMs,
                fetchMs: 0,
                totalMs: Date.now() - searchStart,
                urlsFetched: [],
                contentChars: 0,
                wipeout: searchMs > SEARCH_TIMEOUT_MS,
                error: searchResponse.error ?? "no search results",
              };
              await recordQuestRun(result);
              expect(result.error).toBeUndefined(); // fail the test, keep the record
              return;
            }

            // Leg 2: fetch top-3 through the provider's own extraction
            const urls = searchResponse.results
              .map((r) => r.url)
              .slice(0, 3);
            const fetchStart = Date.now();
            const fetches = await Promise.all(
              urls.map((url) =>
                scrapers
                  .get(name)!(url, FETCH_TIMEOUT_MS)
                  .catch(
                    (): ScrapedContent => ({ url, error: "fetch failed" }),
                  ),
              ),
            );
            const fetchMs = Date.now() - fetchStart;

            const contents = fetches
              .map((f) => f.response?.content ?? "")
              .filter(Boolean);
            const content = contents.join("\n\n---\n\n");
            const contentChars = content.length;

            const wipeout = searchMs > SEARCH_TIMEOUT_MS || fetches.some((f) => f.error === "fetch failed");
            const result = {
              provider: name,
              questId: quest.id,
              searchMs,
              fetchMs,
              totalMs: searchMs + fetchMs,
              urlsFetched: urls,
              contentChars,
              content,
              wipeout: wipeout || undefined,
              error:
                contentChars === 0 ? "no content extracted" : undefined,
            };
            await recordQuestRun(result);
            expect(result.error).toBeUndefined();
          },
          TEST_TIMEOUT_MS,
        );
      });
    });
  });
});
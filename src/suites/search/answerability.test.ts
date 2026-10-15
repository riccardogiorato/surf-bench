import { describe, it, expect } from "vitest";
import { searchClients } from "../../lib/searchClients.js";
import { recordSearchRun } from "../../lib/results.js";
import { isNonScoring } from "../../lib/errorClass.js";

// The search event's quality axis.
//
// Every other search dimension asks "does a keyword appear in a title or
// domain". That is a capability check, not a quality measure: it cannot tell a
// provider that found the authoritative page from one that found a content
// farm with the right word in its slug. This suite instead hands the ranked
// result set to the judge panel and asks whether a capable agent could answer
// the question from it.
//
// Queries are chosen to be hard to game with a keyword list: they need the
// right SOURCE, not the right string. A provider cannot pass "why does
// PostgreSQL VACUUM FULL lock the table" by returning a page whose title
// contains "postgresql".
//
// This suite only FETCHES and RECORDS. Grading happens offline in
// `bun run judge:search`, for the same reason the quest event works that way:
// judge calls are throttled and slow, so awaiting them inside concurrent tests
// made 71 of 84 cases blow their timeout waiting on a shared limiter. Keeping
// capture separate also means a re-score never has to re-bill the vendors.
//
// Attack surface, stated plainly: a fixed public query list can be tuned
// against over time. These are versioned with the rubric and are expected to
// rotate between releases; scores are only comparable within a query-set
// version (see ANSWERABILITY_SET_VERSION).
export const ANSWERABILITY_SET_VERSION = "2026.10-a";

const QUERIES: string[] = [
  "Why does PostgreSQL VACUUM FULL lock the table?",
  "How do I set a custom timeout in the Python requests library?",
  "Difference between HTTP/2 and HTTP/3 multiplexing",
  "Which company acquired Figma and for how much?",
  "Recommended daily sodium intake for healthy adults",
  "GDPR data retention requirements for server access logs",
  "Rust async trait object safety workaround",
  "What is the population of Lagos, Nigeria?",
  "Mercury planet average distance from the sun in kilometers",
  "Best rated espresso machines under $500",
  "What caused the 2024 CrowdStrike outage?",
  "Kubernetes pod stuck in CrashLoopBackOff how to diagnose",
];

const NUM_RESULTS = 5;

describe.concurrent("Search Event — answerability", () => {
  searchClients.forEach(({ name, search }) => {
    describe(`${name} vendor`, () => {
      QUERIES.forEach((query) => {
        it.concurrent(
          `[answerability] ${query}`,
          async () => {
            const response = await search(query, NUM_RESULTS);

            // A dead billing key or the provider's own per-second cap is not a
            // quality signal. Record it, mark it non-scoring, and do not let
            // it masquerade as "this provider returns bad results".
            if (response.error && isNonScoring(response.error)) {
              await recordSearchRun({
                provider: name,
                dim: "answerability",
                query,
                response,
                assertOk: null as unknown as boolean,
              });
              return;
            }

            await recordSearchRun({
              provider: name,
              dim: "answerability",
              query,
              response,
              // Quality is scored offline, not gated here: the assertion only
              // covers "the provider answered at all".
              assertOk: !response.error && response.results.length > 0,
            });

            expect(response.error).toBeFalsy();
            expect(response.results.length).toBeGreaterThan(0);
          },
          60000,
        );
      });
    });
  });
});

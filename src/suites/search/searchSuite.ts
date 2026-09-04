import { describe, it, expect } from "vitest";
import { searchClients } from "../../lib/searchClients.js";
import { recordSearchRun } from "../../lib/results.js";
import type { SearchResponse } from "../../lib/types.js";

export interface SearchDimCase {
  query: string;
  // per-case assertion payload, opaque to the runner, typed at the dim level
  [key: string]: unknown;
}

// Shared runner for the 12 search dimensions. Each dim file calls
// defineSearchDim<T>(dimName, cases, assertFn) and gets a describe.concurrent
// block across every key-gated search provider, with run recording for the
// report script.
export function defineSearchDim<T extends SearchDimCase>(
  dim: string,
  cases: T[],
  assert: (results: { title: string; url: string }[], testCase: T) => void,
  numResults = 5,
) {
  describe.concurrent(`Search Event — ${dim}`, () => {
    searchClients.forEach(({ name, search }) => {
      describe(`${name} vendor`, () => {
        cases.forEach((testCase) => {
          it.concurrent(
            `[${dim}] ${testCase.query}`,
            async () => {
              const response = await search(testCase.query, numResults);

              let assertOk = false;
              try {
                if (response.error) {
                  expect(response.error).toBeUndefined();
                }
                expect(response.results.length).toBeGreaterThan(0);
                assert(response.results, testCase);
                assertOk = true;
              } finally {
                await recordSearchRun({
                  provider: name,
                  dim,
                  query: testCase.query,
                  response,
                  assertOk,
                });
              }
            },
            120000,
          );
        });
      });
    });
  });
}
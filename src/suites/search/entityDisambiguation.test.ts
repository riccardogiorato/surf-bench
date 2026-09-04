import { expect } from "vitest";
import { defineSearchDim } from "./searchSuite.js";

// Dim 4: entity disambiguation — qualifier steers to the right entity
defineSearchDim(
  "entity-disambiguation",
  [
    { query: "Apple", expected: "apple.com" },
    { query: "Apple fruit", expected: "wikipedia.org/wiki/Apple" },
  ],
  (results, testCase) => {
    expect(
      results.map((r) => r.url).join(" ").includes(testCase.expected)
    ).toBe(true);
  },
  3,
);
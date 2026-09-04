import { defineSearchDim } from "./searchSuite.js";

// Dim 10: recency — results surface the current year for fresh-events queries
defineSearchDim(
  "recency",
  [{ query: "Oscars 2026 winners", expected: "2026" }],
  (results, testCase) => {
    expect(
      results.map((r) => r.title + r.url).join(" ").includes(testCase.expected)
    ).toBe(true);
  },
  3,
);
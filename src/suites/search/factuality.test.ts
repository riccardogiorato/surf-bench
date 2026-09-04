import { expect } from "vitest";
import { defineSearchDim } from "./searchSuite.js";

// Dim 5: factuality/accuracy — the expected entity surfaces for factual queries
defineSearchDim(
  "factuality",
  [
    {
      query: "Who is the president of the United States?",
      expected: "president",
    },
    { query: "Capital of France", expected: "paris" },
    { query: "Largest planet in the solar system", expected: "jupiter" },
  ],
  (results, testCase) => {
    expect(
      results
        .map((r) => r.title + r.url)
        .join(" ")
        .toLowerCase()
        .includes(testCase.expected.toLowerCase())
    ).toBe(true);
  },
  3,
);
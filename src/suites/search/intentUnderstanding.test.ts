import { expect } from "vitest";
import { defineSearchDim } from "./searchSuite.js";

// Dim 6: query intent understanding — ambiguous single tokens resolve to the
// dominant commercial intent
defineSearchDim(
  "intent-understanding",
  [
    { query: "Apple", expected: "apple.com" },
    { query: "Jaguar", expected: "jaguar" },
    { query: "Nasa sls", expected: "nasa.gov" },
  ],
  (results, testCase) => {
    expect(results[0]?.url).toContain(testCase.expected);
  },
  3,
);
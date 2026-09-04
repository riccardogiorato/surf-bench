import { expect } from "vitest";
import { defineSearchDim } from "./searchSuite.js";

// Dim 2: citation quality — authoritative sources rank for topical queries
defineSearchDim(
  "citation-quality",
  [
    { query: "Theory of relativity", expectedDomain: "wikipedia.org" },
    { query: "COVID-19 statistics", expectedDomain: "who.int" },
    { query: "Python programming language", expectedDomain: "python.org" },
  ],
  (results, testCase) => {
    expect(
      results.map((r) => r.url).join(" ").includes(testCase.expectedDomain)
    ).toBe(true);
  },
);
import { expect } from "vitest";
import { defineSearchDim } from "./searchSuite.js";

// Dim 8: link quality — at least one trusted domain in the top results
const trustedDomains = [
  "wikipedia.org",
  "nytimes.com",
  "bbc.com",
  "nature.com",
  "nasa.gov",
  "who.int",
  "python.org",
  "apple.com",
  "tesla.com",
  "jaguar.com",
];

defineSearchDim(
  "link-quality",
  [{ query: "COVID-19 statistics" }, { query: "Theory of relativity" }, { query: "Tesla" }],
  (results) => {
    const urls = results.map((r) => r.url);
    expect(
      trustedDomains.some((domain) => urls.join(" ").includes(domain))
    ).toBe(true);
  },
);
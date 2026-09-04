import { defineSearchDim } from "./searchSuite.js";

// Dim 1: brand homepage retrieval — first result should be the brand's site
defineSearchDim(
  "brand-homepage",
  [
    { query: "Nike", expected: "nike.com" },
    { query: "Apple", expected: "apple.com" },
    { query: "Tesla", expected: "tesla.com" },
  ],
  (results, testCase) => {
    expect(results[0]?.url).toContain(testCase.expected);
  },
  3,
);
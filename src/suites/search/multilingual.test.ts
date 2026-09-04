import { defineSearchDim } from "./searchSuite.js";

// Dim 9: multilingual support — non-English queries return on-language results
defineSearchDim(
  "multilingual",
  [
    { query: "mejores portátiles", contains: ["mejor"] },
    { query: "AI 뉴스", contains: ["AI", "뉴스"] },
    { query: "AI ニュース", contains: ["AI", "ニュース"] },
  ],
  (results, testCase) => {
    const matchCount = results.filter((r) =>
      testCase.contains.some((word) =>
        r.title.toLowerCase().includes((word as string).toLowerCase())
      )
    ).length;
    expect(matchCount).toBeGreaterThanOrEqual(
      Math.ceil(results.length * 0.6)
    );
  },
);
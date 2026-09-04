import { defineSearchDim } from "./searchSuite.js";

// Dim 3: diversity — results should not all come from one domain
function getDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

defineSearchDim(
  "diversity",
  [{ query: "best laptops 2026" }, { query: "AI news" }],
  (results) => {
    const domains = Array.from(
      new Set(results.map((r) => getDomain(r.url)))
    ).filter(Boolean);
    expect(domains.length).toBeGreaterThan(1);
  },
);
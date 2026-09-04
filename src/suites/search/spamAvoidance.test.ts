import { expect } from "vitest";
import { defineSearchDim } from "./searchSuite.js";

// Dim 12: spam/ad avoidance — no obvious spam domains for buy-intent queries
const spamDomains = ["spam.com", "ads.com", "clickbait.com", "malware-download.com"];

defineSearchDim(
  "spam-avoidance",
  [{ query: "buy cheap watches" }, { query: "free iPhone" }],
  (results) => {
    const urls = results.map((r) => r.url);
    const hasSpam = urls.some((url) =>
      spamDomains.some((domain) => url.includes(domain))
    );
    expect(hasSpam).toBe(false);
  },
);
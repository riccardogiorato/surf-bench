import { expect } from "vitest";
import { defineSearchDim } from "./searchSuite.js";

// Dim 12: spam/ad avoidance on buy-intent queries.
//
// This dim previously looked for spam.com, ads.com, clickbait.com and
// malware-download.com. Those domains do not appear in any real SERP, so the
// check passed unconditionally and measured nothing. Rather than maintain a
// hand-curated blocklist of real content farms (which goes stale and invites
// arguments about who belongs on it), the substantive judgement of SEO filler
// now lives in the answerability rubric, which explicitly penalises listicles
// and content farms.
//
// What remains here is the part a list CAN check honestly: a buy-intent query
// should not come back stuffed with the same domain over and over, which is
// the usual shape of an affiliate-spam result set.
const MAX_SHARE_FROM_ONE_DOMAIN = 0.6;

defineSearchDim(
  "spam-avoidance",
  [{ query: "buy cheap watches" }, { query: "free iPhone" }],
  (results) => {
    const domains = results.map((r) => {
      try {
        return new URL(r.url).hostname.replace(/^www\./, "");
      } catch {
        return r.url;
      }
    });
    const counts = new Map<string, number>();
    for (const d of domains) counts.set(d, (counts.get(d) ?? 0) + 1);
    const topShare = Math.max(...counts.values()) / domains.length;
    expect(topShare).toBeLessThanOrEqual(MAX_SHARE_FROM_ONE_DOMAIN);
  },
);

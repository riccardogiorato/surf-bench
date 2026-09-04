import { defineSearchDim } from "./searchSuite.js";

// Dim 7: latency — measured per query in the recorder; this dim exists so the
// runner exercises the most common benchmark queries and p50/p95 come out of
// the recorded runs. No hard assertions — latency is scored, not gated.
defineSearchDim(
  "latency",
  [{ query: "Oscars 2026 winners" }, { query: "AI news" }, { query: "Nike" }],
  () => {
    expect(true).toBe(true);
  },
  3,
);
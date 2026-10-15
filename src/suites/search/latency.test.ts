import { expect } from "vitest";
import { defineSearchDim } from "./searchSuite.js";

// Dim 7: latency probe — exercises the most common benchmark queries so p50/p95
// come out of the recorded runs. Speed is scored on its own axis, never gated.
//
// This dim used to assert `expect(true).toBe(true)`, which passed for every
// provider on every query and silently inflated the headline assertion count
// (a provider erroring on all 29 queries still "passed" these three). The
// assertion now checks the one thing a latency sample requires to be valid:
// that the provider actually returned results to time.
defineSearchDim(
  "latency",
  [{ query: "Oscars 2026 winners" }, { query: "AI news" }, { query: "Nike" }],
  (results) => {
    expect(results.length).toBeGreaterThan(0);
  },
  3,
);

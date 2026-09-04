import { defineSearchDim } from "./searchSuite.js";

// Dim 11: safe search — no explicit/NSFW surfaces for an edgy query
const nsfwTerms = [
  "nude",
  "sex",
  "porn",
  "xxx",
  "nsfw",
  "explicit",
  "uncensored",
  "erotic",
  "boobs",
  "naked",
  "topless",
];

defineSearchDim(
  "safe-search",
  [{ query: "celebrity wardrobe malfunction" }],
  (results) => {
    results.forEach((r) => {
      const text = (r.title + r.url).toLowerCase();
      expect(nsfwTerms.some((term) => text.includes(term))).toBe(false);
    });
  },
);
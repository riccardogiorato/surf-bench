// Scoring constants and helpers shared by taskScoring.ts.

export const WEIGHTS = {
  quality: 0.55, // graded answer quality
  reliability: 0.35, // share of tasks passed
  speed: 0.1, // end-to-end p50, relative to the fastest provider
} as const;

// Overall = weighted sum of per-track composites. Search is what agents mostly
// do; access (opening named pages and bot-walled sites) is a smaller share so
// a vendor's legal stance on one site cannot dominate the board.
export const TRACK_WEIGHTS = {
  search: 0.85,
  access: 0.15,
} as const;

// A provider needs this share of tasks scorable (in every track) before it gets a number.
// Below it the provider is withheld, so a 402'd billing key is never
// published as a damning 0.
export const MIN_COVERAGE = 0.8;

export function quantile(values: number[], q: number): number {
  const s = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (s.length === 0) return 0;
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

// The fastest provider anchors 100. Floored so a slow provider still earns
// something for being correct, capped so speed alone cannot buy the board.
export const SPEED_FLOOR = 0.25;

export function speedScore(p50Ms: number, bestP50Ms: number): number | null {
  if (p50Ms <= 0 || bestP50Ms <= 0) return null;
  return Math.max(SPEED_FLOOR, Math.min(1, bestP50Ms / p50Ms)) * 100;
}

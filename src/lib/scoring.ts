// SurfBench scoring model.
//
// Design goals, in order:
//   1. A provider's score must reflect what it did, not what the harness or
//      the operator's billing did. Cases that never got a fair answer
//      (dead key, the provider's own per-second cap) are excluded, and a
//      provider without enough scored cases gets NO score rather than a zero.
//   2. Quality must dominate. The previous model could award a provider most
//      of its points for returning any non-empty text; here quality is the
//      largest term and comes from the judge panel, not string matching.
//   3. Every number must be reconstructible from results/raw. Deterministic
//      components stay deterministic; judge components are cached by content
//      hash and re-gradable offline.

export const WEIGHTS = {
  quality: 0.5, // judge panel: did you find/return something usable
  reliability: 0.35, // did you get past the wall and return anything at all
  speed: 0.15, // how fast, relative to the fastest provider
} as const;

// An event needs this share of its cases actually scored before it produces a
// number. Below it, the event reports "insufficient data" and the provider is
// excluded from the composite. This is what stops a 402'd billing key from
// being published as a damning 0.
export const MIN_COVERAGE = 0.8;

export interface EventInput {
  total: number; // cases attempted
  nonScoring: number; // cases excluded: quota / rate_limit
  passed: number; // cases that returned usable output
  judgeScores: number[]; // 0-10 verdicts, may be shorter than scored
  times: number[]; // ms, successful cases only
}

export interface EventScore {
  scored: number;
  coverage: number;
  reliability: number | null; // 0-100
  quality: number | null; // 0-100
  p50Ms: number;
  insufficient: boolean;
  reason?: string;
}

export function quantile(values: number[], q: number): number {
  const s = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (s.length === 0) return 0;
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

export function scoreEvent(input: EventInput): EventScore {
  const scored = input.total - input.nonScoring;
  const coverage = input.total > 0 ? scored / input.total : 0;
  const p50Ms = quantile(input.times, 0.5);

  // "Never ran" and "ran but nothing was scorable" are different claims and
  // must not share a message: one is a gap in the run, the other is a billing
  // or rate-limit failure attributable to the operator or the plan.
  if (input.total === 0) {
    return {
      scored: 0,
      coverage: 0,
      reliability: null,
      quality: null,
      p50Ms,
      insufficient: true,
      reason: "event not run for this provider",
    };
  }

  if (scored <= 0 || coverage < MIN_COVERAGE) {
    return {
      scored,
      coverage,
      reliability: null,
      quality: null,
      p50Ms,
      insufficient: true,
      reason:
        scored <= 0
          ? "no scorable cases (all quota or rate-limited)"
          : `only ${Math.round(coverage * 100)}% of cases scorable`,
    };
  }

  return {
    scored,
    coverage,
    reliability: (input.passed / scored) * 100,
    // No judge verdicts means no quality claim — not a quality of zero.
    quality: input.judgeScores.length ? (mean(input.judgeScores) / 10) * 100 : null,
    p50Ms,
    insufficient: false,
  };
}

// A scrape passes when the judge panel finds at least partial main content
// (the rubric's 4-6 band). Pass/fail is graded on the same verdict that feeds
// quality: the deterministic gates it replaced (substring tokens, a prose-volume
// floor) failed complete list pages and passed footer-only extractions.
// Ungraded records have no verdict and are never counted as passes.
export const SCRAPE_PASS_SCORE = 4;

export function scrapePassed(judgeScore: number | null | undefined): boolean {
  return typeof judgeScore === "number" && judgeScore >= SCRAPE_PASS_SCORE;
}

// Speed is relative: the fastest provider in a field anchors 100. Floored so a
// slow provider still earns something for being correct, and capped so a fast
// provider cannot buy the board with speed alone.
export const SPEED_FLOOR = 0.25;

export function speedScore(p50Ms: number, bestP50Ms: number): number | null {
  if (p50Ms <= 0 || bestP50Ms <= 0) return null;
  return Math.max(SPEED_FLOOR, Math.min(1, bestP50Ms / p50Ms)) * 100;
}

export interface CompositeInput {
  reliability: (number | null)[];
  quality: (number | null)[];
  speed: (number | null)[];
}

export interface Composite {
  reliability: number | null;
  quality: number | null;
  speed: number | null;
  overall: number | null;
  withheld?: string;
}

// A composite is only published when the provider actually competed. Without
// these guards a provider that ran one event and errored the rest can top the
// board on a single axis: in a baseline run brave had no scrape or quest data
// at all and scored 100 on speed alone, which is a meaningless number
// presented as a win.
export const MIN_EVENTS_FOR_COMPOSITE = 2;

// Averages each axis across the events that produced a number, then combines
// them with WEIGHTS over only the axes present. A missing axis never silently
// contributes a zero: the remaining weights are renormalised, and the caller
// is expected to show which axes were missing.
export function composite(input: CompositeInput): Composite {
  const axis = (values: (number | null)[]): number | null => {
    const present = values.filter((v): v is number => v !== null);
    return present.length ? mean(present) : null;
  };

  const reliability = axis(input.reliability);
  const quality = axis(input.quality);
  const speed = axis(input.speed);

  // Guard 1: quality is the dominant term, so a composite without it would be
  // a reliability-and-speed score wearing a quality score's name.
  if (quality === null) {
    return {
      reliability,
      quality,
      speed,
      overall: null,
      withheld: "no quality verdicts — composite withheld",
    };
  }

  // Guard 2: enough events must have produced a reliability number for the
  // average to mean anything across the field.
  const eventsScored = input.reliability.filter((v) => v !== null).length;
  if (eventsScored < MIN_EVENTS_FOR_COMPOSITE) {
    return {
      reliability,
      quality,
      speed,
      overall: null,
      withheld: `only ${eventsScored} event(s) scored — composite withheld`,
    };
  }

  const terms: Array<[number | null, number]> = [
    [quality, WEIGHTS.quality],
    [reliability, WEIGHTS.reliability],
    [speed, WEIGHTS.speed],
  ];
  const present = terms.filter((t): t is [number, number] => t[0] !== null);
  const weightSum = present.reduce((s, [, w]) => s + w, 0);
  const overall = weightSum
    ? present.reduce((s, [v, w]) => s + v * w, 0) / weightSum
    : null;

  return { reliability, quality, speed, overall };
}

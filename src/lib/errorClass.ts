// Error taxonomy: separates "this provider did its job badly" from "this
// harness never got a fair answer out of the provider".
//
// This distinction is the backbone of a non-attackable score. A provider whose
// billing key is dead returns HTTP 402 on every case; graded naively that is a
// perfect 0, which reads as a damning quality verdict and is really a bug in
// the bench operator's account. The same applies to the provider's own
// per-second rate cap when the harness fires faster than the plan allows.
//
//   quota      - billing/credit/auth: NOT the provider's quality. Excluded
//                from scoring, surfaced as an explicit "no data" state.
//   rate_limit - the harness outran the plan's cap. Retried; survivors are
//                excluded from scoring rather than counted as failures.
//   timeout    - provider was too slow to answer. Counts against it.
//   blocked    - provider could not get past a bot wall. Counts against it:
//                getting past it is part of what is measured.
//   empty      - provider answered, with nothing usable. Counts against it.
//   provider   - any other provider-side failure. Counts against it.

export type ErrorClass =
  | "quota"
  | "rate_limit"
  | "timeout"
  | "blocked"
  | "empty"
  | "provider";

// Classes that must never be scored as a quality failure.
export const NON_SCORING: ReadonlySet<ErrorClass> = new Set<ErrorClass>([
  "quota",
  "rate_limit",
]);

// Order matters. rate_limit is tested BEFORE quota because providers tend to
// point at their billing docs inside a rate-limit message: exa's reads
// "Rate limit exceeded: 10 requests per second ... see
// https://exa.ai/docs/admin/billing#rate-limits", whose URL alone made it
// classify as a dead billing key. Both are excluded from scoring either way,
// but "we hit your rate cap" and "your key is unfunded" are very different
// things to tell a vendor, and the audit output is only credible if it can
// tell them apart.
const PATTERNS: Array<[ErrorClass, RegExp]> = [
  ["rate_limit", /\b429\b|rate.?limit|too many requests|requests per second|slow down|excessive requests|reduce the rate/i],
  [
    "quota",
    /\b402\b|insufficient credit|insufficient_quota|payment required|out of credits?|quota exceeded|credit limit|usage limit|exceeds your plan|plan and billing|billing details|\b401\b|\b403 .*(api key|unauthorized)|invalid api key|unauthorized/i,
  ],
  ["timeout", /timed? ?out|timeout|etimedout|deadline exceeded|aborted/i],
  [
    "blocked",
    /captcha|are you a robot|access denied|forbidden|just a moment|please wait while we verify|unsupported browser|bot detection|cloudflare|sign in to continue|login wall|consent/i,
  ],
  ["empty", /no content|empty|content too short|no search results|does not match expected/i],
];

export function classifyError(message: string | null | undefined): ErrorClass | null {
  if (!message) return null;
  for (const [cls, re] of PATTERNS) {
    if (re.test(message)) return cls;
  }
  return "provider";
}

export function isNonScoring(message: string | null | undefined): boolean {
  const cls = classifyError(message);
  return cls !== null && NON_SCORING.has(cls);
}

export function isRetryable(message: string | null | undefined): boolean {
  const cls = classifyError(message);
  return cls === "rate_limit" || cls === "timeout";
}

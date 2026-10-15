import { describe, it, expect } from "vitest";
import { composite, scoreEvent, speedScore, MIN_COVERAGE } from "./scoring.js";

const base = { total: 0, nonScoring: 0, passed: 0, judgeScores: [], times: [] };

describe("scoreEvent", () => {
  it("withholds a score when every case was quota-blocked", () => {
    // The exact shape of a dead billing key: parallel returned HTTP 402 on all
    // 50 scrape URLs. Scored naively that is 0%, which reads as a damning
    // quality verdict for what is really an unfunded account.
    const s = scoreEvent({ ...base, total: 50, nonScoring: 50, passed: 0 });
    expect(s.insufficient).toBe(true);
    expect(s.reliability).toBeNull();
    expect(s.quality).toBeNull();
    expect(s.reason).toMatch(/quota|rate-limited/);
  });

  it("distinguishes 'never ran' from 'nothing was scorable'", () => {
    expect(scoreEvent({ ...base, total: 0 }).reason).toMatch(/not run/);
    expect(scoreEvent({ ...base, total: 10, nonScoring: 10 }).reason).toMatch(/quota/);
  });

  it("excludes non-scoring cases from the denominator", () => {
    // 20 cases, 4 rate-limited, 12 of the remaining 16 passed => 75%, not the
    // 60% you would get by counting rate-limited cases as failures.
    const s = scoreEvent({ ...base, total: 20, nonScoring: 4, passed: 12 });
    expect(s.scored).toBe(16);
    expect(s.reliability).toBe(75);
  });

  it("refuses to score below the coverage floor", () => {
    const s = scoreEvent({ ...base, total: 100, nonScoring: 40, passed: 60 });
    expect(s.coverage).toBeLessThan(MIN_COVERAGE);
    expect(s.insufficient).toBe(true);
  });

  it("reports no quality rather than zero quality when unjudged", () => {
    const s = scoreEvent({ ...base, total: 10, passed: 10 });
    expect(s.reliability).toBe(100);
    expect(s.quality).toBeNull();
  });
});

describe("speedScore", () => {
  it("anchors the fastest provider at 100 and floors the slowest", () => {
    expect(speedScore(1000, 1000)).toBe(100);
    expect(speedScore(2000, 1000)).toBe(50);
    expect(speedScore(100000, 1000)).toBe(25); // floored, never 0
    expect(speedScore(0, 1000)).toBeNull();
  });
});

describe("composite", () => {
  it("withholds the overall score when there are no quality verdicts", () => {
    // Otherwise a 'quality' leaderboard is really a speed leaderboard: in a
    // baseline run brave had only search latency data and scored 100 overall.
    const c = composite({
      reliability: [90, null, null],
      quality: [null, null, null],
      speed: [100, null, null],
    });
    expect(c.overall).toBeNull();
    expect(c.withheld).toMatch(/quality/);
  });

  it("withholds the overall score when too few events were scored", () => {
    const c = composite({
      reliability: [90, null, null],
      quality: [80, null, null],
      speed: [100, null, null],
    });
    expect(c.overall).toBeNull();
    expect(c.withheld).toMatch(/event/);
  });

  it("weights quality above reliability and speed", () => {
    const strongQuality = composite({
      reliability: [50, 50, null],
      quality: [100, 100, null],
      speed: [50, 50, null],
    });
    const strongSpeed = composite({
      reliability: [50, 50, null],
      quality: [50, 50, null],
      speed: [100, 100, null],
    });
    expect(strongQuality.overall!).toBeGreaterThan(strongSpeed.overall!);
  });

  it("renormalises instead of treating a missing axis as zero", () => {
    const c = composite({
      reliability: [80, 80, null],
      quality: [80, 80, null],
      speed: [null, null, null],
    });
    expect(c.overall).toBe(80);
  });
});

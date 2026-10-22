import { describe, expect, it } from "vitest";
import { scoreProviders, type RunOutcome } from "./taskScoring.js";

const ids = Array.from({ length: 20 }, (_, i) => `t${i}`);

function runs(provider: string, scoreFor: (i: number) => number, opts: Partial<RunOutcome> = {}): RunOutcome[] {
  return ids.map((taskId, i) => {
    const score = scoreFor(i);
    return { provider, taskId, score, pass: score >= 0.8, totalMs: 2000, answered: true, nonScoring: false, costUsd: 0.01, ...opts };
  });
}

describe("scoreProviders", () => {
  it("withholds a provider below the coverage guard instead of scoring it zero", () => {
    const out = scoreProviders(
      [...runs("a", () => 1), ...runs("b", () => 0, { nonScoring: true })],
      ids,
      { iterations: 50 },
    );
    const b = out.find((p) => p.provider === "b")!;
    expect(b.overall).toBeNull();
    expect(b.withheld).toMatch(/scorable/);
  });

  it("separates a clearly better provider and ties near-identical ones", () => {
    const out = scoreProviders(
      [
        ...runs("strong", () => 1),
        ...runs("weak", () => 0.2),
        ...runs("weak2", (i) => (i === 0 ? 0.3 : 0.2)),
      ],
      ids,
      { iterations: 500 },
    );
    const g = Object.fromEntries(out.map((p) => [p.provider, p.group]));
    expect(g.strong).toBe(1);
    expect(g.weak).toBe(g.weak2);
    expect(g.weak).not.toBe(g.strong);
  });

  it("averages repeated rounds so a task never weighs more for being repeated", () => {
    const repeated = [
      ...runs("a", () => 1),
      ...runs("a", () => 0).slice(0, 1), // t0 failed in a second round
    ];
    const a = scoreProviders(repeated, ids, { iterations: 10 })[0];
    expect(a.quality).toBeCloseTo(((19 + 0.5) / 20) * 100);
  });

  it("is reproducible for the same records and seed", () => {
    const rs = [...runs("a", (i) => (i % 3) / 2), ...runs("b", (i) => (i % 2) * 0.9)];
    expect(scoreProviders(rs, ids, { iterations: 200 })).toEqual(scoreProviders(rs, ids, { iterations: 200 }));
  });
});

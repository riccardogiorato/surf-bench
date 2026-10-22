import { MIN_COVERAGE, WEIGHTS, quantile, speedScore } from "./scoring.js";

// The task is the unit. A task's score and pass are averaged over its rounds
// (live tasks run LIVE_ROUNDS times), so a task never weighs more because it
// was repeated. Uncertainty comes from a paired bootstrap over tasks.

export interface RunOutcome {
  provider: string;
  taskId: string;
  score: number; // 0..1
  pass: boolean;
  totalMs: number;
  answered: boolean; // returned any content (speed counts these only)
  nonScoring: boolean; // quota / rate_limit: excluded, never a zero
  costUsd: number | null;
}

export interface ProviderScore {
  provider: string;
  tasksScored: number;
  coverage: number;
  quality: number | null; // 0-100
  reliability: number | null; // 0-100
  p50Ms: number;
  speed: number | null;
  overall: number | null;
  ci: [number, number] | null; // 95% bootstrap interval on overall
  group: number | null; // providers sharing a group are statistically tied
  costUsd: number;
  passes: number; // pass-weighted run count, for $ per 1k passed tasks
  usdPer1kPassed: number | null;
  withheld?: string;
}

interface TaskAgg {
  score: number;
  pass: number;
  times: number[];
}

function aggregate(runs: RunOutcome[]): Map<string, TaskAgg> {
  const byTask = new Map<string, RunOutcome[]>();
  for (const r of runs) {
    if (r.nonScoring) continue;
    (byTask.get(r.taskId) ?? byTask.set(r.taskId, []).get(r.taskId)!).push(r);
  }
  const out = new Map<string, TaskAgg>();
  for (const [id, rs] of byTask) {
    out.set(id, {
      score: rs.reduce((s, r) => s + r.score, 0) / rs.length,
      pass: rs.reduce((s, r) => s + (r.pass ? 1 : 0), 0) / rs.length,
      times: rs.filter((r) => r.answered).map((r) => r.totalMs),
    });
  }
  return out;
}

function axes(aggs: Map<string, TaskAgg>, taskIds: string[]) {
  const picked = taskIds.map((id) => aggs.get(id)).filter((a): a is TaskAgg => !!a);
  if (picked.length === 0) return null;
  return {
    quality: (picked.reduce((s, a) => s + a.score, 0) / picked.length) * 100,
    reliability: (picked.reduce((s, a) => s + a.pass, 0) / picked.length) * 100,
    p50Ms: quantile(picked.flatMap((a) => a.times), 0.5),
  };
}

function combine(quality: number, reliability: number, speed: number | null): number {
  const terms: Array<[number, number]> = [
    [quality, WEIGHTS.quality],
    [reliability, WEIGHTS.reliability],
    ...(speed !== null ? [[speed, WEIGHTS.speed] as [number, number]] : []),
  ];
  const w = terms.reduce((s, [, x]) => s + x, 0);
  return terms.reduce((s, [v, x]) => s + v * x, 0) / w;
}

// Deterministic PRNG so a published CI is reproducible from the same records.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function scoreProviders(
  runs: RunOutcome[],
  allTaskIds: string[],
  opts: { iterations?: number; seed?: number } = {},
): ProviderScore[] {
  const iterations = opts.iterations ?? 2000;
  const providers = [...new Set(runs.map((r) => r.provider))].sort();
  const aggs = new Map(providers.map((p) => [p, aggregate(runs.filter((r) => r.provider === p))]));

  const point = new Map(providers.map((p) => [p, axes(aggs.get(p)!, allTaskIds)]));
  const eligible = providers.filter((p) => {
    const covered = aggs.get(p)!.size / allTaskIds.length;
    return point.get(p) && covered >= MIN_COVERAGE;
  });
  const bestP50 = Math.min(...eligible.map((p) => point.get(p)!.p50Ms).filter((v) => v > 0));

  const overall = new Map<string, number>();
  for (const p of eligible) {
    const a = point.get(p)!;
    overall.set(p, combine(a.quality, a.reliability, speedScore(a.p50Ms, bestP50)));
  }

  // Paired bootstrap: every provider is re-scored on the SAME resampled task
  // set, so the CI on a gap reflects task difficulty shared by both.
  const rand = mulberry32(opts.seed ?? 20261022);
  const samples = new Map<string, number[]>(eligible.map((p) => [p, []]));
  for (let b = 0; b < iterations; b++) {
    const ids = allTaskIds.map(() => allTaskIds[Math.floor(rand() * allTaskIds.length)]);
    const ax = new Map(eligible.map((p) => [p, axes(aggs.get(p)!, ids)]));
    const best = Math.min(...eligible.map((p) => ax.get(p)?.p50Ms ?? 0).filter((v) => v > 0));
    for (const p of eligible) {
      const a = ax.get(p);
      samples.get(p)!.push(a ? combine(a.quality, a.reliability, speedScore(a.p50Ms, best)) : Number.NaN);
    }
  }
  const ci = (xs: number[]): [number, number] => {
    const s = xs.filter((x) => !Number.isNaN(x)).sort((a, b) => a - b);
    return [s[Math.floor(s.length * 0.025)], s[Math.ceil(s.length * 0.975) - 1]];
  };

  // Tie groups: walk down the ranking; a provider joins the current group if
  // the 95% CI of its gap to the group's head includes 0.
  const ranked = [...eligible].sort((a, b) => overall.get(b)! - overall.get(a)!);
  const group = new Map<string, number>();
  let g = 0;
  let head = ranked[0];
  for (const p of ranked) {
    if (p !== head) {
      const gaps = samples.get(head)!.map((x, i) => x - samples.get(p)![i]);
      const [lo] = ci(gaps);
      if (lo > 0) {
        g++;
        head = p;
      }
    }
    group.set(p, g + 1);
  }

  return providers
    .map((p): ProviderScore => {
      const prs = runs.filter((r) => r.provider === p);
      const a = point.get(p);
      const tasksScored = aggs.get(p)!.size;
      const costUsd = prs.reduce((s, r) => s + (r.costUsd ?? 0), 0);
      // Pass-weighted the same way scores are: a task passed in 2 of 3 rounds
      // counts 2/3 of a pass, over a run count normalised to one per task.
      const passes = [...aggs.get(p)!.values()].reduce((s, t) => s + t.pass, 0);
      const runsPerTask = prs.filter((r) => !r.nonScoring).length / Math.max(1, tasksScored);
      const costPerTask = costUsd / Math.max(1, runsPerTask);
      const base = {
        provider: p,
        tasksScored,
        coverage: tasksScored / allTaskIds.length,
        p50Ms: a?.p50Ms ?? 0,
        costUsd,
        passes,
        usdPer1kPassed: passes > 0 ? (costPerTask / passes) * 1000 : null,
      };
      if (!eligible.includes(p)) {
        return {
          ...base,
          quality: null,
          reliability: null,
          speed: null,
          overall: null,
          ci: null,
          group: null,
          withheld: `only ${Math.round(base.coverage * 100)}% of tasks scorable`,
        };
      }
      return {
        ...base,
        quality: a!.quality,
        reliability: a!.reliability,
        speed: speedScore(a!.p50Ms, bestP50),
        overall: overall.get(p)!,
        ci: ci(samples.get(p)!),
        group: group.get(p)!,
      };
    })
    .sort((x, y) => (y.overall ?? -1) - (x.overall ?? -1));
}

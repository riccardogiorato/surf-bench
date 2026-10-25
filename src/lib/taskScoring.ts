import { MIN_COVERAGE, WEIGHTS, quantile, speedScore } from "./scoring.js";

// The task is the unit. A task's score and pass are averaged over its rounds
// (live tasks run LIVE_ROUNDS times), so a task never weighs more because it
// was repeated. Tasks are split into weighted tracks: each track gets its own
// composite, and overall is their weighted sum. Uncertainty comes from a paired
// bootstrap over tasks, resampled within each track.

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

export interface TrackDef {
  name: string;
  weight: number;
  taskIds: string[];
}

export interface TrackScore {
  coverage: number;
  quality: number | null; // 0-100
  reliability: number | null; // 0-100
  p50Ms: number;
  speed: number | null; // relative to the fastest eligible row in this track
  score: number | null; // the track composite
}

export interface ProviderScore {
  provider: string;
  tasksScored: number;
  coverage: number;
  quality: number | null; // 0-100, track-weighted
  reliability: number | null; // 0-100, track-weighted
  p50Ms: number; // over all tasks, for display
  speed: number | null; // track-weighted
  overall: number | null;
  ci: [number, number] | null; // 95% bootstrap interval on overall
  group: number | null; // providers sharing a group are statistically tied
  tracks: Record<string, TrackScore>;
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
type Axes = NonNullable<ReturnType<typeof axes>>;

function combine(quality: number, reliability: number, speed: number | null): number {
  const terms: Array<[number, number]> = [
    [quality, WEIGHTS.quality],
    [reliability, WEIGHTS.reliability],
    ...(speed !== null ? [[speed, WEIGHTS.speed] as [number, number]] : []),
  ];
  const w = terms.reduce((s, [, x]) => s + x, 0);
  return terms.reduce((s, [v, x]) => s + v * x, 0) / w;
}

// Per-track axes for every provider on one task sample, speed anchored on the
// fastest provider in that track; overall is the weighted sum of composites.
function scoreSample(providers: string[], aggs: Map<string, Map<string, TaskAgg>>, tracks: TrackDef[], idsByTrack: string[][]) {
  const perTrack = tracks.map((_, i) => {
    const ax = new Map(providers.map((p) => [p, axes(aggs.get(p)!, idsByTrack[i])]));
    const best = Math.min(...providers.map((p) => ax.get(p)?.p50Ms ?? 0).filter((v) => v > 0));
    return { ax, best };
  });
  const totalW = tracks.reduce((s, t) => s + t.weight, 0);
  const overall = new Map<string, number>();
  for (const p of providers) {
    let sum = 0;
    for (let i = 0; i < tracks.length; i++) {
      const a = perTrack[i].ax.get(p);
      if (!a) {
        sum = Number.NaN;
        break;
      }
      sum += tracks[i].weight * combine(a.quality, a.reliability, speedScore(a.p50Ms, perTrack[i].best));
    }
    overall.set(p, sum / totalW);
  }
  return { perTrack, overall };
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
  tracksIn: TrackDef[] | string[],
  opts: { iterations?: number; seed?: number } = {},
): ProviderScore[] {
  const tracks: TrackDef[] = typeof tracksIn[0] === "string" || tracksIn.length === 0
    ? [{ name: "all", weight: 1, taskIds: tracksIn as string[] }]
    : (tracksIn as TrackDef[]).filter((t) => t.taskIds.length > 0 && t.weight > 0);
  const allTaskIds = tracks.flatMap((t) => t.taskIds);
  const iterations = opts.iterations ?? 2000;
  const providers = [...new Set(runs.map((r) => r.provider))].sort();
  const aggs = new Map(providers.map((p) => [p, aggregate(runs.filter((r) => r.provider === p))]));

  const trackCoverage = (p: string, t: TrackDef) => t.taskIds.filter((id) => aggs.get(p)!.has(id)).length / t.taskIds.length;
  const eligible = providers.filter((p) => tracks.every((t) => trackCoverage(p, t) >= MIN_COVERAGE));
  const point = scoreSample(eligible, aggs, tracks, tracks.map((t) => t.taskIds));

  // Paired bootstrap: every provider is re-scored on the SAME resampled task
  // set (stratified by track), so the CI on a gap reflects task difficulty
  // shared by both.
  const rand = mulberry32(opts.seed ?? 20261022);
  const samples = new Map<string, number[]>(eligible.map((p) => [p, []]));
  for (let b = 0; b < iterations; b++) {
    const ids = tracks.map((t) => t.taskIds.map(() => t.taskIds[Math.floor(rand() * t.taskIds.length)]));
    const s = scoreSample(eligible, aggs, tracks, ids);
    for (const p of eligible) samples.get(p)!.push(s.overall.get(p)!);
  }
  const ci = (xs: number[]): [number, number] => {
    const s = xs.filter((x) => !Number.isNaN(x)).sort((a, b) => a - b);
    return [s[Math.floor(s.length * 0.025)], s[Math.ceil(s.length * 0.975) - 1]];
  };

  // Tie groups: walk down the ranking; a provider joins the current group if
  // the 95% CI of its gap to the group's head includes 0.
  const ranked = [...eligible].sort((a, b) => point.overall.get(b)! - point.overall.get(a)!);
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

  const totalW = tracks.reduce((s, t) => s + t.weight, 0);
  const weighted = (f: (a: Axes, i: number) => number | null, p: string) => {
    let sum = 0;
    for (let i = 0; i < tracks.length; i++) {
      const a = point.perTrack[i].ax.get(p);
      const v = a ? f(a, i) : null;
      if (v === null) return null;
      sum += tracks[i].weight * v;
    }
    return sum / totalW;
  };

  return providers
    .map((p): ProviderScore => {
      const prs = runs.filter((r) => r.provider === p);
      const isEligible = eligible.includes(p);
      const tasksScored = allTaskIds.filter((id) => aggs.get(p)!.has(id)).length;
      const costUsd = prs.reduce((s, r) => s + (r.costUsd ?? 0), 0);
      // Pass-weighted the same way scores are: a task passed in 2 of 3 rounds
      // counts 2/3 of a pass, over a run count normalised to one per task.
      const passes = [...aggs.get(p)!.values()].reduce((s, t) => s + t.pass, 0);
      const runsPerTask = prs.filter((r) => !r.nonScoring).length / Math.max(1, aggs.get(p)!.size);
      const costPerTask = costUsd / Math.max(1, runsPerTask);
      const trackScores = Object.fromEntries(
        tracks.map((t, i): [string, TrackScore] => {
          const a = axes(aggs.get(p)!, t.taskIds);
          const speed = isEligible && a ? speedScore(a.p50Ms, point.perTrack[i].best) : null;
          return [t.name, {
            coverage: trackCoverage(p, t),
            quality: isEligible ? a?.quality ?? null : null,
            reliability: isEligible ? a?.reliability ?? null : null,
            p50Ms: a?.p50Ms ?? 0,
            speed,
            score: isEligible && a ? combine(a.quality, a.reliability, speed) : null,
          }];
        }),
      );
      const base = {
        provider: p,
        tasksScored,
        coverage: tasksScored / allTaskIds.length,
        p50Ms: axes(aggs.get(p)!, allTaskIds)?.p50Ms ?? 0,
        tracks: trackScores,
        costUsd,
        passes,
        usdPer1kPassed: passes > 0 ? (costPerTask / passes) * 1000 : null,
      };
      if (!isEligible) {
        const short = tracks.filter((t) => trackCoverage(p, t) < MIN_COVERAGE);
        return {
          ...base,
          quality: null,
          reliability: null,
          speed: null,
          overall: null,
          ci: null,
          group: null,
          withheld: short.map((t) => `only ${Math.round(trackCoverage(p, t) * 100)}% of ${tracks.length > 1 ? `${t.name} ` : ""}tasks scorable`).join("; "),
        };
      }
      return {
        ...base,
        quality: weighted((a) => a.quality, p),
        reliability: weighted((a) => a.reliability, p),
        speed: weighted((a, i) => speedScore(a.p50Ms, point.perTrack[i].best), p),
        overall: point.overall.get(p)!,
        ci: ci(samples.get(p)!),
        group: group.get(p)!,
      };
    })
    .sort((x, y) => (y.overall ?? -1) - (x.overall ?? -1));
}

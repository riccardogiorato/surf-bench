import "dotenv/config";
import { createHash } from "crypto";
import fs from "fs/promises";
import { judgePanelPreflight } from "../src/lib/judge/judge.js";
import { READER_ID, TASK_RUBRIC_ID } from "../src/lib/judge/rubrics.js";
import { gradeTask, READER_MODEL } from "../src/lib/taskGrading.js";
import { normalizeReference, type ReferenceCapture } from "../src/lib/references.js";
import { TASKS, hostMatches, type Task } from "../src/lib/tasks.js";

// Grades a recorded v2 run offline: reader + answer key for stable and
// live-feed tasks, the judge panel's yes/no constraints for live-judge tasks.
// Resumable: records already graded under the current reader/rubric stamp are
// skipped; grading errors are written with `error` and retried next pass.
//
//   bun run tasks:grade              latest run
//   bun run tasks:grade --run <id>

const RAW = "results/raw";
// Bump when grader logic in taskGrading.ts changes; answer-key edits are
// picked up automatically through the contract hash.
const GRADER_VERSION = 2;
const CONTRACT_ID = createHash("sha256")
  .update(JSON.stringify(TASKS.map((t) => ({ ...t, verified: undefined, facts: t.facts?.map((f) => [f.q, f.pattern.source, f.pattern.flags]) }))))
  .digest("hex")
  .slice(0, 8);
export const GRADE_STAMP = `${READER_MODEL}:${READER_ID}:${TASK_RUBRIC_ID}:${CONTRACT_ID}:g${GRADER_VERSION}`;

export async function readJsonl<T = any>(file: string): Promise<T[]> {
  try {
    return (await fs.readFile(file, "utf-8"))
      .split("\n")
      .filter(Boolean)
      .flatMap((l) => {
        try {
          return [JSON.parse(l)];
        } catch {
          return [];
        }
      });
  } catch {
    return [];
  }
}

export const runKey = (r: { runId: string; round: number; provider: string; taskId: string }) =>
  `${r.runId}|${r.round}|${r.provider}|${r.taskId}`;

// A `--round` redo appends a newer record under the same key; a grade only
// counts for the exact record it was computed from.
export function gradeIsCurrent(g: any, r: any): boolean {
  return !!g && !g.error && g.stamp === GRADE_STAMP && g.recordAt === r.startedAt;
}

// Recomputed from the stored fetches so site-alias fixes apply to old runs.
export function onSite(task: Task, r: any): boolean {
  return !!task.site && (r.fetches ?? []).some((f: any) => f.chars > 0 && hostMatches(f.url, task.site!));
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const records = await readJsonl(`${RAW}/tasks.jsonl`);
  if (records.length === 0) throw new Error("no records in results/raw/tasks.jsonl — run `bun run tasks` first");
  const runId = arg("run") ?? records[records.length - 1].runId;
  const latest = new Map<string, any>();
  for (const r of records.filter((r) => r.runId === runId)) latest.set(runKey(r), r);

  const refs = new Map<string, ReferenceCapture>();
  for (const r of await readJsonl(`${RAW}/tasks-refs.jsonl`)) {
    if (r.runId === runId) refs.set(`${r.round}|${r.taskId}`, r);
  }

  const graded = new Map<string, any>();
  for (const g of await readJsonl(`${RAW}/tasks-graded.jsonl`)) graded.set(runKey(g), g);
  const todo = [...latest.values()].filter((r) => {
    const g = graded.get(runKey(r));
    return !gradeIsCurrent(g, r);
  });
  console.log(`run ${runId}: ${latest.size} records, ${todo.length} to grade (stamp ${GRADE_STAMP})`);

  if (todo.some((r) => r.tier === "live-judge" && r.answered)) {
    const pre = await judgePanelPreflight();
    if (!pre.ok) throw new Error(`judge panel unavailable: ${pre.reason}`);
  }

  const runDate = runId.slice(0, 10);
  let done = 0;
  let errors = 0;
  // One writer at a time: concurrent appends of multi-KB lines can interleave.
  let chain = Promise.resolve();
  const write = (line: string) => (chain = chain.then(() => fs.appendFile(`${RAW}/tasks-graded.jsonl`, line)));
  await Promise.all(
    todo.map(async (r) => {
      const task = TASKS.find((t) => t.id === r.taskId);
      if (!task) return;
      const docs = (r.fetches ?? []).filter((f: any) => f.chars > 0).map((f: any) => ({ url: f.url, title: f.title, content: f.content }));
      const ref = refs.get(`${r.round}|${r.taskId}`);
      const grade = await gradeTask({
        task,
        docs,
        onSite: onSite(task, r),
        runDate,
        reference: ref && normalizeReference(task, ref),
      });
      if (grade.error) errors++;
      await write(
        JSON.stringify({ runId: r.runId, round: r.round, provider: r.provider, taskId: r.taskId, recordAt: r.startedAt, stamp: GRADE_STAMP, ...grade }) + "\n",
      );
      done++;
      if (done % 25 === 0 || done === todo.length) console.log(`  graded ${done}/${todo.length} (${errors} errors)`);
    }),
  );
  if (errors) console.log(`${errors} records failed grading — re-run tasks:grade to retry them.`);
  console.log(`Next: bun run tasks:report --run ${runId}`);
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

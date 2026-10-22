import { NON_SCORING, classifyError, type ErrorClass } from "../src/lib/errorClass.js";
import { PRICES } from "../src/lib/pricing.js";
import { AGENT_CHECK, AGENT_DRAFT, LIVE_ROUNDS, TASKS, isLive } from "../src/lib/tasks.js";
import { gradeIsCurrent, readJsonl, runKey } from "./tasks-grade.js";

// v2 publish gate. Exits non-zero on anything that would make a published
// number unverifiable: unverified answer keys, missing references, ungraded
// runs, missing price entries, or a provider/task cell that never ran.

const RAW = "results/raw";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const blocking: string[] = [];
  const warnings: string[] = [];

  const unverified = TASKS.filter((t) => t.verified.by === AGENT_DRAFT || t.verified.evidence.length === 0 && t.tier !== "live-judge");
  if (unverified.length) blocking.push(`${unverified.length} tasks lack verification: ${unverified.map((t) => t.id).join(", ")}`);
  const agentChecked = TASKS.filter((t) => t.verified.by === AGENT_CHECK);
  if (agentChecked.length) {
    const msg = `${agentChecked.length} tasks are agent-checked, not human-verified`;
    if (process.argv.includes("--provisional")) warnings.push(`${msg} — publish only as PROVISIONAL`);
    else blocking.push(`${msg} (pass --provisional to publish a labelled provisional report)`);
  }

  const records = await readJsonl(`${RAW}/tasks.jsonl`);
  const runId = arg("run") ?? records[records.length - 1]?.runId;
  if (!runId) {
    blocking.push("no run recorded");
  } else {
    const runs = new Map<string, any>();
    for (const r of records.filter((r) => r.runId === runId)) runs.set(runKey(r), r);
    const grades = new Map<string, any>();
    for (const g of await readJsonl(`${RAW}/tasks-graded.jsonl`)) if (g.runId === runId) grades.set(runKey(g), g);
    const refs = (await readJsonl(`${RAW}/tasks-refs.jsonl`)).filter((r) => r.runId === runId);
    const providers = [...new Set([...runs.values()].map((r) => r.provider))];

    for (const p of providers) {
      if (!PRICES[p]) blocking.push(`no pricing entry for ${p}`);
      for (const t of TASKS) {
        const rounds = isLive(t) ? LIVE_ROUNDS : 1;
        for (let round = 1; round <= rounds; round++) {
          const k = runKey({ runId, round, provider: p, taskId: t.id });
          const r = runs.get(k);
          if (!r) {
            blocking.push(`missing run: ${p} ${t.id} round ${round}`);
            continue;
          }
          r.errorClass = classifyError(r.error);
          const nonScoring = !r.answered && r.errorClass && NON_SCORING.has(r.errorClass as ErrorClass);
          const g = grades.get(k);
          if (!nonScoring && !gradeIsCurrent(g, r)) blocking.push(`ungraded: ${p} ${t.id} round ${round}${g?.error ? ` (${g.error.slice(0, 60)})` : ""}`);
          if (nonScoring) warnings.push(`non-scoring ${r.errorClass}: ${p} ${t.id} round ${round}`);
        }
      }
    }
    for (const t of TASKS.filter((t) => t.tier === "live-feed")) {
      for (let round = 1; round <= LIVE_ROUNDS; round++) {
        const ref = refs.filter((r) => r.taskId === t.id && r.round === round).pop();
        if (!ref || ref.error || ref.items.length === 0) blocking.push(`no reference: ${t.id} round ${round}${ref?.error ? ` (${ref.error})` : ""}`);
      }
    }
    // Judge health: constraint verdicts where the two judges disagree.
    let split = 0;
    let total = 0;
    for (const g of grades.values()) {
      for (const c of g.constraints ?? []) {
        total++;
        if (c.value > 0 && c.value < 1) split++;
      }
    }
    if (total) warnings.push(`judges disagree on ${split}/${total} constraint verdicts (${Math.round((split / total) * 100)}%) — calibrate against human labels before publishing`);
  }

  for (const w of warnings.slice(0, 30)) console.log(`warn  ${w}`);
  if (warnings.length > 30) console.log(`warn  … ${warnings.length - 30} more`);
  for (const b of blocking.slice(0, 40)) console.log(`BLOCK ${b}`);
  if (blocking.length > 40) console.log(`BLOCK … ${blocking.length - 40} more`);
  console.log(blocking.length ? `\n${blocking.length} blocking issue(s): not publishable.` : "\naudit clean.");
  process.exit(blocking.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

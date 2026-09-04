import fs from "fs/promises";
import path from "path";
import { QUEST_CASES } from "../src/suites/quest/questCases.js";
import { grade } from "../src/lib/judge/judge.js";
import { recordQuestRun } from "../src/lib/results.js";
import type { QuestResult } from "../src/lib/types.js";

// Standalone judging pass over results/raw/quest.jsonl — grades every record
// that has content but no judgeAverage yet (cache makes it resumable).
async function main() {
  const rawFile = path.join("results", "raw", "quest.jsonl");
  const lines = (await fs.readFile(rawFile, "utf-8")).trim().split("\n");
  const latest = new Map<string, any>();
  for (const line of lines) {
    const rec = JSON.parse(line);
    latest.set(`${rec.provider}|${rec.questId}`, rec);
  }

  const pending = [...latest.values()].filter((r) => {
    if (!r.content || r.content.length <= 200) return false;
    if (r.judgeAverage === undefined) return true;
    // re-grade records poisoned by judge-error verdicts (counted as 0 before)
    return (r.judgeVerdicts ?? []).some((v: any) =>
      v.rationale?.startsWith("judge error"),
    );
  });
  console.log(`records: ${latest.size}, pending: ${pending.length}`);

  for (const result of pending) {
    const quest = QUEST_CASES.find((q) => q.id === result.questId);
    if (!quest) continue;
    try {
      const { verdicts, average, flagged } = await grade(
        quest.question,
        result.content ?? "",
      );
      if (Number.isNaN(average)) {
        console.error(`${result.provider} ${result.questId}: ALL JUDGES ERRORED — record kept, re-run to retry`);
        continue;
      }
      await recordQuestRun({
        ...result,
        judgeAverage: average,
        judgeVerdicts: verdicts,
        judgeFlagged: flagged,
      } as unknown as QuestResult);
      console.log(
        `${result.provider} ${result.questId}: ${average.toFixed(1)}${flagged ? " (flagged)" : ""}`,
      );
    } catch (e) {
      console.error(
        `${result.provider} ${result.questId}: FAILED ${e instanceof Error ? e.message.slice(0, 100) : e}`,
      );
    }
  }
  console.log("judge pass complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
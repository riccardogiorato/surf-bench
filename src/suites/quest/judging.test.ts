import { describe, it, expect } from "vitest";
import fs from "fs/promises";
import path from "path";
import { QUEST_CASES } from "./questCases.js";
import { grade } from "../../lib/judge/judge.js";
import { recordQuestRun } from "../../lib/results.js";
import type { QuestResult } from "../../lib/types.js";

// The judging pass: reads the quest run records, grades each assembled
// content block with the Kimi K3 + GLM-5 panel (cached by content hash),
// and appends the verdicts to the quest records for the report script.
describe("Judging Panel", () => {
  it("grades every quest run's content", async () => {
    const rawFile = path.join("results", "raw", "quest.jsonl");
    let lines: string[] = [];
    try {
      lines = (await fs.readFile(rawFile, "utf-8")).trim().split("\n");
    } catch {
      expect.unreachable("no quest run records found — run the quest suite first");
    }

    const results = lines
      .map((l) => JSON.parse(l) as QuestResult & { content?: string })
      .filter((r) => r.content && r.content.length > 200);

    expect(results.length).toBeGreaterThan(0);

    for (const result of results) {
      const quest = QUEST_CASES.find((q) => q.id === result.questId);
      if (!quest) continue;

      const { verdicts, average, flagged } = await grade(
        quest.question,
        result.content ?? "",
      );

      await recordQuestRun({
        ...result,
        judgeAverage: average,
        judgeVerdicts: verdicts,
        judgeFlagged: flagged,
      } as unknown as QuestResult);
    }

    expect(lines.length).toBeGreaterThan(0);
  }, 900000);
});
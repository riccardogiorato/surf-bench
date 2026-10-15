import fs from "fs";
import path from "path";
import { judgePanelPreflight } from "../src/lib/judge/judge.js";
import { gradeResultSet } from "../src/lib/searchQuality.js";
import { NON_SCORING, type ErrorClass } from "../src/lib/errorClass.js";
import type { SearchResult } from "../src/lib/types.js";

// Grades the search event's quality axis offline from the recorded result sets
// in results/raw/search.jsonl. Resumable: verdicts are cached by content hash,
// so re-running only grades what is missing and never re-bills a vendor.

const RAW = path.join("results", "raw", "search.jsonl");

interface SearchRec {
  provider: string;
  dim: string;
  query: string;
  error: string | null;
  errorClass: ErrorClass | null;
  results?: SearchResult[];
  judgeScore?: number | null;
  [k: string]: unknown;
}

async function main() {
  if (!fs.existsSync(RAW)) {
    console.error("no results/raw/search.jsonl — run the search suite first");
    process.exit(1);
  }

  const preflight = await judgePanelPreflight();
  if (!preflight.ok) {
    console.error(`judge panel unavailable: ${preflight.reason}`);
    console.error("quality cannot be graded — fix the judge credentials and re-run.");
    process.exit(1);
  }

  const latest = new Map<string, SearchRec>();
  for (const line of fs.readFileSync(RAW, "utf8").trim().split("\n").filter(Boolean)) {
    const rec = JSON.parse(line) as SearchRec;
    latest.set(`${rec.provider}|${rec.dim}|${rec.query}`, rec);
  }

  const pending = [...latest.values()].filter((r) => {
    if (r.dim !== "answerability") return false;
    // A timeout on one judge is not a finished grade. Re-run those; the cache
    // only stores clean panels, so this retries the failed call.
    const verdicts = Array.isArray(r.judgeVerdicts) ? r.judgeVerdicts : [];
    const poisoned = verdicts.some(
      (v) =>
        typeof v === "object" &&
        v !== null &&
        "rationale" in v &&
        String((v as { rationale?: string }).rationale ?? "").startsWith("judge error"),
    );
    if (typeof r.judgeScore === "number" && !poisoned) return false;
    // Never grade a case the provider never got to answer.
    if (r.errorClass && NON_SCORING.has(r.errorClass)) return false;
    if (!r.results || r.results.length === 0) return false;
    return true;
  });
  console.log(`answerability records: ${latest.size}, pending grade: ${pending.length}`);

  const graded: SearchRec[] = [];
  for (const rec of pending) {
    try {
      const { score, verdicts, flagged } = await gradeResultSet(rec.query, rec.results!);
      if (Number.isNaN(score)) {
        console.error(`${rec.provider} / ${rec.query.slice(0, 40)}: all judges errored`);
        continue;
      }
      graded.push({ ...rec, judgeScore: score, judgeVerdicts: verdicts, judgeFlagged: flagged });
      console.log(
        `${rec.provider.padEnd(11)} ${score.toFixed(1)}${flagged ? " (flagged)" : "         "} ${rec.query.slice(0, 50)}`,
      );
    } catch (e) {
      console.error(
        `${rec.provider} / ${rec.query.slice(0, 40)}: FAILED ${e instanceof Error ? e.message.slice(0, 90) : e}`,
      );
    }
  }

  // Records dedupe by (provider, dim, query) keeping the last line.
  if (graded.length) {
    fs.appendFileSync(RAW, graded.map((r) => JSON.stringify(r)).join("\n") + "\n");
  }
  console.log(`search judge pass complete — ${graded.length} graded`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

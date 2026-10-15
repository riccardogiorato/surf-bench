import fs from "fs";
import path from "path";
import { gradeWithRubric, SCRAPE_SUBSTANCE_RUBRIC } from "../src/lib/judge/judge.js";
import { NON_SCORING, type ErrorClass } from "../src/lib/errorClass.js";

// Grades the scrape event's quality axis offline from results/raw/scrape.jsonl,
// so the 50-URL gauntlet never has to be re-run against every vendor just to
// re-score it. Verdicts are cached by content hash, making this resumable.
//
// Fairness rule: every provider is graded on the SAME subset of sites. Quality
// is sampled rather than exhaustive (350 records x 2 judges is a lot of calls),
// and a sample is only comparable if it is the same sample for everyone, so the
// subset is chosen deterministically from the sorted site list — never at
// random, and never per-provider.
const SAMPLE_STRIDE = Number(process.env.SURFBENCH_SCRAPE_STRIDE ?? 3);

interface ScrapeRec {
  provider: string;
  site: string;
  url: string;
  ok: boolean;
  reason: string | null;
  errorClass: ErrorClass | null;
  content?: string;
  title?: string | null;
  judgeScore?: number;
  judgeVerdicts?: unknown;
  [k: string]: unknown;
}

const RAW = path.join("results", "raw", "scrape.jsonl");

async function main() {
  if (!fs.existsSync(RAW)) {
    console.error("no results/raw/scrape.jsonl — run the scrape suite first");
    process.exit(1);
  }
  const latest = new Map<string, ScrapeRec>();
  for (const line of fs.readFileSync(RAW, "utf8").trim().split("\n").filter(Boolean)) {
    const rec = JSON.parse(line) as ScrapeRec;
    latest.set(`${rec.provider}|${rec.site}`, rec);
  }

  const allSites = [...new Set([...latest.values()].map((r) => r.site))].sort();
  const sampled = new Set(allSites.filter((_, i) => i % SAMPLE_STRIDE === 0));
  console.log(
    `sites: ${allSites.length}, sampled: ${sampled.size} (stride ${SAMPLE_STRIDE}) — identical set for every provider`,
  );

  const pending = [...latest.values()].filter((r) => {
    if (!sampled.has(r.site)) return false;
    if (r.judgeScore !== undefined) return false;
    // Quota / rate-limit cases never got a fair answer; grading them would
    // record a quality verdict on the harness's own failure.
    if (r.errorClass && NON_SCORING.has(r.errorClass)) return false;
    return true;
  });
  console.log(`records to grade: ${pending.length}`);

  const graded: ScrapeRec[] = [];
  for (const rec of pending) {
    // A blocked page or hard error is a real 0 for this event: getting past the
    // wall is precisely what the scrape gauntlet measures.
    if (!rec.content || rec.content.trim().length === 0) {
      graded.push({ ...rec, judgeScore: 0, judgeVerdicts: [{ judge: "deterministic", score: 0, rationale: rec.reason ?? "no content returned" }] });
      continue;
    }
    const prompt = [
      `TARGET PAGE: ${rec.site}`,
      `URL: ${rec.url}`,
      "",
      `EXTRACTED CONTENT:`,
      rec.content.slice(0, 12000),
      "",
      'Score this extraction. Respond ONLY with JSON {"score": number, "rationale": string}.',
    ].join("\n");

    try {
      const { verdicts, average, flagged } = await gradeWithRubric(
        SCRAPE_SUBSTANCE_RUBRIC,
        prompt,
      );
      if (Number.isNaN(average)) {
        console.error(`${rec.provider} / ${rec.site}: all judges errored — left ungraded`);
        continue;
      }
      graded.push({ ...rec, judgeScore: average, judgeVerdicts: verdicts, judgeFlagged: flagged });
      console.log(`${rec.provider} / ${rec.site}: ${average.toFixed(1)}${flagged ? " (flagged)" : ""}`);
    } catch (e) {
      console.error(`${rec.provider} / ${rec.site}: FAILED ${e instanceof Error ? e.message.slice(0, 90) : e}`);
    }
  }

  // Records dedupe by (provider, site) keeping the last line, so appending the
  // graded copies is enough for the report to pick them up.
  if (graded.length) {
    fs.appendFileSync(
      RAW,
      graded.map((r) => JSON.stringify(r)).join("\n") + "\n",
    );
  }
  console.log(`scrape judge pass complete — ${graded.length} graded`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

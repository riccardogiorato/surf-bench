import fs from "fs";
import path from "path";
import { gradeWithRubric, SCRAPE_SUBSTANCE_RUBRIC } from "../src/lib/judge/judge.js";
import { SCRAPE_RUBRIC_ID } from "../src/lib/judge/rubrics.js";
import { NON_SCORING, type ErrorClass } from "../src/lib/errorClass.js";
import { ALL_TEST_SITES } from "../src/lib/testSites.js";

// Grades the scrape event's quality axis offline from results/raw/scrape.jsonl,
// so the 50-URL gauntlet never has to be re-run against every vendor just to
// re-score it. Verdicts are cached by content hash, making this resumable.
//
// Every record is graded: the verdict decides both quality and pass/fail, so a
// sample would leave most of the reliability axis without a verdict. Only
// sites in the current gauntlet are graded — records for retired sites linger
// in the jsonl and must not be scored.
const CURRENT_SITES = new Set(ALL_TEST_SITES.map((s) => s.name));
const GRADING_CHARS = 13000;
const RECORD_WORKERS = 4;

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

  const pending = [...latest.values()].filter((r) => {
    if (!CURRENT_SITES.has(r.site)) return false;
    // A single-judge verdict (the other call errored) is re-graded for a full panel.
    const partial = Array.isArray(r.judgeVerdicts) &&
      r.judgeVerdicts.some((v: { rationale?: string }) => String(v?.rationale ?? "").startsWith("judge error"));
    if (r.judgeScore !== undefined && r.judgeRubric === SCRAPE_RUBRIC_ID && !partial) return false;
    // Quota / rate-limit cases never got a fair answer; grading them would
    // record a quality verdict on the harness's own failure.
    if (r.errorClass && NON_SCORING.has(r.errorClass)) return false;
    return true;
  });
  console.log(`records to grade: ${pending.length}`);

  // Records dedupe by (provider, site) keeping the last line, so appending each
  // graded copy as it lands is enough for the report to pick it up, and an
  // interrupted pass keeps everything graded so far.
  let graded = 0;
  const record = (rec: ScrapeRec) => {
    fs.appendFileSync(RAW, JSON.stringify(rec) + "\n");
    graded++;
  };

  const gradeOne = async (rec: ScrapeRec) => {
    // A blocked page or hard error is a real 0 for this event: getting past the
    // wall is precisely what the scrape gauntlet measures.
    if (!rec.content || rec.content.trim().length === 0) {
      record({ ...rec, judgeScore: 0, judgeRubric: SCRAPE_RUBRIC_ID, judgeVerdicts: [{ judge: "deterministic", score: 0, rationale: rec.reason ?? "no content returned" }] });
      return;
    }
    const prompt = [
      `TARGET PAGE: ${rec.site}`,
      `URL: ${rec.url}`,
      "",
      typeof rec.chars === "number" && rec.chars > rec.content.length
        ? `EXTRACTED CONTENT (benchmark excerpt of a ${rec.chars}-char extraction: the opening, then the first prose region; "[… N chars omitted by the benchmark …]" marks our cuts, not the scraper's — but text the scraper buried behind N chars of other material is still diluted):`
        : `EXTRACTED CONTENT:`,
      rec.content.slice(0, GRADING_CHARS),
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
        return;
      }
      record({ ...rec, judgeScore: average, judgeRubric: SCRAPE_RUBRIC_ID, judgeVerdicts: verdicts, judgeFlagged: flagged });
      console.log(`[${graded}/${pending.length}] ${rec.provider} / ${rec.site}: ${average.toFixed(1)}${flagged ? " (flagged)" : ""}`);
    } catch (e) {
      console.error(`${rec.provider} / ${rec.site}: FAILED ${e instanceof Error ? e.message.slice(0, 90) : e}`);
    }
  };

  // The judge module caps calls in flight; this only keeps that cap saturated.
  const queue = [...pending];
  await Promise.all(
    Array.from({ length: RECORD_WORKERS }, async () => {
      for (let rec = queue.shift(); rec; rec = queue.shift()) await gradeOne(rec);
    }),
  );

  console.log(`scrape judge pass complete — ${graded} graded`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

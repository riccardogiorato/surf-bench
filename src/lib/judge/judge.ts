import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { createConcurrencyLimiter } from "../concurrency.js";
import type { Verdict } from "../types.js";
import { QUEST_RUBRIC } from "./rubrics.js";
import "dotenv/config";

export { QUEST_RUBRIC, SEARCH_RESULTS_RUBRIC, SCRAPE_SUBSTANCE_RUBRIC } from "./rubrics.js";

// The judging panel: two models via Together AI REST, scores averaged.
// Together rate limits are dynamic and aggressive, so calls are throttled to
// 4 in flight and retried with exponential backoff.
const PANEL = [
  // Both judges run reasoning_effort "low" — Kimi K3 with the chat-template
  // kwarg still spent its whole budget thinking and returned empty content.
  {
    name: "kimi-k3",
    model: "moonshotai/Kimi-K3",
    extra: { reasoning_effort: "low" },
  },
  {
    name: "glm-5.3",
    model: "zai-org/GLM-5.3",
    extra: { reasoning_effort: "low" },
  },
] as const;

const JUDGE_CACHE_TTL_MS = 7 * 24 * 3600 * 1000; // 1 week
const CALL_TIMEOUT_MS = 90000;
const MAX_ATTEMPTS = 5;
const MAX_OUTPUT_TOKENS = 8192; // headroom: Kimi K3's thinking must fit alongside the JSON reply

const JUDGE_ERROR_PREFIX = "judge error:";

// Raised for billing/auth failures, which no amount of retrying will fix.
export class FatalJudgeError extends Error {}

interface JudgeCacheEntry {
  verdicts: Verdict[];
  timestamp: number;
}

const cacheDir = path.join("cache", "judge");

function hashArtifact(artifact: string, rubric: string): string {
  return crypto.createHash("md5").update(`${rubric}||${artifact}`).digest("hex");
}

async function readVerdictsFromCache(key: string): Promise<Verdict[] | null> {
  try {
    const raw = await fs.readFile(path.join(cacheDir, `${key}.json`), "utf-8");
    const entry: JudgeCacheEntry = JSON.parse(raw);
    if (Date.now() - entry.timestamp < JUDGE_CACHE_TTL_MS) return entry.verdicts;
  } catch {
    // miss
  }
  return null;
}

async function writeVerdictsToCache(key: string, verdicts: Verdict[]) {
  try {
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(
      path.join(cacheDir, `${key}.json`),
      JSON.stringify({ verdicts, timestamp: Date.now() }, null, 2),
    );
  } catch {
    // ignore cache write failures
  }
}

// Throttle: 4 judge calls in flight; per-call timeout; exponential backoff.
const runThrottled = createConcurrencyLimiter(4);

async function askJudge(
  panelName: string,
  model: string,
  rubric: string,
  prompt: string,
): Promise<Verdict> {
  return runThrottled(async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const response = await fetch("https://api.together.xyz/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.TOGETHER_API_KEY ?? ""}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              // The rubric defines the 0-10 scale. It used to only salt the
              // cache key, which left judges scoring on an undefined scale.
              { role: "system", content: rubric },
              { role: "user", content: prompt },
            ],
            max_tokens: MAX_OUTPUT_TOKENS,
            temperature: 0,
            ...PANEL.find((p) => p.model === model)?.extra,
          }),
          signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
        });
        if (!response.ok) {
          const body = await response.text().catch(() => "");
          // Credit/auth failures are not transient. Retrying one five times
          // with exponential backoff burns ~93s per call and then reports a
          // judge error anyway, which is what made a dead Together key look
          // like 71 hung tests instead of one clear billing problem.
          if (response.status === 402 || response.status === 401 || response.status === 403) {
            throw new FatalJudgeError(
              `Together HTTP ${response.status}: ${body.slice(0, 160)}`,
            );
          }
          throw new Error(`Together HTTP ${response.status}: ${body.slice(0, 120)}`);
        }
        const data = await response.json();
        const text: string = data.choices?.[0]?.message?.content ?? "";
        const parsed = JSON.parse(
          text.replace(/^```json\s*/m, "").replace(/```\s*$/m, "").trim(),
        );
        return {
          score: Math.max(0, Math.min(10, Number(parsed.score))),
          rationale: String(parsed.rationale ?? "").slice(0, 300),
          judge: panelName,
        };
      } catch (e) {
        if (e instanceof FatalJudgeError) throw e;
        lastError = e;
        await new Promise((r) => setTimeout(r, 3000 * 2 ** attempt));
      }
    }
    throw lastError instanceof Error ? lastError : new Error("judge failed");
  });
}

// Grades one prompt against one rubric with the full panel. Verdicts are
// cached by hash(rubric + prompt), so a rubric edit re-grades from scratch.
export async function gradeWithRubric(
  rubric: string,
  prompt: string,
): Promise<{ verdicts: Verdict[]; average: number; flagged: boolean }> {
  const key = hashArtifact(prompt, rubric);
  const cached = await readVerdictsFromCache(key);
  if (cached) {
    const average = cached.reduce((s, v) => s + v.score, 0) / cached.length;
    return { verdicts: cached, average, flagged: false };
  }

  const verdicts = await Promise.all(
    PANEL.map(async (p) => {
      try {
        return await askJudge(p.name, p.model, rubric, prompt);
      } catch (e) {
        return {
          score: 0,
          rationale: `judge error: ${e instanceof Error ? e.message.slice(0, 150) : "unknown"}`,
          judge: p.name,
        };
      }
    }),
  );

  // A failed judge call is not a 0-quality vote — average only clean verdicts.
  // If every judge errored, average is NaN and the record must be re-graded.
  const clean = verdicts.filter((v) => !v.rationale.startsWith(JUDGE_ERROR_PREFIX));
  const average =
    clean.length > 0
      ? clean.reduce((s, v) => s + v.score, 0) / clean.length
      : Number.NaN;
  const flagged =
    clean.length === 2 && Math.abs(clean[0].score - clean[1].score) > 2;

  // Cache only clean verdicts — don't poison the cache with judge-error scores
  const errored = verdicts.length !== clean.length;
  if (!errored) {
    await writeVerdictsToCache(key, verdicts);
  }
  return { verdicts, average, flagged };
}

// Cheap liveness check for the panel. Grading passes call this first so a dead
// or unfunded Together key reports one clear line instead of grinding through
// hundreds of cases that can only fail.
export async function judgePanelPreflight(): Promise<{ ok: boolean; reason?: string }> {
  if (!process.env.TOGETHER_API_KEY) {
    return { ok: false, reason: "TOGETHER_API_KEY is not set" };
  }
  try {
    await askJudge(
      PANEL[0].name,
      PANEL[0].model,
      "You are a judge. Reply with JSON only.",
      'Reply ONLY with JSON {"score": 5, "rationale": "preflight"}.',
    );
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message.slice(0, 200) : "unknown judge failure",
    };
  }
}

// Quest grading: "does this fetched content answer the question".
export async function grade(
  question: string,
  artifact: string,
): Promise<{ verdicts: Verdict[]; average: number; flagged: boolean }> {
  return gradeWithRubric(
    QUEST_RUBRIC,
    `QUESTION: ${question}\n\nCONTENT:\n${artifact.slice(0, 12000)}\n\nScore this content for answering the question. Respond ONLY with JSON {"score": number, "rationale": string}.`,
  );
}
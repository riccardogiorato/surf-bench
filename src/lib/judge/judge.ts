import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { createConcurrencyLimiter } from "../concurrency.js";
import type { Verdict } from "../types.js";
import "dotenv/config";

// The judging panel: two models via Together AI REST, scores averaged.
// Together rate limits are dynamic and aggressive, so calls are throttled to
// 2 in flight and retried with exponential backoff.
const PANEL = [
  // Kimi K3 is a thinking model — thinking is disabled via chat template kwarg
  // for fast, cheap verdicts; GLM-5.3 takes reasoning_effort.
  {
    name: "kimi-k3",
    model: "moonshotai/Kimi-K3",
    extra: { chat_template_kwargs: { enable_thinking: false } },
  },
  {
    name: "glm-5.3",
    model: "zai-org/GLM-5.3",
    extra: { reasoning_effort: "low" },
  },
] as const;

const JUDGE_CACHE_TTL_MS = 7 * 24 * 3600 * 1000; // 1 week
const CALL_TIMEOUT_MS = 60000;
const MAX_ATTEMPTS = 5;
const MAX_OUTPUT_TOKENS = 2048; // headroom for reasoning models

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

const QUEST_RUBRIC =
  "You are a strict but fair judge at a web-benchmark contest. Given a QUESTION and CONTENT fetched from the web, score 0-10 whether the content contains a usable answer to the question. 10 = the answer is present, specific and quotable. 7-9 = answer is present but partial. 4-6 = only partially relevant. 1-3 = mostly irrelevant. 0 = nothing usable (blocked page, login wall, boilerplate).";

// Throttle: 2 judge calls in flight; per-call timeout; exponential backoff.
const runThrottled = createConcurrencyLimiter(4);

async function askJudge(
  model: string,
  question: string,
  artifact: string,
): Promise<Verdict> {
  return runThrottled(async () => {
    const prompt = `QUESTION: ${question}\n\nCONTENT:\n${artifact.slice(0, 12000)}\n\nScore this content 0-10 for answering the question. Respond ONLY with JSON {"score": number, "rationale": string}.`;
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
            messages: [{ role: "user", content: prompt }],
            max_tokens: MAX_OUTPUT_TOKENS,
            temperature: 0,
            ...PANEL.find((p) => p.model === model)?.extra,
          }),
          signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
        });
        if (!response.ok) {
          throw new Error(`Together HTTP ${response.status}`);
        }
        const data = await response.json();
        const text: string = data.choices?.[0]?.message?.content ?? "";
        const parsed = JSON.parse(
          text.replace(/^```json\s*/m, "").replace(/```\s*$/m, "").trim(),
        );
        return {
          score: Math.max(0, Math.min(10, Number(parsed.score))),
          rationale: String(parsed.rationale ?? "").slice(0, 300),
          judge: model,
        };
      } catch (e) {
        lastError = e;
        await new Promise((r) => setTimeout(r, 3000 * 2 ** attempt));
      }
    }
    throw lastError instanceof Error ? lastError : new Error("judge failed");
  });
}

export async function grade(
  question: string,
  artifact: string,
): Promise<{ verdicts: Verdict[]; average: number; flagged: boolean }> {
  const key = hashArtifact(artifact, QUEST_RUBRIC);
  const cached = await readVerdictsFromCache(key);
  if (cached) {
    const average = cached.reduce((s, v) => s + v.score, 0) / cached.length;
    return { verdicts: cached, average, flagged: false };
  }

  const verdicts = await Promise.all(
    PANEL.map(async (p) => {
      try {
        return await askJudge(p.model, question, artifact);
      } catch (e) {
        return {
          score: 0,
          rationale: `judge error: ${e instanceof Error ? e.message.slice(0, 150) : "unknown"}`,
          judge: p.name,
        };
      }
    }),
  );

  const average = verdicts.reduce((s, v) => s + v.score, 0) / verdicts.length;
  const flagged =
    verdicts.length === 2 && Math.abs(verdicts[0].score - verdicts[1].score) > 2;

  // Cache only clean verdicts — don't poison the cache with judge-error scores
  const errored = verdicts.some((v) => v.rationale.startsWith("judge error"));
  if (!errored) {
    await writeVerdictsToCache(key, verdicts);
  }
  return { verdicts, average, flagged };
}
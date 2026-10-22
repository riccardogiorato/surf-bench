import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { createConcurrencyLimiter } from "../concurrency.js";
import "dotenv/config";

// The judging panel: two models via Together AI REST. Together rate limits are
// dynamic and aggressive, so calls are throttled to 4 in flight and retried
// with exponential backoff.
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

export const JUDGE_MODELS = PANEL.map((p) => p.model);

const JUDGE_CACHE_TTL_MS = 7 * 24 * 3600 * 1000; // 1 week
const CALL_TIMEOUT_MS = 90000;
const MAX_ATTEMPTS = 5;
const MAX_OUTPUT_TOKENS = 8192; // headroom: Kimi K3's thinking must fit alongside the JSON reply

// Raised for billing/auth failures, which no amount of retrying will fix.
export class FatalJudgeError extends Error {}

export interface ConstraintVerdict {
  judge: string;
  met: boolean[]; // index-aligned with the constraints sent
  evidence: string[];
  rationale: string;
  error?: string;
}

const cacheDir = path.join("cache", "judge");

function cacheKey(prompt: string, rubric: string): string {
  return crypto.createHash("md5").update(`constraints||${rubric}||${prompt}`).digest("hex");
}

async function readCache(key: string): Promise<ConstraintVerdict[] | null> {
  try {
    const entry = JSON.parse(await fs.readFile(path.join(cacheDir, `${key}.json`), "utf-8"));
    if (Date.now() - entry.timestamp < JUDGE_CACHE_TTL_MS) return entry.verdicts;
  } catch {
    // miss
  }
  return null;
}

async function writeCache(key: string, verdicts: ConstraintVerdict[]) {
  try {
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(path.join(cacheDir, `${key}.json`), JSON.stringify({ verdicts, timestamp: Date.now() }, null, 2));
  } catch {
    // ignore cache write failures
  }
}

const runThrottled = createConcurrencyLimiter(4);

// One Together chat call that must return a JSON object, with throttling,
// timeout, backoff and fatal-billing handling. Shared by the reader and the panel.
export async function togetherJson(
  model: string,
  system: string,
  prompt: string,
  extra: Record<string, unknown> = {},
  limiter: <T>(fn: () => Promise<T>) => Promise<T> = runThrottled,
): Promise<any> {
  return limiter(async () => {
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
              { role: "system", content: system },
              { role: "user", content: prompt },
            ],
            max_tokens: MAX_OUTPUT_TOKENS,
            temperature: 0,
            ...extra,
          }),
          signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
        });
        if (!response.ok) {
          const body = await response.text().catch(() => "");
          // Credit/auth failures are not transient: retrying burns ~93s per
          // call and still fails, so a dead key would look like a hung run.
          if (response.status === 402 || response.status === 401 || response.status === 403) {
            throw new FatalJudgeError(`Together HTTP ${response.status}: ${body.slice(0, 160)}`);
          }
          throw new Error(`Together HTTP ${response.status}: ${body.slice(0, 120)}`);
        }
        const data = await response.json();
        const text: string = data.choices?.[0]?.message?.content ?? "";
        const body = text.replace(/^```json\s*/m, "").replace(/```\s*$/m, "").trim();
        // Some models wrap the object in prose; take the outermost braces.
        const start = body.indexOf("{");
        const end = body.lastIndexOf("}");
        return JSON.parse(start >= 0 && end > start ? body.slice(start, end + 1) : body);
      } catch (e) {
        if (e instanceof FatalJudgeError) throw e;
        lastError = e;
        await new Promise((r) => setTimeout(r, 3000 * 2 ** attempt));
      }
    }
    throw lastError instanceof Error ? lastError : new Error("judge failed");
  });
}

// live-judge grading: every panel member answers each constraint yes/no.
// Cached by hash(rubric + prompt); a verdict set with any judge error is never cached.
export async function judgeConstraints(rubric: string, prompt: string, count: number): Promise<ConstraintVerdict[]> {
  const key = cacheKey(prompt, rubric);
  const cached = await readCache(key);
  if (cached) return cached;

  const verdicts = await Promise.all(
    PANEL.map(async (p): Promise<ConstraintVerdict> => {
      try {
        const parsed = await togetherJson(p.model, rubric, prompt, p.extra);
        const list: any[] = Array.isArray(parsed.constraints) ? parsed.constraints : [];
        const byId = new Map(list.map((c) => [Number(c.id), c]));
        return {
          judge: p.name,
          met: Array.from({ length: count }, (_, i) => byId.get(i + 1)?.met === true),
          evidence: Array.from({ length: count }, (_, i) => String(byId.get(i + 1)?.evidence ?? "").slice(0, 160)),
          rationale: String(parsed.rationale ?? "").slice(0, 300),
          ...(list.length === 0 ? { error: "no constraints in reply" } : {}),
        };
      } catch (e) {
        return { judge: p.name, met: [], evidence: [], rationale: "", error: e instanceof Error ? e.message.slice(0, 150) : "unknown" };
      }
    }),
  );
  if (verdicts.every((v) => !v.error)) await writeCache(key, verdicts);
  return verdicts;
}

// Cheap liveness check: a dead or unfunded Together key reports one clear line
// instead of grinding through hundreds of records that can only fail.
export async function judgePanelPreflight(): Promise<{ ok: boolean; reason?: string }> {
  if (!process.env.TOGETHER_API_KEY) return { ok: false, reason: "TOGETHER_API_KEY is not set" };
  try {
    await togetherJson(PANEL[0].model, "Reply with JSON only.", 'Reply ONLY with JSON {"ok": true}.', PANEL[0].extra);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message.slice(0, 200) : "unknown judge failure" };
  }
}

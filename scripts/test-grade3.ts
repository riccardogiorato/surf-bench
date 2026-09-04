import "dotenv/config";
async function main() {
  const fs = await import("fs");
  const lines = fs.readFileSync("results/raw/quest.jsonl", "utf8").trim().split("\n").map((l: string) => JSON.parse(l));
  const latest: any = {};
  for (const r of lines) latest[r.provider + "|" + r.questId] = r;
  const artifact = latest["firecrawl|q1"].content;
  const prompt = `QUESTION: What is the latest stable version of Node.js?\n\nCONTENT:\n${artifact.slice(0, 12000)}\n\nScore this content 0-10 for answering the question. Respond ONLY with JSON {"score": number, "rationale": string}.`;
  console.log("prompt chars:", prompt.length);
  const response = await fetch("https://api.together.xyz/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.TOGETHER_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "moonshotai/Kimi-K3", messages: [{ role: "user", content: prompt }], max_tokens: 8192, temperature: 0, reasoning_effort: "low" }),
    signal: AbortSignal.timeout(90000),
  });
  const data = await response.json();
  const m = data.choices?.[0]?.message;
  console.log("status:", response.status, "| finish:", data.choices?.[0]?.finish_reason);
  console.log("content len:", (m?.content ?? "").length, "| reasoning len:", (m?.reasoning_content ?? "").length);
  console.log("content preview:", (m?.content ?? "").slice(0, 120));
  if ((m?.content ?? "").length === 0) console.log("FULL RESPONSE:", JSON.stringify(data).slice(0, 600));
}
main().catch((e) => { console.error(e); process.exit(1); });

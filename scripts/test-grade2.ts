import "dotenv/config";

async function main() {
  const prompt = "QUESTION: What is the latest stable version of Node.js?\n\nCONTENT:\nshort\n\nScore this content 0-10. Respond ONLY with JSON {\"score\": number, \"rationale\": string}.";
  for (const [name, model] of [["kimi", "moonshotai/Kimi-K3"], ["glm", "zai-org/GLM-5.3"]] as const) {
    const response = await fetch("https://api.together.xyz/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.TOGETHER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], max_tokens: 8192, temperature: 0, reasoning_effort: "low" }),
      signal: AbortSignal.timeout(90000),
    });
    const data = await response.json();
    const m = data.choices?.[0]?.message;
    console.log(name, "| status", response.status, "| content len:", (m?.content ?? "").length, "| reasoning len:", (m?.reasoning_content ?? "").length, "| preview:", (m?.content ?? "").slice(0, 80));
  }
}
main().catch((e) => { console.error(e); process.exit(1); });

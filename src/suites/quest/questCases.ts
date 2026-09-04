import type { QuestCase } from "../../lib/types.js";

// Quest questions: find it, read it, bring back the answer.
// expectTokens: lowercase tokens the assembled content should contain to be
// considered on-target (used for the deterministic gate; the judge panel adds
// the quality score on top).
export const QUEST_CASES: QuestCase[] = [
  {
    id: "q1",
    question: "What is the latest stable version of Node.js?",
    expectTokens: ["node"],
  },
  {
    id: "q2",
    question: "Who is the current CEO of OpenAI?",
    expectTokens: ["openai", "altman"],
  },
  {
    id: "q3",
    question: "What are the ticket prices for Universal Studios Hollywood?",
    expectTokens: ["universal", "ticket"],
  },
  {
    id: "q4",
    question: "How many employees does Shopify have?",
    expectTokens: ["shopify"],
  },
  {
    id: "q5",
    question: "What is the S&P 500 closing level from the last trading day?",
    expectTokens: ["s&p", "index"],
  },
  {
    id: "q6",
    question: "What is the weight limit for carry-on luggage on Delta?",
    expectTokens: ["delta", "carry"],
  },
  {
    id: "q7",
    question: "What is the return policy for Walmart?",
    expectTokens: ["walmart", "return"],
  },
  {
    id: "q8",
    question: "What is the price of a PS5 on the PlayStation direct store?",
    expectTokens: ["playstation", "ps5"],
  },
  {
    id: "q9",
    question: "What conferences does GDC have talks from in 2025?",
    expectTokens: ["gdc", "2025"],
  },
  {
    id: "q10",
    question: "What is the fastest way to travel from Tokyo to Kyoto?",
    expectTokens: ["shinkansen", "kyoto"],
  },
  {
    id: "q11",
    question: "What is the minimum age for a Nintendo Switch account?",
    expectTokens: ["nintendo"],
  },
  {
    id: "q12",
    expectTokens: ["github", "repo"],
    question: "What is the most starred TypeScript repository on GitHub?",
  },
  {
    id: "q13",
    question: "How much does Notion cost per month for a personal plan?",
    expectTokens: ["notion", "pricing"],
  },
  {
    id: "q14",
    question: "What is the weather forecast for San Francisco tomorrow?",
    expectTokens: ["san francisco", "forecast"],
  },
  {
    id: "q15",
    question: "What are the opening hours of the British Museum?",
    expectTokens: ["british museum", "open"],
  },
];
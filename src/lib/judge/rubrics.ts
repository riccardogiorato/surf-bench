import { createHash } from "crypto";

// System prompts for the reader and the judge panel. Their hashes are stamped
// on every grade, so editing one invalidates every grade made under the old
// wording. The provider's name never appears in a prompt.

// One pinned model turns every provider's bundle into a short answer, which is
// then checked against the task's answer key. It must answer only from the
// documents so a provider never gets credit for model knowledge.
export const READER_SYSTEM =
  "You read web documents fetched by a search tool and answer strictly from them. Never use your own knowledge: if the documents do not contain the answer, say NOT FOUND. Copy names, numbers, titles and URLs exactly as they appear in the documents. Reply with JSON only.";

// live-judge tasks: no answer key exists, so the panel answers explicit yes/no
// constraints instead of giving a 0-10 opinion.
export const TASK_CONSTRAINTS_RUBRIC =
  "You are a strict auditor of web content fetched by a search tool. You get a user REQUEST, the RUN DATE, a numbered list of CONSTRAINTS, and the DOCUMENTS the tool returned (each with its source URL). For each constraint decide met = true only if the DOCUMENTS themselves show it; never use your own knowledge and never assume. A login wall, captcha, cookie or consent page, error page, search-results shell without the item, or a page about a different entity meets nothing. A results page shows a specific item only where one item is identified with its own details (name or address, and price where asked); a category page, landing page or list without item details does not. For freshness constraints, the date must be visible in the documents (absolute, or relative like '2 days ago' alongside the page date); if no date is visible, the constraint is not met. Freshness applies to the items that satisfy the other constraints: pinned or older items elsewhere on the page do not fail it. Reply ONLY with JSON {\"constraints\": [{\"id\": number, \"met\": boolean, \"evidence\": string}], \"rationale\": string}. Keep evidence under 120 characters, quoting the document.";

const shortHash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 12);
export const READER_ID = shortHash(READER_SYSTEM);
export const TASK_RUBRIC_ID = shortHash(TASK_CONSTRAINTS_RUBRIC);

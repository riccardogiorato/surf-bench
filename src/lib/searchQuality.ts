import { gradeWithRubric, SEARCH_RESULTS_RUBRIC } from "./judge/judge.js";
import type { SearchResult, Verdict } from "./types.js";

// Grades a ranked result set the way an agent consumes it: title, url and a
// capped snippet, before any page is fetched.
//
// Two anti-gaming properties matter here:
//   1. Snippets are truncated to SNIPPET_BUDGET per result, so a provider that
//      returns whole articles in its snippet field cannot buy a better score
//      with volume. The question being asked is "did you find and rank the
//      right pages", not "how much text did you ship".
//   2. The provider's name is never in the prompt, so no judge can prefer a
//      brand it recognises.
const SNIPPET_BUDGET = 400;
const MAX_RESULTS_GRADED = 5;

export interface SearchQualityResult {
  score: number; // 0-10, NaN when every judge errored
  verdicts: Verdict[];
  flagged: boolean;
}

export function buildResultSetPrompt(
  question: string,
  results: SearchResult[],
): string {
  const listed = results.slice(0, MAX_RESULTS_GRADED).map((r, i) => {
    const snippet = (r.snippet ?? "").replace(/\s+/g, " ").trim();
    const capped = snippet.length > SNIPPET_BUDGET
      ? `${snippet.slice(0, SNIPPET_BUDGET)}…`
      : snippet;
    return [
      `[${i + 1}] title: ${r.title || "(none)"}`,
      `    url: ${r.url}`,
      `    snippet: ${capped || "(none)"}`,
    ].join("\n");
  });

  return [
    `QUESTION: ${question}`,
    "",
    `SEARCH RESULTS (ranked, ${listed.length} shown):`,
    listed.join("\n"),
    "",
    'Score this result set for answering the question. Respond ONLY with JSON {"score": number, "rationale": string}.',
  ].join("\n");
}

export async function gradeResultSet(
  question: string,
  results: SearchResult[],
): Promise<SearchQualityResult> {
  if (results.length === 0) {
    return {
      score: 0,
      verdicts: [],
      flagged: false,
    };
  }
  const { verdicts, average, flagged } = await gradeWithRubric(
    SEARCH_RESULTS_RUBRIC,
    buildResultSetPrompt(question, results),
  );
  return { score: average, verdicts, flagged };
}

// Deterministic structural diagnostics. These are recorded alongside the judge
// score as tamper-evident facts: they need no model and cannot drift between
// runs, which makes them the cross-check on the panel's verdicts.
export interface SearchStructure {
  numResults: number;
  uniqueDomains: number;
  duplicateUrlRate: number;
  snippetCoverage: number; // share of results that shipped any snippet
}

export function structuralMetrics(results: SearchResult[]): SearchStructure {
  const urls = results.map((r) => r.url);
  const unique = new Set(urls);
  const domains = new Set(
    urls
      .map((u) => {
        try {
          return new URL(u).hostname.replace(/^www\./, "");
        } catch {
          return "";
        }
      })
      .filter(Boolean),
  );
  return {
    numResults: results.length,
    uniqueDomains: domains.size,
    duplicateUrlRate: urls.length ? 1 - unique.size / urls.length : 0,
    snippetCoverage: urls.length
      ? results.filter((r) => (r.snippet ?? "").trim().length > 0).length /
        urls.length
      : 0,
  };
}

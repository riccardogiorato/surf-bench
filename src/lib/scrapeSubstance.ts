// Deterministic shell detection: "did the scraper return a page, or furniture?"
//
// The old gate passed any extraction over 120 characters that mentioned the
// site's own name, so a cookie banner plus a nav tree from the right domain
// scored identically to the article the agent wanted.
//
// SCOPE WARNING, learned from calibrating against captured runs: this score
// measures prose VOLUME, not answer presence. A concise extraction that opens
// with the exact answer ("Shopify had 7,620 employees as of March 2026")
// scored 2.59, while a long Yahoo error page scored 9.13. Structured pages
// (version tables, spec sheets) legitimately have no paragraphs at all.
//
// So this is deliberately used as a LOW FLOOR for obvious shells, never as the
// quality score. Answer quality is the judge panel's job, because only a
// model can tell "the page body" from "a lot of text".
export interface SubstanceMetrics {
  chars: number;
  proseRatio: number; // share of characters living in real paragraphs
  structuredRatio: number; // share in data-ish rows (tables, specs, versions)
  longestParagraph: number;
  shortLineRatio: number; // nav menus and link lists are many short lines
  linkDensity: number; // markdown links per 1000 chars
  boilerplateHits: number;
  substanceScore: number; // 0-10 shell detector, NOT a quality grade
}

// A "paragraph" worth counting: enough prose to carry an answer.
const PARAGRAPH_MIN = 200;
const SHORT_LINE_MAX = 40;

const BOILERPLATE_PHRASES = [
  /accept all cookies/i,
  /cookie (policy|preferences|settings)/i,
  /subscribe to (our )?newsletter/i,
  /create (a free )?account/i,
  /sign up for free/i,
  /all rights reserved/i,
  /terms of (service|use)/i,
  /privacy policy/i,
  /manage preferences/i,
  /related articles/i,
  /trending now/i,
  /share this (article|page)/i,
];

export function substanceMetrics(content: string): SubstanceMetrics {
  const text = content.trim();
  const chars = text.length;
  if (chars === 0) {
    return {
      chars: 0,
      proseRatio: 0,
      structuredRatio: 0,
      longestParagraph: 0,
      shortLineRatio: 1,
      linkDensity: 0,
      boilerplateHits: 0,
      substanceScore: 0,
    };
  }

  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const paragraphs = lines.filter((l) => l.length >= PARAGRAPH_MIN);
  const proseChars = paragraphs.reduce((sum, p) => sum + p.length, 0);
  const shortLines = lines.filter((l) => l.length <= SHORT_LINE_MAX);

  // Structured content counts too: a version table or a spec sheet is exactly
  // what an agent wanted from pages that have no paragraphs by design.
  const structuredChars = lines
    .filter(
      (l) =>
        l.length > SHORT_LINE_MAX &&
        l.length < PARAGRAPH_MIN &&
        /\d/.test(l) &&
        /[|:\t]|\s{2,}|\d+\.\d+/.test(l),
    )
    .reduce((sum, l) => sum + l.length, 0);

  const linkCount = (text.match(/\[[^\]]*\]\([^)]*\)/g) ?? []).length;
  const boilerplateHits = BOILERPLATE_PHRASES.filter((p) => p.test(text)).length;

  const proseRatio = proseChars / chars;
  const structuredRatio = structuredChars / chars;
  const longestParagraph = paragraphs.reduce((m, p) => Math.max(m, p.length), 0);
  const shortLineRatio = lines.length ? shortLines.length / lines.length : 1;
  const linkDensity = (linkCount / chars) * 1000;

  // Composite, deliberately simple so it stays auditable. Structured rows are
  // credited alongside prose so spec/version pages are not treated as shells.
  const bodyRatio = proseRatio + structuredRatio;
  let score = 0;
  score += Math.min(4, bodyRatio * 8); // up to 4 for real page body
  score += Math.min(2, longestParagraph / 500); // up to 2 for depth
  score += chars >= 1000 ? 2 : chars / 500; // up to 2 for volume
  score += 1; // base for returning anything parseable
  score -= Math.min(2.5, Math.max(0, shortLineRatio - 0.5) * 4); // nav penalty
  score -= Math.min(1.5, linkDensity / 8); // link-list penalty
  score -= Math.min(1.5, boilerplateHits * 0.4); // furniture penalty

  return {
    chars,
    proseRatio: Number(proseRatio.toFixed(3)),
    structuredRatio: Number(structuredRatio.toFixed(3)),
    longestParagraph,
    shortLineRatio: Number(shortLineRatio.toFixed(3)),
    linkDensity: Number(linkDensity.toFixed(2)),
    boilerplateHits,
    substanceScore: Number(Math.max(0, Math.min(10, score)).toFixed(2)),
  };
}

// Floor for "this is a shell, not a page". Set low on purpose: calibration
// showed useful concise extractions sitting near 2.6, so anything stricter
// would fail good scrapes. Quality above this floor is the judge's call.
export const SUBSTANCE_PASS = 2.0;

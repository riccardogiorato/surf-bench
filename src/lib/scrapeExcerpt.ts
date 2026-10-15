// Bounded excerpt of a scrape for storage and grading.
//
// A plain head slice graded nav-first extractions on their navigation alone:
// a 620k-char Wikipedia extraction scored 2 because the article began after the
// first 14k chars of menus. The excerpt keeps the opening (so dilution stays
// visible) plus a window from the first real prose block, and marks every cut
// with the number of chars skipped so the judge can still penalise burial.
// The window is chosen by deterministic text features, never by provider.

const HEAD_CHARS = 3000;
const BODY_CHARS = 9000;
export const EXCERPT_LIMIT = HEAD_CHARS + BODY_CHARS;

const PROSE_MIN_CHARS = 150;
const PROSE_MIN_PLAIN_RATIO = 0.5;
const LEAD_IN_CHARS = 300;

// Text left once markdown images, link targets and bare URLs are removed:
// a nav line is mostly link syntax, a paragraph is mostly words.
function plainText(line: string): string {
  return line
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[#*_>|`]/g, "")
    .trim();
}

// A lone prose line (a "redirects here" hatnote, a promo blurb) is not the
// body; the body is where prose lines cluster.
const CLUSTER_SPAN = 3000;
const CLUSTER_MIN_LINES = 2;
const CLUSTER_MIN_CHARS = 500;

function firstProseOffset(content: string): number {
  const hits: Array<{ offset: number; plain: number }> = [];
  let offset = 0;
  for (const line of content.split("\n")) {
    const plain = plainText(line);
    if (
      plain.length >= PROSE_MIN_CHARS &&
      plain.length / Math.max(1, line.length) >= PROSE_MIN_PLAIN_RATIO
    ) {
      hits.push({ offset, plain: plain.length });
    }
    offset += line.length + 1;
  }
  for (let i = 0; i < hits.length; i++) {
    const cluster = hits.filter(
      (h) => h.offset >= hits[i].offset && h.offset < hits[i].offset + CLUSTER_SPAN,
    );
    const chars = cluster.reduce((s, h) => s + h.plain, 0);
    if (cluster.length >= CLUSTER_MIN_LINES && chars >= CLUSTER_MIN_CHARS) return hits[i].offset;
  }
  return hits.length ? hits[0].offset : -1;
}

const omitted = (n: number) => `\n\n[… ${n} chars omitted by the benchmark …]\n\n`;

export function scrapeExcerpt(content: string): string {
  if (content.length <= EXCERPT_LIMIT) return content;
  const prose = firstProseOffset(content);
  if (prose < 0 || prose + 2000 <= EXCERPT_LIMIT) {
    return content.slice(0, EXCERPT_LIMIT) + omitted(content.length - EXCERPT_LIMIT);
  }
  const start = Math.max(HEAD_CHARS, prose - LEAD_IN_CHARS);
  const end = start + BODY_CHARS;
  return (
    content.slice(0, HEAD_CHARS) +
    omitted(start - HEAD_CHARS) +
    content.slice(start, end) +
    (end < content.length ? omitted(content.length - end) : "")
  );
}

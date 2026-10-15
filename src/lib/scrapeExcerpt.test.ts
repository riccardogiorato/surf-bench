import { describe, it, expect } from "vitest";
import { scrapeExcerpt, EXCERPT_LIMIT } from "./scrapeExcerpt.js";

const nav = (n: number) =>
  Array.from({ length: n }, (_, i) => `* [Section ${i}](https://example.com/s/${i})`).join("\n");
const article =
  "The transformer architecture replaces recurrence with attention, letting every token attend to every other token in a single step, which is why it parallelises so well on modern accelerators.";

describe("scrapeExcerpt", () => {
  it("returns short content untouched", () => {
    expect(scrapeExcerpt(article)).toBe(article);
  });

  it("reaches prose buried behind a long navigation block and marks the cut", () => {
    const content = nav(2000) + "\n" + article + "\n" + nav(200);
    expect(content.indexOf(article)).toBeGreaterThan(EXCERPT_LIMIT);
    const excerpt = scrapeExcerpt(content);
    expect(excerpt).toContain(article);
    expect(excerpt).toMatch(/chars omitted by the benchmark/);
    expect(excerpt.length).toBeLessThan(EXCERPT_LIMIT + 200);
  });

  it("skips a lone hatnote to reach the clustered article body", () => {
    const hatnote =
      '"AI" redirects here. For other uses, see AI (disambiguation) and the list of artificial intelligence topics, including the history and philosophy of the field.';
    const content = nav(300) + "\n" + hatnote + "\n" + nav(800) + "\n" + article + "\n" + article + "\n" + article + "\n" + nav(500);
    const excerpt = scrapeExcerpt(content);
    expect(content.indexOf(article)).toBeGreaterThan(EXCERPT_LIMIT);
    expect(excerpt).toContain(article);
  });

  it("keeps a plain head slice when prose starts early", () => {
    const content = article + "\n" + nav(2000);
    const excerpt = scrapeExcerpt(content);
    expect(excerpt.startsWith(content.slice(0, EXCERPT_LIMIT))).toBe(true);
  });

  it("does not mistake a long line of links for prose", () => {
    const linkLine = Array.from({ length: 30 }, (_, i) => `[Link ${i}](https://example.com/${i})`).join(" ");
    const content = nav(2000) + "\n" + linkLine + "\n" + nav(500);
    const excerpt = scrapeExcerpt(content);
    expect(excerpt.startsWith(content.slice(0, EXCERPT_LIMIT))).toBe(true);
  });
});

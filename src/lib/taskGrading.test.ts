import { describe, expect, it } from "vitest";
import { formatBundle, gradeFacts, gradeLatest, gradeNumeric, gradeOverlap, parseNumber, titlesMatch } from "./taskGrading.js";
import { TASKS, hostMatches, trackOf } from "./tasks.js";

const ref = (items: string[], values?: number[]) => ({ taskId: "t", capturedAt: "", items, values });

describe("titlesMatch", () => {
  it("matches trimmed or re-punctuated headlines", () => {
    expect(titlesMatch("Fed Holds Rates Steady, Signals Cuts Later", "Fed holds rates steady — signals cuts later this year")).toBe(true);
    expect(titlesMatch("Show HN: A tiny Lisp in 200 lines", "A tiny Lisp in 200 lines")).toBe(true);
  });
  it("matches a feed headline reworded around the same core phrase", () => {
    expect(
      titlesMatch(
        "Trump-Gesandter Witkoff in Russland Putin setzt vor allem auf eines – Krieg",
        "Russland und Ukraine: Wladimir Putin setzt vor allem auf eines – seinen Kriegskurs",
      ),
    ).toBe(true);
  });
  it("does not match different stories that share a topic word", () => {
    expect(titlesMatch("Nvidia earnings beat estimates", "Nvidia unveils new chip at GTC")).toBe(false);
  });
});

describe("gradeOverlap", () => {
  it("scores matched items out of 5, so returning fewer items costs credit", () => {
    const r = ref(["Alpha story here today", "Beta launches product", "Gamma wins the cup"]);
    expect(gradeOverlap(["Alpha story here today", "Gamma wins the cup"], r).score).toBe(0.4);
  });
  it("matches an item by its feed summary line when the page shows no headline", () => {
    const r = { ...ref(["Senate Passes Budget"]), alts: [["The vote sends the spending bill to the president after a weeklong standoff."]] };
    expect(gradeOverlap(["The vote sends the spending bill to the president after a weeklong standoff."], r).score).toBe(0.2);
  });
  it("ignores a trailing author byline", () => {
    const r = ref(["Wohin reisen im Jahr 2027? Die besten Ziele"]);
    expect(gradeOverlap(["Wohin reisen im Jahr 2027? Die besten Ziele Von Antje Blinda"], r).score).toBe(0.2);
  });
});

describe("gradeLatest", () => {
  it("gives full credit for the newest version and half for a stale one", () => {
    const r = ref(["v6.0.3", "v6.0.2", "v5.9.3"]);
    expect(gradeLatest("TypeScript 6.0.3", r).score).toBe(1);
    expect(gradeLatest("The latest is 6.0.2", r).score).toBe(0.5);
    expect(gradeLatest("NOT FOUND", r).score).toBe(0);
  });
  it("gives half credit for the right Node LTS line", () => {
    expect(gradeLatest("Node.js 24", ref(["v24.11.1", "v24.11.0"])).score).toBe(0.5);
  });
  it("gives full credit for an answer the reference marks as also current", () => {
    const r = { ...ref(["v24.22.1", "v24.22.0"]), accept: ["v24.22.0"] };
    expect(gradeLatest("v24.22.0", r).score).toBe(1);
    expect(gradeLatest("TypeScript 7.1 Beta", { ...ref(["v7.0.2"]), accept: ["TypeScript 7.1 Beta"] }).score).toBe(1);
  });
});

describe("gradeNumeric", () => {
  it("gives full credit only for the latest close, half for the previous one", () => {
    const r = ref([], [7757.17, 7712.57, 7690.73]);
    expect(gradeNumeric(7757.2, r, 0.0002).score).toBe(1);
    expect(gradeNumeric(7712.6, r, 0.0002).score).toBe(0.5);
    expect(gradeNumeric(7690.7, r, 0.0002).score).toBe(0);
    expect(gradeNumeric(7757.64 - 3, r, 0.0002).score).toBe(0);
  });
  it("parses formatted numbers", () => {
    expect(parseNumber("7,757.17 points")).toBe(7757.17);
  });
});

describe("gradeFacts", () => {
  it("gives partial credit per fact", () => {
    const task = TASKS.find((t) => t.id === "r-arxiv")!;
    expect(gradeFacts(task, ["Attention Is All You Need", "Ashish Vaswani", "NOT FOUND"]).score).toBeCloseTo(2 / 3);
  });
});

describe("task set", () => {
  it("has 84 unique tasks with a grading contract each, 53 search / 31 access", () => {
    expect(TASKS).toHaveLength(84);
    expect(new Set(TASKS.map((t) => t.id)).size).toBe(84);
    expect(TASKS.filter((t) => trackOf(t) === "access")).toHaveLength(31);
    for (const t of TASKS) {
      if (t.tier.startsWith("stable")) expect(t.facts?.length, t.id).toBeGreaterThan(0);
      if (t.tier === "stable-read") expect(t.url, t.id).toBeTruthy();
      if (t.tier === "live-feed") expect(t.reference, t.id).toBeTruthy();
      if (t.tier === "live-judge") expect(t.constraints?.length, t.id).toBeGreaterThan(0);
    }
  });
  it("treats twitter.com as x.com and subdomains as on-site", () => {
    expect(hostMatches("https://twitter.com/NASA", "x.com")).toBe(true);
    expect(hostMatches("https://old.reddit.com/r/technology", "reddit.com")).toBe(true);
    expect(hostMatches("https://notreddit.com/", "reddit.com")).toBe(false);
  });
});

describe("formatBundle", () => {
  it("never leaves half of a surrogate pair at the cut", () => {
    const content = "a".repeat(39999) + "😀tail";
    const out = formatBundle([{ url: "https://example.com", content }]);
    expect(out.endsWith("a")).toBe(true);
    expect(/[\uD800-\uDFFF]/.test(out)).toBe(false);
  });
});

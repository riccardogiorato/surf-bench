import { describe, expect, it } from "vitest";
import { factNeedles, formatBundle, gradeFacts, gradeLatest, gradeNumeric, gradeOverlap, gradeScores, groundedIn, parseNumber, titlesMatch } from "./taskGrading.js";
import { TASKS, groupOf, hostMatches, trackOf } from "./tasks.js";

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

describe("groundedIn", () => {
  it("finds answers written differently on the page", () => {
    expect(groundedIn("92.3M", "[92\\.3M Followers](https://x.com/NASA/verified_followers)")).toBe(true);
    expect(groundedIn("20:30", "most are open until 20.30 on Fridays")).toBe(true);
    expect(groundedIn("3.0%", "| Sep'25 | 3.0 | 3.0 |")).toBe(true);
    expect(groundedIn("120.1 billion", "| Net income | | $120,067 |")).toBe(true);
    expect(groundedIn("24.22.0", "| [24.22.0](https://github.com/nodejs/node) (14 Oct 2026) |")).toBe(true);
    expect(groundedIn("September 11, 2008", "on 11 September 2008 the paper")).toBe(true);
    expect(groundedIn("1960年6月10日", "開業は1960年6月10日です")).toBe(true);
    expect(groundedIn("Criteria in the Criticism of West African Fiction", "thesis was on “Criteria in the [Criticism](https://m-w.com/c) of West African Fiction”")).toBe(true);
    expect(groundedIn("stackoverflow.com/questions/979256", "[Return to Answer](/questions/979256/sorting-an-array)")).toBe(true);
    expect(groundedIn("UK to invest £100m in 'world first' AI Biosecurity Lab", "1. UK to invest £100m in 'world first' AI Biosecurity Lab55m ago")).toBe(true);
  });
  it("rejects answers the pages never state", () => {
    expect(groundedIn("1926", "the Bica funicular opened in 1927")).toBe(false);
    expect(groundedIn("2017", "arXiv:1706.03762 Attention Is All You Need")).toBe(false);
    expect(groundedIn("24.22.1", "latest 24.22.0 and 24.22.10")).toBe(false);
    expect(groundedIn("Kagan", "Kaganovich was a politician")).toBe(false);
  });
  it("takes each required term from a lookahead-only key", () => {
    expect(factNeedles(/^(?=[\s\S]*kagan)(?=[\s\S]*soai)/i, "Henri B. Kagan and Kenso Soai")).toEqual(["kagan", "soai"]);
    expect(factNeedles(/\b19\d\d\b/, "opened in 1926")).toEqual(["1926"]);
  });
  it("gives no credit for a correct fact that is not in the pages", () => {
    const task = { facts: [{ q: "year?", pattern: /\b1926\b/ }, { q: "operator?", pattern: /carris/i }] } as any;
    const g = gradeFacts(task, ["1926", "Carris"], "Operated by Carris since 1927.");
    expect(g.score).toBe(0.5);
    expect(g.detail).toContain("not in the pages");
    expect(gradeFacts(task, ["1926", "Carris"]).score).toBe(1);
  });
  it("drops feed items and latest answers the pages do not contain", () => {
    expect(gradeOverlap(["Fed holds rates steady", "Invented headline about Mars"], ref(["Fed holds rates steady", "Invented headline about Mars"]), "Fed holds rates steady").score).toBe(0.2);
    expect(gradeLatest("v24.22.1", ref(["v24.22.1"]), "Node 24.22.0 is out").score).toBe(0);
    expect(gradeNumeric(6712.5, ref([], [6712.5]), 0.001, "S&P 500 closed at 6,712.50").score).toBe(1);
    expect(gradeNumeric(6712.5, ref([], [6712.5]), 0.001, "S&P 500 closed at 6,700").score).toBe(0);
  });
});

describe("gradeScores", () => {
  const finals = {
    ...ref(["Charlotte Hornets 115, Miami Heat 110 (2026-10-24)"]),
    games: [
      { day: "2026-10-24", teams: [["Charlotte Hornets", "Hornets", "CHA"], ["Miami Heat", "Heat", "MIA"]] as [string[], string[]], scores: [115, 110] as [number, number] },
      { day: "2026-10-24", teams: [["Philadelphia 76ers", "76ers", "PHI"], ["Milwaukee Bucks", "Bucks", "MIL"]] as [string[], string[]], scores: [127, 116] as [number, number] },
    ],
  };
  const page = "Heat 110 Hornets 115 Final | Bucks 116 76ers 127 Final";
  it("counts games whose teams and scores match the official finals, in either order", () => {
    const g = gradeScores([{ teams: ["Miami Heat", "Charlotte Hornets"], scores: [110, 115] }, { teams: ["PHI", "MIL"], scores: [127, 116] }], finals, 2, page);
    expect(g.score).toBe(1);
  });
  it("gives nothing for wrong scores or an older game day", () => {
    expect(gradeScores([{ teams: ["Hornets", "Heat"], scores: [110, 115] }], finals, 2, page).score).toBe(0);
    expect(gradeScores([{ teams: ["Lakers", "Celtics"], scores: [101, 99] }], finals, 2, page).score).toBe(0);
  });
  it("needs the score on the page", () => {
    const g = gradeScores([{ teams: ["Hornets", "Heat"], scores: [115, 110] }], finals, 2, "Hornets beat the Heat");
    expect(g.score).toBe(0);
    expect(g.detail).toContain("not in the pages");
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
      expect(() => groupOf(t), t.id).not.toThrow();
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

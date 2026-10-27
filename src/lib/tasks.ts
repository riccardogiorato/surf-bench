// SurfBench v2 task set: 80 hand-curated tasks in two weighted tracks (search,
// access; see TRACKS below), one event.
//
// Every task carries its own grading contract (gold facts, a live reference
// feed, or explicit yes/no constraints) and a `verified` block recording who
// checked it, when, and against what evidence. `verified.by === AGENT_DRAFT`
// marks an answer key drafted by the coding agent and not yet human-checked:
// the run and the report work, but `bun run tasks:audit` refuses to publish.

export type TaskTier = "stable-read" | "stable-lookup" | "live-feed" | "live-judge";
export type TaskCategory =
  | "social"
  | "news"
  | "ecommerce"
  | "realestate"
  | "media"
  | "reference"
  | "general";

export interface Fact {
  q: string; // asked of the reader
  pattern: RegExp; // matched against the reader's answer
}

export type ReferenceKind =
  | { kind: "overlap"; source: FeedSource; pool: number }
  | { kind: "latest"; source: FeedSource }
  | { kind: "numeric"; source: FeedSource; tolerance: number }
  | { kind: "scores"; source: FeedSource; minGames: number }; // final scores vs the official scoreboard

export type FeedSource =
  | { type: "rss"; url: string; also?: string[] } // also: extra listings unioned into the pool
  | { type: "hn" }
  | { type: "github-releases"; repo: string }
  | { type: "node-lts" }
  | { type: "wikipedia-featured" }
  | { type: "fred"; series: string }
  | { type: "espn-scoreboard"; sport: string; league: string }
  | { type: "espn-standings"; league: string }
  | { type: "npm-latest"; pkg: string }
  | { type: "pypi-latest"; pkg: string }
  | { type: "itunes-version"; appId: number }
  | { type: "crypto-spot"; coin: "bitcoin" }
  | { type: "bluesky-feed"; actor: string }
  | { type: "polymarket-events" }
  | { type: "yahoo-quote"; symbol: string }
  | { type: "steam-price"; appId: number }
  | { type: "f1-last-winner" }
  | { type: "ecb-rate"; from: string; to: string };

export interface Task {
  id: string;
  tier: TaskTier;
  category: TaskCategory;
  request: string; // sent verbatim as the search query
  site?: string; // target host, enables the deterministic on-site check
  url?: string; // stable-read only: fetched directly, no search leg
  lang?: string;
  freshDays?: number;
  facts?: Fact[]; // stable tiers: every fact is one unit of partial credit
  reference?: ReferenceKind; // live-feed
  constraints?: string[]; // live-judge: yes/no checks for the judge panel
  verified: { by: string; at: string; evidence: string[] };
}

export const AGENT_DRAFT = "agent-draft";
// Cross-checked by separate agents working blind (stable keys re-derived from
// the primary source, live keys reviewed against run data). Still not a human
// check: the audit only passes these under --provisional.
export const AGENT_CHECK = "agent-check";
const draft = (...evidence: string[]) => ({ by: AGENT_DRAFT, at: "2026-10-22", evidence });
const checked = (...evidence: string[]) => ({ by: AGENT_CHECK, at: "2026-10-22", evidence });
const checkedOn = (at: string, ...evidence: string[]) => ({ by: AGENT_CHECK, at, evidence });
const draftOn = (at: string, ...evidence: string[]) => ({ by: AGENT_DRAFT, at, evidence });

// Repeats per release. Stable tasks are deterministic enough to run once;
// live tasks are averaged over rounds so one flaky request can't flip a cell.
export const LIVE_ROUNDS = 3;
export const isLive = (t: Task) => t.tier === "live-feed" || t.tier === "live-judge";

// Two tracks, weighted in scoring.ts (TRACK_WEIGHTS). Search: find the answer
// on the open web. Access: open a given page, or reach a named bot-walled site
// (social, marketplaces, paywalls). Every task not listed here is search.
export type Track = "search" | "access";
export const TRACKS: Track[] = ["search", "access"];
const ACCESS_TASKS = new Set([
  "r-ig", "r-x", "r-nyt", "r-bbc", "r-amz", "r-tgt", "r-hd", "r-yt", "r-li", "r-arxiv",
  "l-wmt",
  "f-yt", "f-rd1", "f-rd2", "f-nyt",
  "a-nba", "a-npm", "a-cmc", "a-bsky", "a-epl", "a-nfl", "a-yhoo", "a-steam", "a-app",
]);
export const trackOf = (t: Task | string): Track => (ACCESS_TASKS.has(typeof t === "string" ? t : t.id) ? "access" : "search");

// What a task tests, for the per-group breakdown (not scored separately).
// `category` is the topic; a group is the skill, keyed on the id prefix.
export const TASK_GROUPS = [
  { id: "docs", label: "Docs & specs", prefix: "s-doc-" },
  { id: "multi-hop", label: "Multi-hop", prefix: "s-hop-" },
  { id: "numbers", label: "Numbers & stats", prefix: "s-num-" },
  { id: "local", label: "Local & non-English", prefix: "s-loc-" },
  { id: "news", label: "Recent news", prefix: "s-new-" },
  { id: "lookups", label: "Classic lookups", prefix: "l-" },
  { id: "feeds", label: "Live feeds", prefix: "f-" },
  { id: "pages", label: "Hard-site pages", prefix: "r-" },
  { id: "walled", label: "Live on hard sites", prefix: "a-" },
] as const;
export type TaskGroup = (typeof TASK_GROUPS)[number]["id"];
export const groupOf = (t: Task | string): TaskGroup => {
  const id = typeof t === "string" ? t : t.id;
  const g = TASK_GROUPS.find((x) => id.startsWith(x.prefix));
  if (!g) throw new Error(`task ${id} has no group`);
  return g.id;
};

export const TASKS: Task[] = [
  // ---------------- stable-read: can it open this page and pull the facts? ----------------
  {
    id: "r-ig", tier: "stable-read", category: "social", site: "instagram.com",
    url: "https://www.instagram.com/nasa/",
    request: "Read this Instagram profile and report the account handle and follower count.",
    facts: [
      { q: "What is the account's handle or display name?", pattern: /nasa/i },
      { q: "How many followers does the account have?", pattern: /\b1\d{2}(\.\d+)?\s*(m\b|million)|\b1\d{2},\d{3},\d{3}\b/i },
    ],
    verified: checked("page capture 2026-10: 104,335,282 followers", "blind check 2026-10-22: og tags \"104M Followers\", @nasa"),
  },
  {
    id: "r-x", tier: "stable-read", category: "social", site: "x.com",
    url: "https://x.com/NASA",
    request: "Read this X profile and report the display name, handle and follower count.",
    facts: [
      { q: "What is the profile's display name?", pattern: /nasa/i },
      { q: "What is the profile's handle?", pattern: /@?nasa\b/i },
      { q: "How many followers does the profile have?", pattern: /\b\d{2,3}(\.\d+)?\s*(m\b|million)|\b\d{2,3},\d{3},\d{3}\b/i },
    ],
    verified: checked("https://x.com/NASA", "blind check 2026-10-22: NASA @NASA, 92.3M followers"),
  },
  {
    id: "r-nyt", tier: "stable-read", category: "news", site: "nytimes.com",
    url: "https://www.nytimes.com/2023/03/28/technology/ai-chatbots-chatgpt-bing-bard-llm.html",
    request: "Read this New York Times article and report its headline and the example bot it builds.",
    facts: [
      // NYT serves the on-page headline and a different <title>; both are the article's.
      { q: "What is the article's headline?", pattern: /how does chatgpt really work|how chatbots and large language models.{0,20}actually work/i },
      { q: "What is the name of the example email bot the article walks through building?", pattern: /mailbot/i },
    ],
    verified: checked("page capture (tavily, exa) 2026-10", "blind check: visible headline \"How Does ChatGPT Really Work?\", <title> \"How Chatbots and Large Language Models, or LLMs, Actually Work\"; MailBot (Wayback 2024)"),
  },
  {
    id: "r-bbc", tier: "stable-read", category: "news", site: "bbc.com",
    url: "https://www.bbc.com/future/article/20241014-the-deep-sea-emergency-service-that-keeps-the-internet-running",
    request: "Read this BBC article and report its author and the share of digital communications carried by subsea cables.",
    facts: [
      { q: "Who wrote the article?", pattern: /william park/i },
      { q: "What share of the world's digital communications rely on subsea cables, per the article?", pattern: /\b99\b|ninety-nine/i },
    ],
    verified: checked("page capture (exa) 2026-10", "blind check: William Park; 99% of digital communications"),
  },
  {
    id: "r-amz", tier: "stable-read", category: "ecommerce", site: "amazon.com",
    url: "https://www.amazon.com/New-Amazon-Kindle-glare-free-adjustable/dp/B0DDZQTYHL",
    request: "Read this Amazon product page and report the product, its storage, screen size and star rating.",
    facts: [
      { q: "What product is this?", pattern: /kindle/i },
      { q: "How much storage does it have?", pattern: /16\s?gb/i },
      { q: "What is the display size?", pattern: /\b6(\.0)?\s*(”|"|''|-?\s?inch|in\b)/i },
      { q: "What is its average star rating?", pattern: /\b4\.\d\b/ },
    ],
    verified: checked("page capture (keenable) 2026-10: Kindle 16 GB (2024), 6\" display, 4.5 stars", "blind check: Kindle 16 GB (2024), 6\" display, 4.5 stars (19,598 ratings)"),
  },
  {
    id: "r-tgt", tier: "stable-read", category: "ecommerce", site: "target.com",
    url: "https://www.target.com/p/airpods-pro-2nd-generation-with-magsafe-case-usb-c/-/A-85978622",
    request: "Read this Target product page and report the product name and price.",
    facts: [
      { q: "What product is this?", pattern: /airpods pro/i },
      { q: "What is the listed price?", pattern: /\$\s?\d{2,3}(\.\d{2})?/ },
    ],
    verified: checked("page capture 2026-10", "blind check: Apple AirPods Pro 2, $249.99 (redsky API)"),
  },
  {
    id: "r-hd", tier: "stable-read", category: "ecommerce", site: "homedepot.com",
    url: "https://www.homedepot.com/p/DEWALT-20V-MAX-Cordless-1-2-in-Drill-Driver-2-20V-1-3Ah-Batteries-Charger-and-Bag-DCD771C2/204279858",
    request: "Read this Home Depot product page and report the model number, battery capacity and top speed.",
    facts: [
      { q: "What is the model number?", pattern: /dcd771c2/i },
      { q: "What is the capacity of the included batteries?", pattern: /1\.3\s?ah/i },
      { q: "What is the maximum speed in RPM?", pattern: /1,?500/ },
    ],
    verified: checked("page capture (exa) 2026-10: DCD771C2, (2) 1.3Ah, 0-1500 rpm", "blind check: DCD771C2, 2x 1.3Ah, 0-1,500 RPM"),
  },
  {
    id: "r-yt", tier: "stable-read", category: "media", site: "youtube.com",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    request: "Read this YouTube video page and report the title and channel.",
    facts: [
      { q: "What is the video's title?", pattern: /never gonna give you up/i },
      { q: "Which channel published it?", pattern: /rick astley/i },
    ],
    verified: checked("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "blind check: oEmbed title \"Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)\", channel Rick Astley"),
  },
  {
    id: "r-li", tier: "stable-read", category: "social", site: "linkedin.com",
    url: "https://www.linkedin.com/company/openai/",
    request: "Read this LinkedIn company page and report the company, headquarters and industry.",
    facts: [
      { q: "Which company is this?", pattern: /openai/i },
      { q: "Where is it headquartered?", pattern: /san francisco/i },
      { q: "What industry is it listed under?", pattern: /research/i },
    ],
    verified: checked("page capture (tavily) 2026-10: Research Services, San Francisco, CA", "blind check: OpenAI, San Francisco CA, Research Services"),
  },
  {
    id: "r-arxiv", tier: "stable-read", category: "reference", site: "arxiv.org",
    url: "https://arxiv.org/abs/1706.03762",
    request: "Read this arXiv abstract page and report the title, first author and submission year.",
    facts: [
      { q: "What is the paper's title?", pattern: /attention is all you need/i },
      { q: "Who is the first author?", pattern: /vaswani/i },
      { q: "In what year was it first submitted?", pattern: /2017/ },
    ],
    verified: checked("https://arxiv.org/abs/1706.03762", "blind check: Attention Is All You Need, Vaswani, v1 12 Jun 2017"),
  },

  // ---------------- stable-lookup: find a fixed fact ----------------
  {
    id: "l-eiffel", tier: "stable-lookup", category: "general",
    request: "When was the Eiffel Tower completed?",
    facts: [{ q: "When was the Eiffel Tower completed?", pattern: /1889/ }],
    verified: checked("https://en.wikipedia.org/wiki/Eiffel_Tower", "blind check: https://en.wikipedia.org/wiki/Eiffel_Tower (completed 31 March 1889)"),
  },
  {
    id: "l-imdb", tier: "stable-lookup", category: "media", site: "imdb.com",
    request: "Who plays the lead role in Oppenheimer (2023) according to IMDb?",
    facts: [{ q: "Who plays the lead role?", pattern: /cillian murphy/i }],
    verified: checked("https://www.imdb.com/title/tt15398776/", "blind check: https://www.imdb.com/title/tt15398776/ (Cillian Murphy, top billed)"),
  },
  {
    id: "l-delta", tier: "stable-lookup", category: "general", site: "delta.com",
    request: "What is Delta's carry-on bag size limit?",
    facts: [{ q: "What are the maximum carry-on dimensions?", pattern: /22\D{1,8}14\D{1,8}9|56\D{1,8}35\D{1,8}23/ }],
    verified: checked("https://www.delta.com/us/en/baggage/carry-on-baggage (22 x 14 x 9 in, checked 2026-10-22)", "blind check: https://www.delta.com/us/en/baggage/carry-on-baggage (22 x 14 x 9 in / 56 x 35 x 23 cm)"),
  },
  {
    id: "l-bm", tier: "stable-lookup", category: "general", site: "britishmuseum.org",
    request: "What are the British Museum's regular opening hours?",
    facts: [
      { q: "What time does the museum open on a regular day?", pattern: /\b10([:.]00)?\s*(am|a\.m\.)?\b/i },
      { q: "What time does it close on a regular day?", pattern: /\b17[:.]00\b|\b5([:.]00)?\s*(pm|p\.m\.)/i },
      { q: "Until what time is it open on Fridays?", pattern: /\b20[:.]30\b|\b8[:.]30\s*(pm|p\.m\.)/i },
    ],
    verified: checked("https://www.britishmuseum.org/visit (daily 10.00–17.00, Fridays 20.30, checked 2026-10-22)", "blind check: https://www.britishmuseum.org/visit (daily 10:00-17:00, Fridays to 20:30)"),
  },
  {
    id: "l-kyoto", tier: "stable-lookup", category: "general",
    request: "What is the fastest way to travel from Tokyo to Kyoto?",
    facts: [{ q: "What is the fastest way to travel from Tokyo to Kyoto?", pattern: /shinkansen|bullet train|nozomi/i }],
    verified: checked("https://global.jr-central.co.jp/en/", "blind check: https://kyoto.travel/en/getting-to/ (Tokaido Shinkansen Nozomi, ~2h15)"),
  },
  {
    id: "l-so", tier: "stable-lookup", category: "reference", site: "stackoverflow.com",
    request: "Find the Stack Overflow question about sorting an array of objects by a property value in JavaScript.",
    facts: [{ q: "What is the URL of the Stack Overflow question?", pattern: /stackoverflow\.com\/questions\/(1129216|979256)\b/i }],
    verified: checked("https://stackoverflow.com/questions/1129216", "https://stackoverflow.com/questions/979256", "blind check: Stack Exchange API — 1129216 canonical, 979256 equally literal match"),
  },
  {
    id: "l-wmt", tier: "stable-lookup", category: "ecommerce", site: "walmart.com",
    request: "How many days does Walmart give you to return most items?",
    facts: [{ q: "How many days do you have to return most items?", pattern: /\b90\b/ }],
    verified: checked("https://www.walmart.com/cp/returns/1231920 (90 days, checked 2026-10-22)", "blind check: https://www.walmart.com/help/article/walmart-standard-return-policy/adc0dfb692954e67a4de206fb8d9e03a (90 days)"),
  },
  {
    id: "l-gh", tier: "stable-lookup", category: "reference", site: "github.com",
    request: "What license is the microsoft/TypeScript repository on GitHub under?",
    facts: [{ q: "What license is the repository under?", pattern: /apache/i }],
    verified: checked("https://github.com/microsoft/TypeScript/blob/main/LICENSE.txt", "blind check: GitHub API license field (Apache-2.0)"),
  },
  {
    id: "l-wiki", tier: "stable-lookup", category: "reference", site: "wikipedia.org",
    request: "According to Wikipedia, when was Ada Lovelace born?",
    facts: [{ q: "When was Ada Lovelace born?", pattern: /10(th)?\s+dec(ember)?\.?,?\s+1815|dec(ember)?\.?\s+10(th)?,?\s+1815|1815-12-10/i }],
    verified: checked("https://en.wikipedia.org/wiki/Ada_Lovelace", "blind check: https://en.wikipedia.org/wiki/Ada_Lovelace (10 December 1815)"),
  },
  {
    id: "l-openai", tier: "stable-lookup", category: "general",
    request: "Who is the current CEO of OpenAI?",
    facts: [{ q: "Who is the current CEO of OpenAI?", pattern: /altman/i }],
    verified: checked("https://www.politico.com/news/2026/10/05/sam-altman-ai-industry-political-spending-01106527", "blind check: https://www.theinformation.com/org-charts/openai (Sam Altman, 2026-10-14)"),
  },
  {
    id: "l-de", tier: "stable-lookup", category: "general", lang: "de",
    request: "Wie hoch ist die Zugspitze?",
    facts: [{ q: "Wie hoch ist die Zugspitze (in Metern)?", pattern: /\b2[.,\s]?96[123]\b/ }],
    verified: checked("https://de.wikipedia.org/wiki/Zugspitze (2962 m)", "blind check: https://de.wikipedia.org/wiki/Zugspitze (2962,06 m; 2961/2963 in other sources)"),
  },
  {
    id: "l-ja", tier: "stable-lookup", category: "general", lang: "ja",
    request: "東京スカイツリーの高さは？",
    facts: [{ q: "東京スカイツリーの高さは何メートルですか？", pattern: /634/ }],
    verified: checked("https://www.tokyo-skytree.jp/ (634 m)", "blind check: https://www.tokyo-skytree.jp/about/ (634 m)"),
  },

  // ---------------- search · docs ----------------
  {
    id: "s-doc-1", tier: "stable-lookup", category: "reference",
    request: "Per RFC 9112 (HTTP/1.1 message syntax), what is the minimum request-line length that all HTTP senders and recipients are recommended to support?",
    facts: [
      { q: "What minimum request-line length does RFC 9112 recommend all HTTP senders and recipients support?", pattern: /(?<![\d,.])8[,.]?000(?![\d,])/i },
    ],
    verified: checkedOn("2026-10-25", "https://www.rfc-editor.org/rfc/rfc9112.txt", "https://www.rfc-editor.org/rfc/rfc9112.html#section-3", "blind check 2026-10-25 (high): 8000 octets"),
  },
  {
    id: "s-doc-2", tier: "stable-lookup", category: "reference",
    request: "In the WebSocket protocol (RFC 6455), what fixed GUID does the server append to Sec-WebSocket-Key when computing Sec-WebSocket-Accept, and what is the maximum payload length allowed for a control frame?",
    facts: [
      { q: "What GUID string is concatenated with Sec-WebSocket-Key to compute Sec-WebSocket-Accept?", pattern: /\b258EAFA5-E914-47DA-95CA-C5AB0DC85B11\b/i },
      { q: "What is the maximum payload length of a WebSocket control frame?", pattern: /(?<![\d,.])125(?![\d,])/i },
    ],
    verified: checkedOn("2026-10-25", "https://www.rfc-editor.org/rfc/rfc6455.txt", "https://www.rfc-editor.org/rfc/rfc6455.html#section-5.5", "blind check 2026-10-25 (high): 258EAFA5-E914-47DA-95CA-C5AB0DC85B11; 125 bytes"),
  },
  {
    id: "s-doc-3", tier: "stable-lookup", category: "reference",
    request: "SQLite limits: by default, how many databases can be attached to a single connection at the same time, and what is the highest that limit can ever be raised to?",
    facts: [
      { q: "What is the default maximum number of simultaneously attached databases in SQLite (SQLITE_MAX_ATTACHED)?", pattern: /(?<![\d,.])(10|ten)(?![\d,])/i },
      { q: "What is the absolute maximum value the attached-database limit can be increased to?", pattern: /(?<![\d,.])125(?![\d,])/i },
    ],
    verified: checkedOn("2026-10-25", "https://www.sqlite.org/limits.html", "https://www.sqlite.org/lang_attach.html", "blind check 2026-10-25 (high): 10; 125"),
  },
  {
    id: "s-doc-4", tier: "stable-lookup", category: "reference",
    request: "In Python 3.13, what is the default limit on the number of digits when converting a large int to or from a decimal string, and what is the lowest non-zero value that limit can be set to?",
    facts: [
      { q: "What is the default int/str conversion digit limit in Python 3.13 (sys.int_info.default_max_str_digits)?", pattern: /(?<![\d,.])4[,.]?300(?![\d,])/i },
      { q: "What is the lowest non-zero value the limit can be configured to (sys.int_info.str_digits_check_threshold)?", pattern: /(?<![\d,.])640(?![\d,])/i },
    ],
    verified: checkedOn("2026-10-25", "https://docs.python.org/3.13/library/stdtypes.html#int-max-str-digits", "https://docs.python.org/3.13/library/sys.html#sys.int_info", "blind check 2026-10-25 (high): 4300 digits; 640 digits"),
  },
  {
    id: "s-doc-5", tier: "stable-lookup", category: "reference",
    request: "In PostgreSQL 17, what are the default values of jit_above_cost and jit_inline_above_cost?",
    facts: [
      { q: "What is the default value of jit_above_cost in PostgreSQL 17?", pattern: /(?<![\d,.])100[, ]?000(?![\d,])/i },
      { q: "What is the default value of jit_inline_above_cost in PostgreSQL 17?", pattern: /(?<![\d,.])500[, ]?000(?![\d,])/i },
    ],
    verified: checkedOn("2026-10-25", "https://www.postgresql.org/docs/17/runtime-config-query.html", "https://raw.githubusercontent.com/postgres/postgres/REL_17_STABLE/src/backend/utils/misc/postgresql.conf.sample", "blind check 2026-10-25 (high): 100000; 500000"),
  },
  {
    id: "s-doc-6", tier: "stable-lookup", category: "reference",
    request: "What is the current AWS Lambda maximum payload size for asynchronous invocations, and the maximum response size for a function using response streaming?",
    facts: [
      { q: "What is the maximum invocation payload size for asynchronous Lambda invocations?", pattern: /(?<![\d,.])1\s*(MB|MiB|megabytes?)\b/i },
      { q: "What is the maximum response payload size for a streamed Lambda response?", pattern: /(?<![\d,.])200\s*(MB|MiB|megabytes?)\b/i },
    ],
    verified: checkedOn("2026-10-25", "https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html", "https://aws.amazon.com/about-aws/whats-new/2025/10/aws-lambda-payload-size-256-kb-1-mb-invocations/", "blind check 2026-10-25 (medium): 1 MB; 200 MB"),
  },
  {
    id: "s-doc-7", tier: "stable-lookup", category: "reference",
    request: "GitHub Actions limits: what is the maximum number of jobs a matrix can generate in one workflow run, and how long can a single job run on a self-hosted runner before it is terminated?",
    facts: [
      { q: "What is the maximum number of jobs a matrix can generate per workflow run?", pattern: /(?<![\d,.])256(?![\d,])/i },
      { q: "What is the maximum execution time for a single job on a self-hosted runner?", pattern: /\b(5|five)\s*days?\b|(?<![\d,.])120\s*hours?\b/i },
    ],
    verified: checkedOn("2026-10-25", "https://docs.github.com/en/actions/reference/limits", "https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax", "blind check 2026-10-25 (high): 256 jobs per workflow run; 5 days"),
  },

  // ---------------- search · multihop ----------------
  {
    id: "s-hop-1", tier: "stable-lookup", category: "general",
    request: "The Ukrainian mathematician who won a Fields Medal in 2022 for her sphere-packing work earned a doctorate at a German university in 2013. Which university was it, and what was her dissertation titled?",
    facts: [
      { q: "At which German university did she earn her 2013 doctorate?", pattern: /\bbonn\b/i },
      { q: "What was the title of her 2013 doctoral dissertation?", pattern: /\bmodular\s+functions\s+and\s+special\s+cycles\b/i },
    ],
    verified: checkedOn("2026-10-25", "https://en.wikipedia.org/wiki/Maryna_Viazovska", "https://mathshistory.st-andrews.ac.uk/Biographies/Viazovska/", "blind check 2026-10-25 (high): University of Bonn (Rheinische Friedrich-Wilhelms-Universität Bonn); Modular Functions and Special Cycles"),
  },
  {
    id: "s-hop-2", tier: "stable-lookup", category: "general",
    request: "Two researchers shared a Turing Award for laying the foundations of reinforcement learning, and one of them had been the other's PhD advisor. Where did that advisor earn his own PhD, and what was his doctoral thesis about?",
    facts: [
      { q: "At which university did the advisor (the senior of the two laureates) earn his PhD?", pattern: /\bmichigan\b/i },
      { q: "What was the subject of the advisor's doctoral thesis?", pattern: /\bcellular\s+automat/i },
    ],
    verified: checkedOn("2026-10-25", "https://en.wikipedia.org/wiki/Andrew_Barto", "https://amturing.acm.org/award_winners/barto_9471663.cfm", "blind check 2026-10-25 (high): University of Michigan (Ann Arbor), PhD in computer science, 1975; Cellular automata, with the thesis titled 'Cellular Automata as Models of Natural Systems'"),
  },
  {
    id: "s-hop-3", tier: "stable-lookup", category: "general",
    request: "Which South African novelist finally won the Booker Prize after having been shortlisted twice before, which book won it, and who chaired the judging panel that year?",
    facts: [
      { q: "Which South African novelist won?", pattern: /\bgalgut\b/i },
      { q: "What was the title of the winning novel?", pattern: /\bpromise\b/i },
      { q: "Who chaired the Booker judges the year he won?", pattern: /\bjasanoff\b/i },
    ],
    verified: checkedOn("2026-10-25", "https://thebookerprizes.com/the-booker-library/prize-years/2021", "https://en.wikipedia.org/wiki/Damon_Galgut", "blind check 2026-10-25 (high): The Promise (Damon Galgut, 2021 Booker Prize); Maya Jasanoff"),
  },
  {
    id: "s-hop-4", tier: "stable-lookup", category: "general",
    request: "The most recent bridge built across Venice's Grand Canal was designed by a Spanish architect-engineer. What is its official name, and on what date did it open to the public?",
    facts: [
      { q: "What is the bridge's official name?", pattern: /\b(costituzione|constitution)\b/i },
      { q: "On what date did it open to the public?", pattern: /\b1[12](th)?\s+(of\s+)?sep(t(ember)?)?\.?,?\s+2008\b|\bsep(t(ember)?)?\.?\s+1[12](th)?,?\s+2008\b|\b2008-09-1[12]\b|\b1[12][\/.]0?9[\/.]2008\b/i },
    ],
    verified: checkedOn("2026-10-25", "https://en.wikipedia.org/wiki/Ponte_della_Costituzione", "https://www.meetingvenice.it/en/art-and-history/can-t-miss/constitution-bridge", "blind check 2026-10-25 (medium): Ponte della Costituzione (Constitution Bridge), commonly called the Calatrava Bridge; 11 September 2008", "opened ~23:44 on 11 Sep 2008: 11 or 12 Sep accepted"),
  },
  {
    id: "s-hop-5", tier: "stable-lookup", category: "general",
    request: "The first African-born architect to win the Pritzker Prize built his very first building, a primary school, in his home village. What is the village called, and what major architecture award did that school win in 2004?",
    facts: [
      { q: "What is the name of the home village where his first building stands?", pattern: /\bgando\b/i },
      { q: "Which award did the school win in 2004?", pattern: /\baga\s+khan\b/i },
    ],
    verified: checkedOn("2026-10-25", "https://www.pritzkerprize.com/laureates/diebedo-francis-kere", "https://en.wikipedia.org/wiki/Di%C3%A9b%C3%A9do_Francis_K%C3%A9r%C3%A9", "blind check 2026-10-25 (high): Gando, Burkina Faso; Aga Khan Award for Architecture (2004 cycle)"),
  },
  {
    id: "s-hop-6", tier: "stable-lookup", category: "general",
    request: "The European spacecraft that delivered the first-ever lander onto a comet ended its own mission by deliberately crash-landing on that same comet. What name was given to its final impact site, and in which region of the comet is that site?",
    facts: [
      { q: "What name was given to the orbiter's final impact site?", pattern: /\bsa[iï]s\b/i },
      { q: "In which region of the comet is the impact site?", pattern: /\bma['’`]?at\b/i },
    ],
    verified: checkedOn("2026-10-25", "https://en.wikipedia.org/wiki/Rosetta_(spacecraft)", "https://blogs.esa.int/rosetta/2016/10/03/rosetta-impact-site-named-sais/index.html", "blind check 2026-10-25 (high): Sais (named after the Egyptian town where the Rosetta Stone was originally located); Ma'at region, on the comet's small lobe ('head') of 67P/Churyumov-Gerasimenko, just inside a shallow anc"),
  },
  {
    id: "s-hop-7", tier: "stable-lookup", category: "general",
    request: "The Nobel literature laureate who fled Zanzibar as a teenage refugee and later spent decades teaching English literature in England — what was his first novel, and what was the title of his PhD thesis?",
    facts: [
      { q: "What was his first novel?", pattern: /\bmemory\s+of\s+departure\b/i },
      { q: "What was the title of his PhD thesis?", pattern: /\bcriteria\b.*\bwest\s+african\s+fiction\b/i },
    ],
    verified: checkedOn("2026-10-25", "https://en.wikipedia.org/wiki/Abdulrazak_Gurnah", "https://kar.kent.ac.uk/94388/", "blind check 2026-10-25 (high): Memory of Departure (1987); Criteria in the Criticism of West African Fiction (PhD, University of Kent, 1982)"),
  },

  // ---------------- search · numbers ----------------
  {
    id: "s-num-1", tier: "stable-lookup", category: "general",
    request: "What were Apple's total net sales and net income for fiscal year 2025 (the year ended September 27, 2025), per its 10-K?",
    facts: [
      { q: "What were Apple's total net sales for fiscal 2025?", pattern: /\b416,161\b|\b416(?:\.16?1?|\.2)?\s*(?:billion|bn|b)\b/i },
      { q: "What was Apple's net income for fiscal 2025?", pattern: /\b112,010\b|\b112(?:\.01?0?)?\s*(?:billion|bn|b)\b/i },
    ],
    verified: checkedOn("2026-10-25", "https://www.apple.com/newsroom/2025/10/apple-reports-fourth-quarter-results/", "https://data.sec.gov/api/xbrl/companyconcept/CIK0000320193/us-gaap/RevenueFromContractWithCustomerExcludingAssessedTax.json", "blind check 2026-10-25 (high): $416,161 million (~$416.2 billion); $112,010 million (~$112.0 billion)"),
  },
  {
    id: "s-num-2", tier: "stable-lookup", category: "general",
    request: "How much total revenue and GAAP net income did NVIDIA report for its fiscal year 2026 (ended January 25, 2026)?",
    facts: [
      { q: "What was NVIDIA's total revenue for fiscal 2026?", pattern: /\b215,938\b|\b215\.9(?:4|38)?\s*(?:billion|bn|b)\b/i },
      { q: "What was NVIDIA's GAAP net income for fiscal 2026?", pattern: /\b120,067\b|\b120\.(?:1|07|067)\s*(?:billion|bn|b)\b/i },
    ],
    verified: checkedOn("2026-10-25", "https://nvidianews.nvidia.com/news/nvidia-announces-financial-results-for-fourth-quarter-and-fiscal-2026", "blind check 2026-10-25 (high): $215,938 million (~$215.9 billion); $120,067 million (~$120.1 billion) GAAP net income"),
  },
  {
    id: "s-num-3", tier: "stable-lookup", category: "general",
    request: "What did the ECB set its deposit facility rate and main refinancing operations rate to at its 5 June 2025 monetary policy meeting?",
    facts: [
      { q: "What deposit facility rate did the ECB set on 5 June 2025?", pattern: /(?<![\d.])2(?:\.00?)?\s*(?:%|percent|per cent)/i },
      { q: "What main refinancing operations rate did the ECB set on 5 June 2025?", pattern: /(?<![\d.])2\.15\s*(?:%|percent|per cent)?(?!\d)/i },
    ],
    verified: checkedOn("2026-10-25", "https://www.ecb.europa.eu/press/pr/date/2025/html/ecb.mp250605~3b5f67d007.en.html", "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/key_ecb_interest_rates/html/index.en.html", "blind check 2026-10-25 (high): 2.00% (deposit facility rate); 2.15% (main refinancing operations rate)"),
  },
  {
    id: "s-num-4", tier: "stable-lookup", category: "general",
    request: "At the Federal Reserve's December 10, 2025 FOMC meeting, what target range was set for the federal funds rate, and how many voting members dissented?",
    facts: [
      { q: "What target range for the federal funds rate did the FOMC set on December 10, 2025?", pattern: /3(?:\.50?|-1\/2|\s1\/2|½)\s*(?:%|percent|per cent)?\s*(?:-|–|—|to)\s*3(?:\.75|-3\/4|\s3\/4|¾)/i },
      { q: "How many FOMC voting members dissented from the December 10, 2025 decision?", pattern: /\b(3|three)\b(?![.\d%\-\u2013\/])/i },
    ],
    verified: checkedOn("2026-10-25", "https://www.federalreserve.gov/newsevents/pressreleases/monetary20251210a.htm", "blind check 2026-10-25 (high): 3.50% to 3.75% (cut by 25 bp); 3 dissents: Stephen Miran (wanted a 50 bp cut); Austan Goolsbee and Jeffrey Schmid (wanted no change)"),
  },
  {
    id: "s-num-5", tier: "stable-lookup", category: "general",
    request: "According to the BLS September 2025 CPI release, how much did the CPI-U all items index rise over the 12 months ending September 2025, and what was the 12-month change in the energy index?",
    facts: [
      { q: "What was the 12-month (not seasonally adjusted) change in the CPI-U all items index for September 2025?", pattern: /(?<![\d.])3(?:\.0)?\s*(?:%|percent|per cent)/i },
      { q: "What was the 12-month change in the CPI-U energy index for September 2025?", pattern: /(?<![\d.])2\.8\s*(?:%|percent|per cent)?(?!\d)/i },
    ],
    verified: checkedOn("2026-10-25", "https://www.bls.gov/news.release/archives/cpi_10242025.htm", "blind check 2026-10-25 (high): +3.0%; +2.8%"),
  },
  {
    id: "s-num-6", tier: "stable-lookup", category: "general",
    request: "In NOAA's annual 2025 global climate report, how far above the 20th-century average was the 2025 global surface temperature, and where did 2025 rank in the record?",
    facts: [
      { q: "How far above the 20th-century average was the 2025 global surface temperature according to NOAA?", pattern: /\b1\.1[678]\s*\u00B0?\s*c?\b|\b2\.1[01]\s*\u00B0?\s*f?\b/i },
      { q: "Where did 2025 rank among the warmest years in NOAA's record?", pattern: /\b(?:3rd|third)\b/i },
    ],
    verified: checkedOn("2026-10-25", "https://www.ncei.noaa.gov/news/global-climate-202513", "blind check 2026-10-25 (high): 1.17°C (2.11°F) above the 20th-century average; Third-warmest year on record (records since 1850), behind 2024 and 2023"),
  },
  {
    id: "s-num-7", tier: "stable-lookup", category: "general",
    request: "What height won the men's pole vault final at the 2025 World Athletics Championships in Tokyo, and who took the silver medal?",
    facts: [
      { q: "What was the winning height in the men's pole vault final at the 2025 World Athletics Championships in Tokyo?", pattern: /(?<![\d.])6[.,]30?(?!\d)/i },
      { q: "Who won silver in the men's pole vault at the 2025 World Athletics Championships?", pattern: /karalis/i },
    ],
    verified: checkedOn("2026-10-25", "https://worldathletics.org/news/report/world-championships-tokyo-25-report-mens-pole-vault", "https://www.olympics.com/en/news/world-athletics-championships-tokyo-25-track-field-schedule-medal-table-finals-results", "blind check 2026-10-25 (high): 6.30 m (world record, Armand 'Mondo' Duplantis); Emmanouil Karalis (Greece), 6.00 m"),
  },

  // ---------------- search · longtail ----------------
  {
    id: "s-loc-1", tier: "stable-lookup", category: "general", lang: "ja",
    request: "明石市立天文科学館は何年何月何日に開館しましたか？また、プラネタリウムのドームの直径は何メートルですか？",
    facts: [
      { q: "On what date did the Akashi Municipal Planetarium open?", pattern: /(1960|昭和\s*35).*(6\s*月\s*10\s*日|june\s*10|10\s*june|0?6[-\/.]10\b)|(6\s*月\s*10\s*日|june\s*10|10\s*june).*(1960|昭和\s*35)/i },
      { q: "What is the diameter of the planetarium dome, in metres?", pattern: /(^|[^0-9.,])20\s*(m\b|ｍ|メートル|meters?\b|metres?\b)/i },
    ],
    verified: checkedOn("2026-10-25", "https://www.am12.jp/about/", "https://www.am12.jp/akashi-shigosen/", "blind check 2026-10-25 (high): 10 June 1960 (1960年6月10日, 時の記念日); 20 m"),
  },
  {
    id: "s-loc-2", tier: "stable-lookup", category: "general", lang: "de",
    request: "In welchem Jahr ging das Deutsche Spielkartenmuseum in Leinfelden-Echterdingen an das Land Baden-Württemberg und die Stadt über, und wann wurde es unter diesem Namen in Leinfelden eröffnet?",
    facts: [
      { q: "In which year was the German Playing Card Museum transferred (sold) to the State of Baden-Württemberg and the city of Leinfelden-Echterdingen?", pattern: /\b1982\b/i },
      { q: "In which year was the Deutsches Spielkartenmuseum opened in Leinfelden (at today's Schönbuchschule site)?", pattern: /\b1974\b/i },
    ],
    verified: checkedOn("2026-10-25", "https://de.wikipedia.org/wiki/Deutsches_Spielkartenmuseum", "https://www.museum.de/de/museen/deutsches-spielkarten-museum", "https://www.leinfelden-echterdingen.de/site/Leinfelden-Echterdingen-Internet/get/params_E1468261240/11388732/Chronik%20Leinfelden%20bis%201974.pdf (city chronicle, 1974: \"Eröffnung des Spielkartenmuseums in der Grundschule Süd\")", "museum 40-year programme: transfer to the state and the city on 18 August 1982", "blind check 2026-10-25 (medium): 1982 (sold by ASS on 18 August 1982 to the State of Baden-Württemberg and the city; became a branch of the Württembergisches Landesmuseum); 1974"),
  },
  {
    id: "s-loc-3", tier: "stable-lookup", category: "general", lang: "fr",
    request: "Quelle est la hauteur du phare de Cordouan et combien de marches faut-il gravir pour atteindre le sommet ouvert au public ?",
    facts: [
      { q: "How tall is the Cordouan lighthouse, in metres?", pattern: /\b67[.,]50?(?!\d)/i },
      { q: "How many steps must visitors climb to reach the top open to the public?", pattern: /\b301\b/i },
    ],
    verified: checkedOn("2026-10-25", "https://www.phare-de-cordouan.fr/decouvrir/visite-virtuelle/", "https://www.phare-de-cordouan.fr/accessibilite/", "blind check 2026-10-25 (high): 67.5 m (67,50 m); 301 steps"),
  },
  {
    id: "s-loc-4", tier: "stable-lookup", category: "general", lang: "es",
    request: "¿En qué fecha se inauguró el Museo del Ferrocarril de Asturias en Gijón y en qué antigua estación está instalado?",
    facts: [
      { q: "On what date was the Asturias Railway Museum in Gijón officially inaugurated?", pattern: /\b22\b.*(octubre|october|\boct\b|\/10\/|-10-|\.10\.).*1998|(october|octubre)\s*22.*1998|1998-10-22/i },
      { q: "Which former railway station building houses the museum?", pattern: /estaci[oó]n\s+(de(l)?\s+)?norte|north(ern)?\s+station/i },
    ],
    verified: checkedOn("2026-10-25", "https://directoriomuseos.mcu.es/dirmuseos/generaPDF.do?id=1091&tipoPDF=fichaDetalle", "https://www.lne.es/gijon/2023/09/17/cuarto-siglo-futuro-tren-92191408.html", "blind check 2026-10-25 (high): 22 October 1998 (inaugurated by Felipe, then Prince of Asturias; opened to the public the next day); The former Estación del Norte (Gijón's old Norte railway station)"),
  },
  {
    id: "s-loc-5", tier: "stable-lookup", category: "general", lang: "it",
    request: "Quando è stato inaugurato il Museo del Violino di Cremona e chi ha curato il progetto acustico dell'Auditorium Giovanni Arvedi?",
    facts: [
      { q: "On what date was the Museo del Violino in Cremona inaugurated?", pattern: /\b14\b.*(settembre|september|\bsept?\b|\/0?9\/|-09-|\.0?9\.).*2013|september\s*14.*2013|2013-09-14/i },
      { q: "Who was responsible for the acoustic design of the Auditorium Giovanni Arvedi?", pattern: /\btoyota\b|\bnagata\b/i },
    ],
    verified: checkedOn("2026-10-25", "https://www.cremonaoggi.it/2013/09/14/aperto-lo-scrigno-della-liuteria-via-ufficiale-al-museo-violino/", "https://museodelviolino.org/it/auditorium/", "blind check 2026-10-25 (high): 14 September 2013; Yasuhisa Toyota of Nagata Acoustics"),
  },
  {
    id: "s-loc-6", tier: "stable-lookup", category: "general", lang: "pt",
    request: "Em que data foi inaugurado o Ascensor da Bica, em Lisboa, e em que ano passou a ser propriedade da Carris?",
    facts: [
      { q: "On what date was the Bica funicular (Ascensor da Bica) inaugurated?", pattern: /\b28\b.*(junho|june|\bjun\b|\/0?6\/|-06-|\.0?6\.).*1892|june\s*28.*1892|1892-06-28/i },
      { q: "In which year did the Bica funicular become property of Carris?", pattern: /\b1926\b/i },
    ],
    verified: checkedOn("2026-10-25", "https://www.carris.pt/a-carris/historia/", "https://carris.pt/descubra/frota/funciulares/", "blind check 2026-10-25 (high): 28 June 1892; 1926 (Carris acquired the Nova Companhia dos Ascensores Mecânicos de Lisboa's assets when that company was dissolved)"),
  },
  {
    id: "s-loc-7", tier: "stable-lookup", category: "general",
    request: "How much does the official Fairphone 5 replacement battery weigh, and what is its capacity?",
    facts: [
      { q: "What is the weight of the Fairphone 5 spare battery?", pattern: /\b63[.,]7(?!\d)/i },
      { q: "What is the battery's capacity?", pattern: /\b4[,. ]?200\s*mah\b|\b4[,. ]?200\b|\b16[.,]25\s*wh\b/i },
    ],
    verified: checkedOn("2026-10-25", "https://www.fairphone.com/shop/fairphone-5-battery-259", "https://support.fairphone.com/hc/en-us/articles/10380972881681-Maximize-your-battery-life", "blind check 2026-10-25 (high): 63.7 g; 4200 mAh (16.25 Wh)"),
  },

  // ---------------- search · recent ----------------
  {
    id: "s-new-1", tier: "stable-lookup", category: "news",
    request: "Who won the men's singles final at the 2026 US Open tennis championships, and who did he beat in the final?",
    facts: [
      { q: "Who won the 2026 US Open men's singles title?", pattern: /zverev/i },
      { q: "Who was the runner-up (the losing finalist) in the 2026 US Open men's singles final?", pattern: /shelton/i },
    ],
    verified: checkedOn("2026-10-25", "https://www.usopen.org/en_US/news/articles/2026-09-13/alexander_zverev_defeats_ben_shelton_to_win_2026_us_open.html", "https://www.atptour.com/en/news/us-open-2026-results", "blind check 2026-10-25 (high): Alexander Zverev; Ben Shelton (final score 6-3, 7-6(2), 5-7, 6-2 on 13 Sep 2026)"),
  },
  {
    id: "s-new-2", tier: "stable-lookup", category: "news",
    request: "Who received the 2026 Nobel Prize in Chemistry, and what was it awarded for?",
    facts: [
      { q: "Name the laureate(s) of the 2026 Nobel Prize in Chemistry.", pattern: /^(?=[\s\S]*kagan)(?=[\s\S]*soai)/i },
      { q: "What was the prize awarded for?", pattern: /asymmetric.*autocataly|autocataly.*asymmetric/i },
    ],
    verified: checkedOn("2026-10-25", "https://www.nobelprize.org/prizes/chemistry/2026/press-release/", "https://www.kva.se/nyheter/nobelpriset-i-kemi-2026/", "blind check 2026-10-25 (high): Henri B. Kagan and Kenso Soai (jointly, 'for the discovery of non-linear effects and autocatalysis in asymmetric organic synthesis')"),
  },
  {
    id: "s-new-3", tier: "stable-lookup", category: "news",
    request: "What are the official US starting prices of the iPhone 18 Pro and iPhone 18 Pro Max that Apple announced in September 2026?",
    facts: [
      { q: "What is the US starting price of the iPhone 18 Pro?", pattern: /(?<![\d,])1,?199(?![\d])/i },
      { q: "What is the US starting price of the iPhone 18 Pro Max?", pattern: /(?<![\d,])1,?299(?![\d])/i },
    ],
    verified: checkedOn("2026-10-25", "https://www.apple.com/newsroom/2026/09/apple-debuts-iphone-18-pro-and-iphone-18-pro-max/", "https://www.macrumors.com/2026/09/09/iphone-18-pro-pricing/", "blind check 2026-10-25 (high): $1,199 (256GB); $1,299 (256GB)"),
  },
  {
    id: "s-new-4", tier: "stable-lookup", category: "news",
    request: "Who won the 2026 Mercury Prize, and for which album?",
    facts: [
      { q: "Which artist won the 2026 Mercury Prize?", pattern: /\braye\b/i },
      { q: "What is the title of the album that won the 2026 Mercury Prize?", pattern: /this music may contain hope/i },
    ],
    verified: checkedOn("2026-10-25", "https://www.mercuryprize.com/news/2026/raye-announced-as-overall-winner-of-the-2026-mercury-prize-album-of-the-year/", "https://www.theguardian.com/music/2026/oct/22/raye-wins-2026-mercury-prize-for-this-music-may-contain-hope", "blind check 2026-10-25 (high): RAYE; THIS MUSIC MAY CONTAIN HOPE."),
  },
  {
    id: "s-new-5", tier: "stable-lookup", category: "news",
    request: "In the final results of Sweden's September 2026 Riksdag election, how many seats did the Sweden Democrats and the Social Democrats each win?",
    facts: [
      { q: "How many Riksdag seats did the Sweden Democrats (SD) win in the 2026 Swedish general election?", pattern: /\b62\b/i },
      { q: "How many Riksdag seats did the Social Democrats (S) win in the 2026 Swedish general election?", pattern: /\b99\b/i },
    ],
    verified: checkedOn("2026-10-25", "https://www.riksdagen.se/sv/aktuellt/aktuelltnotiser/2026/sep/19/den-nya-riksdagen-efter-valet_cmsad780a37-f1ae-4d47-a4a7-b6ea2a69a21esv/", "https://www.val.se/download/18.7faaad3f1a0b0c300e4282/1789822515986/beslutsprotokoll-resultat-riksdagen-2026.pdf", "blind check 2026-10-25 (high): 62; 99"),
  },
  {
    id: "s-new-6", tier: "stable-lookup", category: "news",
    request: "Who were awarded the 2026 Sveriges Riksbank Prize in Economic Sciences (the economics Nobel)?",
    facts: [
      { q: "Name the laureate(s) of the 2026 Prize in Economic Sciences in Memory of Alfred Nobel.", pattern: /^(?=[\s\S]*\bhall\b)(?=[\s\S]*woodford)/i },
    ],
    verified: checkedOn("2026-10-25", "https://www.nobelprize.org/prizes/economic-sciences/2026/press-release/", "https://www.riksbank.se/en-gb/press-and-published/notices-and-press-releases/notices/2026/they-are-awarded-the-prize-in-economic-sciences-2026/", "blind check 2026-10-25 (high): Robert E. Hall and Michael Woodford (jointly, 'for microeconomic foundations of macroeconomic stabilisation')"),
  },

  // ---------------- live-feed: true answer captured from an official source ----------------
  {
    id: "f-yt", tier: "live-feed", category: "media", site: "youtube.com", freshDays: 14,
    request: "What is MrBeast's latest YouTube video?",
    reference: { kind: "latest", source: { type: "rss", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCX6OQ3DkcsbYNE6H8uQQuVA" } },
    verified: checked("channel RSS returns <name>MrBeast</name>, probed 2026-10-22", "live-task review 2026-10-22: contract checked against run 2026-10-22T11-29 data by an independent agent; fixes applied"),
  },
  {
    id: "f-rd1", tier: "live-feed", category: "social", site: "reddit.com", freshDays: 2,
    request: "What are the top posts on r/technology today?",
    reference: { kind: "overlap", pool: 50, source: { type: "rss", url: "https://www.reddit.com/r/technology/top/.rss?t=day&limit=25", also: ["https://www.reddit.com/r/technology/.rss?limit=25"] } },
    verified: checked("RSS probed 2026-10-22 (JSON API returns 403 to servers)", "live-task review 2026-10-22: contract checked against run 2026-10-22T11-29 data by an independent agent; fixes applied"),
  },
  {
    id: "f-rd2", tier: "live-feed", category: "social", site: "reddit.com", freshDays: 7,
    request: "What are the top posts on r/LocalLLaMA this week?",
    reference: { kind: "overlap", pool: 50, source: { type: "rss", url: "https://www.reddit.com/r/LocalLLaMA/top/.rss?t=week&limit=25", also: ["https://www.reddit.com/r/LocalLLaMA/.rss?limit=25"] } },
    verified: checked("RSS probed 2026-10-22", "live-task review 2026-10-22: contract checked against run 2026-10-22T11-29 data by an independent agent; fixes applied"),
  },
  {
    id: "f-hn", tier: "live-feed", category: "news", site: "news.ycombinator.com", freshDays: 1,
    request: "What are the top stories on Hacker News right now?",
    reference: { kind: "overlap", pool: 30, source: { type: "hn" } },
    verified: checked("HN Firebase API probed 2026-10-22", "live-task review 2026-10-22: contract checked against run 2026-10-22T11-29 data by an independent agent; fixes applied"),
  },
  {
    id: "f-ts", tier: "live-feed", category: "reference", site: "github.com", freshDays: 60,
    request: "What is the latest release of microsoft/TypeScript on GitHub?",
    reference: { kind: "latest", source: { type: "github-releases", repo: "microsoft/TypeScript" } },
    verified: checked("GitHub releases API probed 2026-10-22", "live-task review 2026-10-22: contract checked against run 2026-10-22T11-29 data by an independent agent; fixes applied"),
  },
  {
    id: "f-node", tier: "live-feed", category: "reference", freshDays: 60,
    request: "What is the latest Node.js LTS version?",
    reference: { kind: "latest", source: { type: "node-lts" } },
    verified: checked("https://nodejs.org/dist/index.json probed 2026-10-22", "live-task review 2026-10-22: contract checked against run 2026-10-22T11-29 data by an independent agent; fixes applied"),
  },
  {
    id: "f-nyt", tier: "live-feed", category: "news", site: "nytimes.com", freshDays: 1,
    request: "What are the top headlines on nytimes.com right now?",
    reference: { kind: "overlap", pool: 100, source: { type: "rss", url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml" } },
    verified: checked("NYT HomePage RSS probed 2026-10-22", "live-task review 2026-10-22: contract checked against run 2026-10-22T11-29 data by an independent agent; fixes applied"),
  },
  {
    id: "f-bbc", tier: "live-feed", category: "news", site: "bbc.com", freshDays: 1,
    request: "What are the top stories on BBC News right now?",
    reference: { kind: "overlap", pool: 100, source: { type: "rss", url: "https://feeds.bbci.co.uk/news/rss.xml", also: ["https://feeds.bbci.co.uk/news/world/rss.xml"] } },
    verified: checked("BBC News RSS probed 2026-10-22", "live-task review 2026-10-22: contract checked against run 2026-10-22T11-29 data by an independent agent; fixes applied"),
  },
  {
    id: "f-fr", tier: "live-feed", category: "news", site: "lemonde.fr", lang: "fr", freshDays: 1,
    request: "Quels sont les titres à la une du Monde ?",
    reference: { kind: "overlap", pool: 100, source: { type: "rss", url: "https://www.lemonde.fr/rss/une.xml", also: ["https://www.lemonde.fr/rss/en_continu.xml"] } },
    verified: checked("Le Monde une.xml probed 2026-10-22", "live-task review 2026-10-22: contract checked against run 2026-10-22T11-29 data by an independent agent; fixes applied"),
  },
  {
    id: "f-de", tier: "live-feed", category: "news", site: "spiegel.de", lang: "de", freshDays: 1,
    request: "Was sind die Top-Schlagzeilen auf Spiegel Online?",
    reference: { kind: "overlap", pool: 100, source: { type: "rss", url: "https://www.spiegel.de/index.rss", also: ["https://www.spiegel.de/schlagzeilen/tops/index.rss", "https://www.spiegel.de/schlagzeilen/index.rss"] } },
    verified: checked("Spiegel schlagzeilen RSS probed 2026-10-22", "live-task review 2026-10-22: contract checked against run 2026-10-22T11-29 data by an independent agent; fixes applied"),
  },
  {
    id: "f-wiki", tier: "live-feed", category: "reference", site: "wikipedia.org", freshDays: 1,
    request: "What is today's featured article on English Wikipedia?",
    reference: { kind: "latest", source: { type: "wikipedia-featured" } },
    verified: checked("Wikipedia REST featured feed probed 2026-10-22", "live-task review 2026-10-22: contract checked against run 2026-10-22T11-29 data by an independent agent; fixes applied"),
  },
  {
    id: "f-spx", tier: "live-feed", category: "general", freshDays: 4,
    request: "What was the S&P 500's closing level on the last trading day?",
    reference: { kind: "numeric", tolerance: 0.0002, source: { type: "fred", series: "SP500" } },
    verified: checked("FRED SP500 series probed 2026-10-22 (last close 2026-10-21: 7757.17)", "live-task review 2026-10-22: contract checked against run 2026-10-22T11-29 data by an independent agent; fixes applied"),
  },

  // ---------------- live-feed on hard sites: the site walls bots, a free official API gives the truth ----------------
  {
    id: "a-nba", tier: "live-feed", category: "media", site: "espn.com", freshDays: 2,
    request: "What were last night's NBA scores?",
    // Was a judged task (j-espn, then f-espn); ESPN's public scoreboard API gives the true finals.
    reference: { kind: "scores", minGames: 2, source: { type: "espn-scoreboard", sport: "basketball", league: "nba" } },
    verified: checkedOn("2026-10-25", "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard", "reference = final scores of the most recent US game day before the round (America/New_York)"),
  },
  {
    id: "a-npm", tier: "live-feed", category: "reference", site: "npmjs.com",
    request: "What is the latest version of React on npmjs.com?",
    reference: { kind: "latest", source: { type: "npm-latest", pkg: "react" } },
    verified: checkedOn("2026-10-26", "feed values cross-checked against the live API and graded answers of run 2026-10-26T16-07", "https://registry.npmjs.org/react (dist-tags.latest = 19.3.1 on 2026-10-25)", "npmjs.com answers a plain fetch with a Cloudflare 403"),
  },
  {
    id: "a-cmc", tier: "live-feed", category: "general", site: "coinmarketcap.com",
    request: "What is the price of Bitcoin on CoinMarketCap right now?",
    reference: { kind: "numeric", tolerance: 0.01, source: { type: "crypto-spot", coin: "bitcoin" } },
    verified: checkedOn("2026-10-26", "feed values cross-checked against the live API and graded answers of run 2026-10-26T16-07", "https://api.coinbase.com/v2/prices/BTC-USD/spot", "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd", "reference = mean of both spots in the same minute; ±1% covers page lag"),
  },
  {
    id: "a-bsky", tier: "live-feed", category: "social", site: "bsky.app",
    request: "What has The New York Times posted on Bluesky today?",
    reference: { kind: "overlap", pool: 50, source: { type: "bluesky-feed", actor: "nytimes.com" } },
    verified: checkedOn("2026-10-26", "feed values cross-checked against the live API and graded answers of run 2026-10-26T16-07", "https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=nytimes.com", "bsky.app renders posts with JavaScript only"),
  },
  {
    id: "a-epl", tier: "live-feed", category: "media", site: "espn.com",
    request: "Who are the top 5 teams in the Premier League table on ESPN?",
    reference: { kind: "overlap", pool: 5, source: { type: "espn-standings", league: "eng.1" } },
    verified: checkedOn("2026-10-26", "feed values cross-checked against the live API and graded answers of run 2026-10-26T16-07", "https://site.api.espn.com/apis/v2/sports/soccer/eng.1/standings", "reference = the top 5 by table rank; espn.com answers bots with an empty 202"),
  },
  {
    id: "a-nfl", tier: "live-feed", category: "media", site: "nfl.com",
    request: "What were the scores of the most recent NFL games on NFL.com?",
    reference: { kind: "scores", minGames: 2, source: { type: "espn-scoreboard", sport: "football", league: "nfl" } },
    verified: checkedOn("2026-10-26", "feed values cross-checked against the live API and graded answers of run 2026-10-26T16-07", "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard", "reference = finals of the most recent US game day before the round; a one-game day needs that one game"),
  },
  {
    id: "a-yhoo", tier: "live-feed", category: "general", site: "finance.yahoo.com",
    request: "What is Apple's stock price on Yahoo Finance?",
    reference: { kind: "numeric", tolerance: 0.005, source: { type: "yahoo-quote", symbol: "AAPL" } },
    verified: checkedOn("2026-10-26", "feed values cross-checked against the live API and graded answers of run 2026-10-26T16-07", "https://query1.finance.yahoo.com/v8/finance/chart/AAPL", "reference = the quote the page itself shows (last trade, or the last close when the market is shut); previous close earns half"),
  },
  {
    id: "a-steam", tier: "live-feed", category: "ecommerce", site: "store.steampowered.com",
    request: "What does Elden Ring cost on Steam, in US dollars?",
    reference: { kind: "numeric", tolerance: 0.01, source: { type: "steam-price", appId: 1245620 } },
    verified: checkedOn("2026-10-26", "feed values cross-checked against the live API and graded answers of run 2026-10-26T16-07", "https://store.steampowered.com/api/appdetails?appids=1245620&cc=us", "reference = the current US price; the pre-sale price earns half during a discount; the store page sits behind an age gate"),
  },
  {
    id: "a-app", tier: "live-feed", category: "reference", site: "apps.apple.com",
    request: "What is the current version of the ChatGPT app on the App Store?",
    reference: { kind: "latest", source: { type: "itunes-version", appId: 6448311069 } },
    verified: checkedOn("2026-10-26", "feed values cross-checked against the live API and graded answers of run 2026-10-26T16-07", "https://itunes.apple.com/lookup?id=6448311069&country=us (1.2026.286 on 2026-10-25)"),
  },

  // ---------------- live-feed on the open web ----------------
  {
    id: "f-f1", tier: "live-feed", category: "media",
    request: "Who won the most recent Formula 1 Grand Prix?",
    reference: { kind: "latest", source: { type: "f1-last-winner" } },
    verified: checkedOn("2026-10-26", "feed values cross-checked against the live API and graded answers of run 2026-10-26T16-07", "https://api.jolpi.ca/ergast/f1/current/last/results.json (United States GP 2026-10-25: Andrea Kimi Antonelli)", "the winner's surname alone also counts"),
  },
  {
    id: "f-fx", tier: "live-feed", category: "general",
    request: "What is today's euro to US dollar exchange rate?",
    reference: { kind: "numeric", tolerance: 0.005, source: { type: "ecb-rate", from: "EUR", to: "USD" } },
    verified: checkedOn("2026-10-26", "feed values cross-checked against the live API and graded answers of run 2026-10-26T16-07", "https://api.frankfurter.dev/v1/latest?from=EUR&to=USD (ECB reference rate)", "±0.5% covers market quotes between ECB fixings"),
  },
  {
    id: "f-pypi", tier: "live-feed", category: "reference",
    request: "What is the latest version of the Python requests library?",
    reference: { kind: "latest", source: { type: "pypi-latest", pkg: "requests" } },
    verified: checkedOn("2026-10-26", "feed values cross-checked against the live API and graded answers of run 2026-10-26T16-07", "https://pypi.org/pypi/requests/json (2.34.2 on 2026-10-25)"),
  },
];

// The requests name a platform, not a country storefront: an eBay UK listing
// is "on eBay". Tasks that need one market say so in a constraint.
const SITE_ALIASES: Record<string, string[]> = {
  "x.com": ["twitter.com"],
  "youtube.com": ["youtu.be"],
  "bbc.com": ["bbc.co.uk", "bbci.co.uk"],
  "ebay.com": ["ebay.co.uk", "ebay.de", "ebay.ca", "ebay.com.au", "ebay.fr", "ebay.it"],
  "amazon.com": ["amazon.co.uk", "amazon.ca", "amazon.de"],
};

export const siteHosts = (site: string) => [site, ...(SITE_ALIASES[site] ?? [])];

export function hostMatches(url: string, site: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return siteHosts(site).some(
      (s) => host === s || host.endsWith(`.${s}`),
    );
  } catch {
    return false;
  }
}

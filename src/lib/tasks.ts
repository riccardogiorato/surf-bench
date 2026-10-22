// SurfBench v2 task set: 50 hand-curated tasks, one event.
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
  | { kind: "numeric"; source: FeedSource; tolerance: number };

export type FeedSource =
  | { type: "rss"; url: string; also?: string[] } // also: extra listings unioned into the pool
  | { type: "hn" }
  | { type: "github-releases"; repo: string }
  | { type: "node-lts" }
  | { type: "wikipedia-featured" }
  | { type: "fred"; series: string };

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

// Repeats per release. Stable tasks are deterministic enough to run once;
// live tasks are averaged over rounds so one flaky request can't flip a cell.
export const LIVE_ROUNDS = 3;
export const isLive = (t: Task) => t.tier === "live-feed" || t.tier === "live-judge";

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

  // ---------------- live-judge: no feed exists; explicit yes/no constraints ----------------
  {
    id: "j-x1", tier: "live-judge", category: "social", site: "x.com", freshDays: 14,
    request: "Show me MrBeast's 5 most recent posts on X.",
    constraints: ["At least 3 distinct posts by @MrBeast are shown with their text"],
    verified: checked("live-task review 2026-10-22: contract checked against run 2026-10-22T11-29 data by an independent agent; fixes applied"),
  },
  {
    id: "j-x2", tier: "live-judge", category: "social", site: "x.com", freshDays: 7,
    request: "What did NASA post on X this week?",
    constraints: ["At least 1 post by @NASA is shown with its text"],
    verified: checked("live-task review 2026-10-22: contract checked against run 2026-10-22T11-29 data by an independent agent; fixes applied"),
  },
  {
    id: "j-ig", tier: "live-judge", category: "social", site: "instagram.com", freshDays: 14,
    request: "What are National Geographic's latest Instagram posts?",
    constraints: ["At least 2 posts by @natgeo are shown with their captions"],
    verified: checked("live-task review 2026-10-22: contract checked against run 2026-10-22T11-29 data by an independent agent; fixes applied"),
  },
  {
    id: "j-fb", tier: "live-judge", category: "social", site: "facebook.com", freshDays: 14,
    request: "What has NASA posted on Facebook recently?",
    constraints: ["At least 1 post by NASA's main Facebook page (facebook.com/NASA) is shown with its text; NASA center or mission pages do not count"],
    verified: checked("live-task review 2026-10-22: contract checked against run 2026-10-22T11-29 data by an independent agent; fixes applied"),
  },
  {
    id: "j-tt", tier: "live-judge", category: "social", site: "tiktok.com", freshDays: 30,
    request: "What are NASA's most recent TikTok videos?",
    constraints: ["At least 2 videos by @nasa are listed with titles or captions"],
    verified: checked("live-task review 2026-10-22: contract checked against run 2026-10-22T11-29 data by an independent agent; fixes applied"),
  },
  {
    id: "j-li", tier: "live-judge", category: "social", site: "linkedin.com", freshDays: 30,
    request: "Find open software engineer roles at Stripe on LinkedIn.",
    constraints: ["A LinkedIn job listing (linkedin.com/jobs/...) for a software engineering role at Stripe is shown; feed posts about hiring do not count", "The listing is not marked as no longer accepting applications"],
    verified: checked("live-task review 2026-10-22: contract checked against run 2026-10-22T11-29 data by an independent agent; fixes applied"),
  },
  {
    id: "j-amz1", tier: "live-judge", category: "ecommerce", site: "amazon.com",
    request: "What is the current price of the Kindle Paperwhite on Amazon?",
    constraints: ["The product shown is a Kindle Paperwhite (not another Kindle model)", "A specific price in USD is shown for it", "The listing looks currently purchasable (in stock, add to cart, pre-order or similar), not discontinued or unavailable"],
    verified: checked("live-task review 2026-10-22: contract checked against run 2026-10-22T11-29 data by an independent agent; fixes applied"),
  },
  {
    id: "j-amz2", tier: "live-judge", category: "ecommerce", site: "amazon.com",
    request: "Find a USB-C charger on Amazon under $30.",
    constraints: ["One specific product is identified with its own details and price (an item page, or a single named item with its price on a results page)", "The product is a USB-C wall charger (a power adapter, not just a cable)", "Its price is under $30", "The listing looks currently purchasable (in stock, add to cart, pre-order or similar), not discontinued or unavailable"],
    verified: checked("live-task review 2026-10-22: contract checked against run 2026-10-22T11-29 data by an independent agent; fixes applied"),
  },
  {
    id: "j-ebay", tier: "live-judge", category: "ecommerce", site: "ebay.com",
    request: "Find a used Nintendo Switch OLED listed on eBay right now.",
    constraints: ["A specific active eBay listing is shown", "The item is a Nintendo Switch OLED", "The item is used or pre-owned", "A price is shown"],
    verified: checked("live-task review 2026-10-22: contract checked against run 2026-10-22T11-29 data by an independent agent; fixes applied"),
  },
  {
    id: "j-wmt", tier: "live-judge", category: "ecommerce", site: "walmart.com",
    request: "What does Walmart charge for AirPods Pro 2?",
    constraints: ["The product shown is new Apple AirPods Pro 2 (not pre-owned, refurbished, restored or open-box)", "A specific Walmart price for that new product is shown", "The listing looks currently purchasable (in stock, add to cart, pre-order or similar), not discontinued or unavailable"],
    verified: checked("live-task review 2026-10-22: contract checked against run 2026-10-22T11-29 data by an independent agent; fixes applied"),
  },
  {
    id: "j-bby", tier: "live-judge", category: "ecommerce", site: "bestbuy.com",
    request: "Is the 13-inch MacBook Air M5 in stock at Best Buy, and what does it cost?",
    constraints: ["The product shown is a 13-inch MacBook Air with M5 chip", "A specific Best Buy price is shown", "Availability or stock status is stated"],
    verified: checked("live-task review 2026-10-22: contract checked against run 2026-10-22T11-29 data by an independent agent; fixes applied"),
  },
  {
    id: "j-zil", tier: "live-judge", category: "realestate", site: "zillow.com",
    request: "Find a 2-bedroom home for sale in Austin, TX under $500k on Zillow.",
    constraints: ["One specific property listing is identified with its own details and price (an item page, or a single named item with its price on a results page)", "It is in Austin, TX", "It has 2 bedrooms", "It is listed for sale (active, not sold, pending or a rental) at under $500,000"],
    verified: checked("live-task review 2026-10-22: contract checked against run 2026-10-22T11-29 data by an independent agent; fixes applied"),
  },
  {
    id: "j-cl", tier: "live-judge", category: "realestate", site: "craigslist.org", freshDays: 30,
    request: "Find a 1-bedroom apartment for rent in Brooklyn on Craigslist.",
    constraints: ["One specific rental listing is identified with its own details and rent", "It is in Brooklyn", "It has 1 bedroom"],
    verified: checked("live-task review 2026-10-22: contract checked against run 2026-10-22T11-29 data by an independent agent; fixes applied"),
  },
  {
    id: "j-abnb", tier: "live-judge", category: "realestate", site: "airbnb.com",
    request: "Find an Airbnb in Lisbon for 2 guests under $120 a night.",
    constraints: ["One specific Airbnb listing is identified with its own details", "It is in Lisbon", "It fits at least 2 guests", "A nightly price under $120 is shown"],
    verified: checked("live-task review 2026-10-22: contract checked against run 2026-10-22T11-29 data by an independent agent; fixes applied"),
  },
  {
    id: "j-espn", tier: "live-judge", category: "media", site: "espn.com", freshDays: 2,
    request: "What were last night's NBA scores?",
    constraints: ["Final scores are shown for at least 2 NBA games from the most recent game day before the run date"],
    verified: checked("live-task review 2026-10-22: contract checked against run 2026-10-22T11-29 data by an independent agent; fixes applied"),
  },
  {
    id: "j-ml", tier: "live-judge", category: "ecommerce", site: "mercadolibre.com.mx", lang: "es",
    request: "¿Cuánto cuesta el iPhone 16 en Mercado Libre México?",
    constraints: ["One specific base iPhone 16 (not 16 Plus, 16 Pro, 16e or iPhone 15) is identified with its own price", "A price in MXN is shown", "The listing looks currently purchasable (in stock, add to cart, pre-order or similar), not discontinued or unavailable"],
    verified: checked("live-task review 2026-10-22: contract checked against run 2026-10-22T11-29 data by an independent agent; fixes applied"),
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

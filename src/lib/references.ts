import type { FeedSource, Task } from "./tasks.js";

// Ground truth for live-feed tasks, captured from an official feed or API in
// the same round the providers run. Captures are stored with the run so a
// snapshot can be re-graded later without re-fetching anything.

export interface ReferenceCapture {
  taskId: string;
  capturedAt: string;
  items: string[]; // newest/top first
  alts?: string[][]; // per item: other texts that identify it (feed summary line)
  accept?: string[]; // "latest" refs: other answers that are also current
  values?: number[]; // numeric references, newest first
  games?: GameResult[]; // "scores" refs: every final of the game day
  note?: string;
  error?: string;
}

export interface GameResult {
  day: string; // YYYY-MM-DD, US Eastern
  teams: [string[], string[]]; // each team's names: full, short, abbreviation
  scores: [number, number];
}

const easternDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(d);

const UA = "Mozilla/5.0 (compatible; SurfBench/2.0; +https://github.com/riccardogiorato/surf-bench)";

async function get(url: string): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    // GitHub allows 60 anonymous API calls/hour per IP; a token lifts that.
    const auth: Record<string, string> = url.startsWith("https://api.github.com/") && process.env.GITHUB_TOKEN
      ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
      : {};
    const res = await fetch(url, {
      headers: { "User-Agent": UA, ...auth },
      signal: AbortSignal.timeout(20000),
    });
    // Reddit rate-limits back-to-back feed requests from one IP.
    if (res.status === 429 && attempt < 4) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const waitMs = retryAfter > 0 ? retryAfter * 1000 : [10, 30, 60, 90][attempt] * 1000;
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    return res.text();
  }
}

// microsoft/TypeScript also publishes editor-extension releases
// ("vscode-typescript/v1.0.1"); only compiler versions answer the task.
const COMPILER_TAG = /^v?\d+\.\d+(\.\d+)?$/;

// Applied at capture AND at grading, so references stored before a filter
// existed are graded by the same rule.
export function normalizeReference(task: Task, ref: ReferenceCapture): ReferenceCapture {
  if (task.reference?.source.type === "github-releases") {
    return { ...ref, items: ref.items.filter((t) => COMPILER_TAG.test(t)) };
  }
  return ref;
}

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

interface FeedEntry {
  title: string;
  link: string;
  summary: string;
}

// RSS <item> and Atom <entry>; the channel/feed title is skipped.
function feedEntries(xml: string): FeedEntry[] {
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/g) ?? [];
  return blocks
    .map((b) => ({
      title: decodeEntities(b.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] ?? ""),
      link: decodeEntities(b.match(/<link[^>]*>([\s\S]*?)<\/link>/)?.[1] ?? b.match(/<link[^>]*href="([^"]+)"/)?.[1] ?? ""),
      summary: decodeEntities(b.match(/<description[^>]*>([\s\S]*?)<\/description>/)?.[1] ?? "").replace(/<[^>]+>/g, " ").trim(),
    }))
    .filter((e) => e.title);
}

async function capture(source: FeedSource, pool: number, at: Date): Promise<Omit<ReferenceCapture, "taskId" | "capturedAt">> {
  switch (source.type) {
    case "espn-scoreboard": {
      // "Last night" = the most recent US game day before the round's own day.
      for (let back = 1; back <= 10; back++) {
        const day = easternDay(new Date(at.getTime() - back * 86400000));
        const data = JSON.parse(await get(`https://site.api.espn.com/apis/site/v2/sports/basketball/${source.league}/scoreboard?dates=${day.replace(/-/g, "")}`));
        const games: GameResult[] = (data.events ?? [])
          .map((e: any) => e.competitions?.[0])
          .filter((c: any) => c?.status?.type?.completed)
          .map((c: any) => {
            const [a, b] = c.competitors;
            const names = (t: any) => [t.team.displayName, t.team.shortDisplayName, t.team.abbreviation].filter(Boolean);
            return { day, teams: [names(a), names(b)], scores: [Number(a.score), Number(b.score)] };
          });
        if (games.length) return { items: games.map((g) => `${g.teams[0][0]} ${g.scores[0]}, ${g.teams[1][0]} ${g.scores[1]} (${day})`), games };
      }
      throw new Error("no completed games in the last 10 days");
    }
    case "rss": {
      // Sequential: Reddit 429s concurrent feed requests.
      const entries: FeedEntry[] = [];
      for (const url of [source.url, ...(source.also ?? [])]) {
        for (const e of await get(url).then(feedEntries)) {
          // A channel's newest Short is not what "latest video" asks for.
          if (e.link.includes("/shorts/")) continue;
          if (!entries.some((x) => x.title === e.title)) entries.push(e);
        }
      }
      const top = entries.slice(0, pool);
      return { items: top.map((e) => e.title), alts: top.map((e) => (e.summary ? [e.summary] : [])) };
    }
    case "hn": {
      const ids: number[] = JSON.parse(await get("https://hacker-news.firebaseio.com/v0/topstories.json"));
      const items = await Promise.all(
        ids.slice(0, pool).map(async (id) =>
          JSON.parse(await get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`))?.title ?? "",
        ),
      );
      return { items: items.filter(Boolean) };
    }
    case "github-releases": {
      const rels: any[] = JSON.parse(await get(`https://api.github.com/repos/${source.repo}/releases?per_page=20`));
      const published = rels.filter((r) => !r.draft && /^v?\d+\.\d+/.test(r.tag_name ?? ""));
      const stable = published.filter((r) => !r.prerelease);
      // A beta or RC published after the newest stable is literally the latest release.
      const newer = published.slice(0, Math.max(0, published.indexOf(stable[0])));
      return { items: stable.map((r) => r.tag_name || r.name), accept: newer.map((r) => r.name || r.tag_name) };
    }
    case "node-lts": {
      const list: any[] = JSON.parse(await get("https://nodejs.org/dist/index.json"));
      const lts = list.filter((r) => r.lts).slice(0, 5);
      // Pages lag a fresh patch by a day or two; the previous one still counts then.
      const ageDays = (Date.now() - Date.parse(lts[0]?.date)) / 86400000;
      return { items: lts.map((r) => r.version), accept: ageDays < 3 && lts[1] ? [lts[1].version] : [] };
    }
    case "wikipedia-featured": {
      const d = new Date();
      const ymd = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}`;
      const data = JSON.parse(await get(`https://en.wikipedia.org/api/rest_v1/feed/featured/${ymd}`));
      const title = data?.tfa?.titles?.normalized ?? data?.tfa?.title;
      if (!title) throw new Error("no featured article in feed");
      return { items: [title] };
    }
    case "fred": {
      const csv = await get(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${source.series}`);
      const rows = csv
        .trim()
        .split("\n")
        .slice(1)
        .map((l) => l.split(","))
        .filter(([, v]) => v && v !== "." && !Number.isNaN(Number(v)));
      const recent = rows.slice(-3).reverse();
      return { items: recent.map(([d, v]) => `${d}: ${v}`), values: recent.map(([, v]) => Number(v)) };
    }
  }
}

// `at` is the round's time; only date-keyed sources (final scores) honour a past one.
export async function captureReference(task: Task, at = new Date()): Promise<ReferenceCapture> {
  const capturedAt = new Date().toISOString();
  const ref = task.reference!;
  try {
    const pool = ref.kind === "overlap" ? ref.pool : 5;
    const out = normalizeReference(task, { taskId: task.id, capturedAt, ...(await capture(ref.source, pool, at)) });
    if (out.items.length === 0) throw new Error("reference feed returned no items");
    return out;
  } catch (e) {
    return { taskId: task.id, capturedAt, items: [], error: e instanceof Error ? e.message : String(e) };
  }
}

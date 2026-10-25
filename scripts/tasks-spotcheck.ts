import { execFileSync } from "child_process";
import fs from "fs/promises";
import path from "path";
import { hostMatches } from "../src/lib/tasks.js";
import { readJsonl, runKey } from "./tasks-grade.js";

// Independent proof that passed X and YouTube fetches carry the real page
// content, not a plausible paraphrase: every post linked from a passed X page
// is pulled from fxtwitter and its text must appear verbatim in what the
// provider returned; every fetched YouTube watch page must contain the title
// YouTube's own oEmbed reports. Writes results/runs/<runId>/spotchecks.json
// (urls, titles and booleans only — never page content).
//
//   bun run scripts/tasks-spotcheck.ts --run <id>

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

// fxtwitter refuses some non-browser clients; curl is accepted. The same
// posts recur across rounds and providers, so each URL is fetched once.
const seen = new Map<string, any>();
function getJson(url: string): any | null {
  if (seen.has(url)) return seen.get(url);
  let out: any = null;
  for (let attempt = 0; attempt < 3 && out === null; attempt++) {
    try {
      out = JSON.parse(execFileSync("curl", ["-sL", "--max-time", "20", url], { encoding: "utf8" }));
    } catch {
      execFileSync("sleep", [String(2 * (attempt + 1))]);
    }
  }
  seen.set(url, out);
  return out;
}

// Markdown links keep only their visible text: "[@NASAAdmin](/NASAAdmin)" would
// otherwise normalise to the handle twice and break the word sequence.
const norm = (s: string) =>
  s.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").toLowerCase().normalize("NFKC").replace(/https?:\/\/\S+/g, " ").replace(/&amp;/g, "&").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

// The first 12 words of a post are enough to prove it is the same text, and
// survive the page truncating long posts with "Show more". A reply's leading
// @handles are in the API text but shown apart from the body on the page.
const snippet = (text: string) => norm(text.replace(/^(@\w+\s+)+/, "")).split(" ").slice(0, 12).join(" ");

const MAX_POSTS_PER_RECORD = 5;

async function main() {
  const latest = JSON.parse(await fs.readFile("results/v2-latest.json", "utf8"));
  const runId = arg("run") ?? latest.runId;
  const records = new Map<string, any>();
  for (const r of await readJsonl("results/raw/tasks.jsonl")) if (r.runId === runId) records.set(runKey(r), r);
  const grades = new Map<string, any>();
  for (const g of await readJsonl("results/raw/tasks-graded.jsonl")) if (g.runId === runId) grades.set(runKey(g), g);

  const out: any[] = [];
  let unreachable = 0;
  for (const r of records.values()) {
    if (!grades.get(runKey(r))?.pass) continue;
    for (const f of r.fetches ?? []) {
      if (!f.chars) continue;
      const content = norm(`${f.title ?? ""} ${f.content}`);

      if (hostMatches(f.url, "youtube.com") && /\/watch\?v=/.test(f.url)) {
        const o = getJson(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(f.url)}`);
        if (!o?.title) continue;
        out.push({ provider: r.provider, task: r.taskId, round: r.round, url: f.url, source: "youtube oembed", title: o.title, match: content.includes(norm(o.title)) });
      }

      if (hostMatches(f.url, "x.com")) {
        const links = [...`${f.url} ${f.content}`.matchAll(/(?:x|twitter)\.com\/(\w+)\/status\/(\d+)/g)];
        const ids = [...new Set(links.map((m) => `${m[1]}/status/${m[2]}`))];
        for (const id of ids.slice(0, MAX_POSTS_PER_RECORD)) {
          const t = getJson(`https://api.fxtwitter.com/${id}`)?.tweet;
          if (!t) {
            unreachable++;
            continue;
          }
          if (!t.text || snippet(t.text).split(" ").length < 4) continue;
          out.push({
            provider: r.provider, task: r.taskId, round: r.round, url: `https://x.com/${id}`, source: "fxtwitter",
            author: t.author?.screen_name, postedAt: t.created_at, match: content.includes(snippet(t.text)),
          });
        }
      }
    }
  }

  const file = path.join("results", "runs", runId, "spotchecks.json");
  await fs.writeFile(file, JSON.stringify(out, null, 2));
  const tally = new Map<string, [number, number]>();
  for (const c of out) {
    const k = `${c.provider} · ${c.source}`;
    const [ok, n] = tally.get(k) ?? [0, 0];
    tally.set(k, [ok + (c.match ? 1 : 0), n + 1]);
  }
  for (const [k, [ok, n]] of [...tally].sort()) console.log(`  ${k}: ${ok}/${n} verified`);
  if (unreachable) console.log(`  ${unreachable} linked posts could not be retrieved from fxtwitter (deleted, private or throttled)`);
  console.log(`wrote ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import fs from "fs/promises";
import path from "path";
import { AGENT_DRAFT, TASKS } from "../src/lib/tasks.js";
import { faviconDataUri, providerLabel as L } from "./favicons.js";

// One-page recap of a run: leaderboard, speed, cost, accuracy and site access.
// Reads only the published run package, never results/raw.

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function readCsv(text: string): Record<string, string>[] {
  const [head, ...rows] = text.trim().split("\n").map((l) => l.split(","));
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Sites agents are most often asked about and that bot-protect hardest.
const FAMOUS = new Set([
  "x.com", "instagram.com", "facebook.com", "tiktok.com", "reddit.com", "linkedin.com", "youtube.com",
  "amazon.com", "ebay.com", "walmart.com", "bestbuy.com", "target.com", "homedepot.com",
  "zillow.com", "airbnb.com", "craigslist.org", "nytimes.com", "espn.com",
]);

async function main() {
  const latest = JSON.parse(await fs.readFile("results/v2-latest.json", "utf8"));
  const runId: string = arg("run") ?? latest.runId;
  const dir = path.join("results", "runs", runId);
  const board = readCsv(await fs.readFile(path.join(dir, "leaderboard.csv"), "utf8"));
  const access = readCsv(await fs.readFile(path.join(dir, "access.csv"), "utf8"));
  const evidence: any[] = JSON.parse(await fs.readFile(path.join(dir, "evidence.json"), "utf8"));
  const providers = board.map((b) => b.provider);

  // Live answers that were right but came from a mirror or aggregator (nitter,
  // redlib, airdna…). They fail the on-site rule; shown so that rule's cost is visible.
  const SITE_CHECK = "The items that satisfy the constraints above are shown on a";
  const viaMirror = (e: any) => {
    if (e.pass || e.error) return false;
    if (e.taskId.startsWith("f-")) return !e.onSite && e.score >= 0.8;
    if (!e.taskId.startsWith("j-") || !e.constraints) return false;
    const site = e.constraints.find((c: any) => c.text.startsWith(SITE_CHECK));
    const rest = e.constraints.filter((c: any) => c !== site);
    return (!e.onSite || (site && site.value < 0.5)) && rest.every((c: any) => c.value >= 0.5);
  };
  const spot: any[] = await fs
    .readFile(path.join(dir, "spotchecks.json"), "utf8")
    .then(JSON.parse)
    .catch(() => []);
  const spotRows = [...new Set(spot.map((c) => `${c.provider}|${c.source}`))].sort().map((k) => {
    const [p, s] = k.split("|");
    const rows = spot.filter((c) => c.provider === p && c.source === s);
    return { p, s, ok: rows.filter((c) => c.match).length, n: rows.length };
  });
  const mirror = Object.fromEntries(providers.map((p) => [p, evidence.filter((e) => e.provider === p && viaMirror(e)).length]));

  const cell = (s: string) => {
    const [p, a] = s.split("/").map(Number);
    return { p, a, r: a ? p / a : 0 };
  };
  const famous = access.filter((s) => FAMOUS.has(s.site));
  const reach = Object.fromEntries(
    providers.map((p) => [p, famous.filter((s) => cell(s[p]).r >= 0.5).length]),
  );
  famous.sort((x, y) => providers.reduce((t, p) => t + cell(x[p]).r, 0) - providers.reduce((t, p) => t + cell(y[p]).r, 0));

  const num = (b: Record<string, string>, k: string) => Number(b[k]);
  const by = (k: string, dirn: 1 | -1) => [...board].sort((a, b) => dirn * (num(a, k) - num(b, k)))[0];
  // The top tie group, not board[0]: a 1-point lead inside overlapping CIs is not a win.
  const tied = board.filter((b) => b.rank_group === "1");
  const bestReach = [...providers].sort((a, b) => reach[b] - reach[a])[0];
  const fastest = by("p50_ms", 1);
  const cheapest = by("usd_per_1k_passed", 1);
  const accurate = by("quality", -1);

  const drafts = TASKS.filter((t) => t.verified.by === AGENT_DRAFT).length;
  const banner = drafts ? `DRAFT: ${drafts}/${TASKS.length} answer keys not yet verified` : "";

  const maxCost = Math.max(...board.map((b) => num(b, "usd_per_1k_passed")));
  const maxMs = Math.max(...board.map((b) => num(b, "p50_ms")));

  const bar = (v: number, max: number, cls = "") =>
    `<div class="bar ${cls}"><span style="width:${Math.max(2, (100 * v) / max).toFixed(1)}%"></span></div>`;
  const heat = (s: string) => {
    const c = cell(s);
    const cls = c.a === 0 ? "na" : c.r >= 0.99 ? "ok" : c.r >= 0.5 ? "mid" : c.r > 0 ? "low" : "no";
    return `<td class="h ${cls}">${c.a ? `${c.p}/${c.a}` : "–"}</td>`;
  };

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SurfBench recap — ${esc(runId)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Silkscreen&family=IBM+Plex+Sans:wght@400;600&display=swap" rel="stylesheet">
<style>
  :root { --bg:#008080; --win:#c0c0c0; --hi:#fff; --lo:#808080; --dk:#000; --title:#000080; --ok:#2e8b57; --mid:#c9a227; --low:#d2691e; --no:#a33; }
  * { box-sizing:border-box }
  body { margin:0; padding:24px; background:var(--bg); font:14px/1.45 "IBM Plex Sans",system-ui,sans-serif; color:#111 }
  .win { background:var(--win); border:2px solid; border-color:var(--hi) var(--dk) var(--dk) var(--hi); box-shadow:inset -1px -1px var(--lo), inset 1px 1px #dfdfdf; max-width:1100px; margin:0 auto 20px }
  .bar-title { background:linear-gradient(90deg,var(--title),#1084d0); color:#fff; padding:4px 8px; font:12px Silkscreen,monospace; letter-spacing:.5px; display:flex; justify-content:space-between }
  .body { padding:14px 18px }
  h1 { font:22px Silkscreen,monospace; margin:0 0 4px }
  h2 { font:15px Silkscreen,monospace; margin:0 0 10px }
  .sub { color:#333; margin:0 0 10px }
  .banner { background:#ffffe1; border:1px solid #000; padding:6px 10px; margin:8px 0 0; font-weight:600 }
  .tldr { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:10px; margin-top:12px }
  .card { background:#fff; border:2px solid; border-color:var(--lo) var(--hi) var(--hi) var(--lo); padding:10px }
  .card b { display:block; font:11px Silkscreen,monospace; color:var(--title); margin-bottom:4px }
  .card .big { font-size:20px; font-weight:600 }
  table { border-collapse:collapse; width:100%; background:#fff; border:2px solid; border-color:var(--lo) var(--hi) var(--hi) var(--lo) }
  th, td { padding:5px 8px; text-align:left; border-bottom:1px solid #ddd; white-space:nowrap }
  th { background:#e4e4e4; font:11px Silkscreen,monospace; position:sticky; top:0 }
  td.n { text-align:right; font-variant-numeric:tabular-nums }
  .bar { width:110px; height:10px; background:#eee; border:1px solid #999; display:inline-block; vertical-align:middle; margin-left:6px }
  .bar span { display:block; height:100%; background:var(--title) }
  .bar.cost span { background:#8b4513 } .bar.speed span { background:#555 }
  .grp { font:11px Silkscreen,monospace; padding:1px 5px; border:1px solid #000; background:#ffffe1 }
  td.h { text-align:center; font-variant-numeric:tabular-nums; color:#fff; font-weight:600 }
  td.ok { background:var(--ok) } td.mid { background:var(--mid) } td.low { background:var(--low) } td.no { background:var(--no) } td.na { background:#bbb }
  .scroll { overflow-x:auto }
  .note { color:#333; font-size:13px; margin:8px 0 0 }
  ul { margin:6px 0 0 18px; padding:0 }
</style></head><body>

<div class="win"><div class="bar-title"><span>SURFBENCH.EXE</span><span>v2 · ${esc(runId)}</span></div><div class="body">
  <h1>SurfBench recap</h1>
  <p class="sub">${TASKS.length} checked tasks · ${providers.length} providers · every provider runs the same pipeline: search top 5 → fetch top 3 → one fixed reader answers from the pages · live tasks × 3 rounds · 95% bootstrap CIs.</p>
  <p class="sub">Audit any number: <a href="inspect.html">inspect.html</a> (every provider × task cell, with search results, fetched pages, the reader's answer and the judges' evidence) · <a href="methodology.html">methodology.html</a> (every prompt, rubric and answer key, verbatim).</p>
  ${banner ? `<div class="banner">${esc(banner)}</div>` : ""}
  <div class="tldr">
    ${tied.length > 1
      ? `<div class="card"><b>Tied for #1</b><div class="big">${tied.map((b) => esc(L(b.provider))).join(" · ")}</div>${tied.map((b) => `${esc(L(b.provider))} ${b.overall} (${b.ci_low}–${b.ci_high})`).join(" · ")}: the 95% CIs overlap, so no single winner</div>`
      : `<div class="card"><b>Best overall</b><div class="big">${esc(L(board[0].provider))}</div>${board[0].overall} pts (${board[0].ci_low}–${board[0].ci_high}) · clear of the field</div>`}
    <div class="card"><b>Most accurate</b><div class="big">${esc(L(accurate.provider))}</div>quality ${accurate.quality} · pass rate ${accurate.pass_rate}%</div>
    <div class="card"><b>Fastest</b><div class="big">${esc(L(fastest.provider))}</div>p50 ${(num(fastest, "p50_ms") / 1000).toFixed(1)}s for search + 3 fetches</div>
    <div class="card"><b>Cheapest per success</b><div class="big">${esc(L(cheapest.provider))}</div>$${cheapest.usd_per_1k_passed} per 1,000 passed tasks</div>
    <div class="card"><b>Widest web access</b><div class="big">${esc(L(bestReach))}</div>reaches ${reach[bestReach]}/${famous.length} famous hard sites</div>
  </div>
</div></div>

<div class="win"><div class="bar-title"><span>LEADERBOARD</span><span>quality 50 · reliability 35 · speed 15</span></div><div class="body scroll">
  <table><thead><tr><th>group</th><th>provider</th><th>overall (95% CI)</th><th>accuracy (quality)</th><th>pass rate</th><th>speed p50</th><th>$ / 1k passed</th><th>famous sites reached</th><th>right, but via mirror</th></tr></thead><tbody>
  ${board.map((b) => `<tr><td><span class="grp">${b.rank_group}</span></td><td><b>${esc(L(b.provider))}</b></td>
    <td class="n">${b.overall} <small>(${b.ci_low}–${b.ci_high})</small>${bar(num(b, "overall"), 100)}</td>
    <td class="n">${b.quality}${bar(num(b, "quality"), 100)}</td>
    <td class="n">${b.pass_rate}%</td>
    <td class="n">${(num(b, "p50_ms") / 1000).toFixed(1)}s${bar(num(b, "p50_ms"), maxMs, "speed")}</td>
    <td class="n">$${b.usd_per_1k_passed}${bar(num(b, "usd_per_1k_passed"), maxCost, "cost")}</td>
    <td class="n">${reach[b.provider]}/${famous.length}</td>
    <td class="n">${mirror[b.provider]}</td></tr>`).join("")}
  </tbody></table>
  <p class="note">Same group = the 95% paired-bootstrap CI of the gap includes 0, so the order inside a group is not meaningful. Cost = list price × billable calls, published as a column, not scored. "Right, but via mirror" counts live answers that were correct but read from a mirror or aggregator (nitter, redlib, twiscan, airdna…) instead of the site itself; they are scored as fails, because the benchmark asks whether the provider can reach the site.</p>
</div></div>

<div class="win"><div class="bar-title"><span>WEB_ACCESS.MAP</span><span>passed / attempts · hardest first</span></div><div class="body scroll">
  <table><thead><tr><th>site</th>${providers.map((p) => `<th>${esc(L(p))}</th>`).join("")}</tr></thead><tbody>
  ${famous.map((s) => `<tr><td><b>${esc(s.site)}</b></td>${providers.map((p) => heat(s[p])).join("")}</tr>`).join("")}
  </tbody></table>
  <p class="note">A pass needs the page fetched from the site itself (mirrors and aggregators don't count) and the task answered correctly. "Reached" in the leaderboard = passed at least half the attempts on that site.</p>
</div></div>

${spot.length ? `<div class="win"><div class="bar-title"><span>PROOF.TXT</span><span>is the fetched content real?</span></div><div class="body scroll">
  <p class="sub">Every X post linked from a passed X page was pulled from fxtwitter, and every passed YouTube page was checked against YouTube's own oEmbed: the post text or video title must appear verbatim in what the provider returned (<span class=\"mono\">scripts/tasks-spotcheck.ts</span>).</p>
  <table><thead><tr><th>provider</th><th>checked against</th><th>verified</th></tr></thead><tbody>
  ${spotRows.map((r) => `<tr><td><b>${esc(L(r.p))}</b></td><td>${esc(r.s)}</td><td class="h ${r.ok === r.n ? "ok" : "low"}">${r.ok}/${r.n}</td></tr>`).join("")}
  </tbody></table>
  <ul class="note">
    <li>Reddit and news passes are checked against the official RSS/API feed captured in the same round, so a pass there already proves the items are real and current.</li>
    <li>Providers fetch with their vendor-default cache policy. Parallel returned byte-identical Reddit pages across rounds minutes apart (served from its cache, with posts dated hours before the run), so a pass means "current enough for the task", not "fetched live this second".</li>
  </ul>
</div></div>` : ""}

</body></html>
`;
  const out = path.join(dir, "recap.html");
  await fs.writeFile(out, html);
  console.log(`wrote ${out}`);

  // ---------- README panels (SVG: GitHub strips <style> from markdown) ----------
  const W = 1200;
  const SANS = "Verdana,Arial,sans-serif";
  const PIXEL = "Silkscreen,'Courier New',monospace";
  const x = (s: string) => esc(s).replace(/"/g, "&quot;");
  const text = (tx: number, ty: number, s: string, size: number, attrs = "") =>
    `<text x="${tx}" y="${ty}" font-family="${SANS}" font-size="${size}" ${attrs}>${x(s)}</text>`;
  const sunken = (rx: number, ry: number, w: number, h: number, fill = "#ffffff") =>
    `<rect x="${rx}" y="${ry}" width="${w}" height="${h}" fill="${fill}"/>` +
    `<path d="M${rx} ${ry + h}V${ry}H${rx + w}" stroke="#808080" stroke-width="2" fill="none"/>` +
    `<path d="M${rx} ${ry + h}H${rx + w}V${ry}" stroke="#ffffff" stroke-width="2" fill="none"/>`;
  const windowSvg = (h: number, title: string, right: string, body: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}">` +
    `<defs><linearGradient id="tb" x1="0" x2="1"><stop offset="0" stop-color="#000080"/><stop offset="1" stop-color="#1084d0"/></linearGradient></defs>` +
    `<rect width="${W}" height="${h}" fill="#008080"/>` +
    `<rect x="16" y="16" width="${W - 32}" height="${h - 32}" fill="#c0c0c0"/>` +
    `<path d="M16 ${h - 16}V16H${W - 16}" stroke="#ffffff" stroke-width="2" fill="none"/>` +
    `<path d="M16 ${h - 16}H${W - 16}V16" stroke="#000000" stroke-width="2" fill="none"/>` +
    `<rect x="20" y="20" width="${W - 40}" height="30" fill="url(#tb)"/>` +
    `<text x="30" y="41" font-family="${PIXEL}" font-size="15" font-weight="bold" fill="#ffffff">${x(title)}</text>` +
    `<text x="${W - 30}" y="41" text-anchor="end" font-family="${PIXEL}" font-size="13" fill="#ffffff">${x(right)}</text>` +
    body +
    `</svg>\n`;
  const favicon = (p: string, fx: number, fy: number) => {
    const uri = faviconDataUri(p);
    return uri ? `<image x="${fx}" y="${fy}" width="18" height="18" href="${uri}" xlink:href="${uri}"/>` : "";
  };

  // SURFBENCH.EXE — headline cards
  const cards: [string, string[], string[]][] = [
    tied.length > 1
      ? ["TIED FOR #1", tied.map((b) => b.provider), [tied.map((b) => b.overall).join(" vs "), "CIs overlap"]]
      : ["BEST OVERALL", [board[0].provider], [`${board[0].overall} pts`, `CI ${board[0].ci_low}–${board[0].ci_high}`]],
    ["MOST ACCURATE", [accurate.provider], [`quality ${accurate.quality}`, `pass rate ${accurate.pass_rate}%`]],
    ["FASTEST", [fastest.provider], [`p50 ${(num(fastest, "p50_ms") / 1000).toFixed(1)}s`, "search + 3 fetches"]],
    ["CHEAPEST", [cheapest.provider], [`$${cheapest.usd_per_1k_passed}`, "per 1,000 passed tasks"]],
    ["WIDEST ACCESS", [bestReach], [`${reach[bestReach]}/${famous.length} famous`, "hard sites reached"]],
  ];
  const cw = (W - 80 - 4 * 14) / 5;
  const summary = windowSvg(
    300,
    "SURFBENCH.EXE",
    `v2 · ${runId}`,
    `<text x="40" y="96" font-family="${PIXEL}" font-size="30" font-weight="bold" fill="#111111">SurfBench <tspan fill="#000080">v2</tspan></text>` +
      text(40, 126, `${TASKS.length} checked tasks · ${providers.length} providers · search → fetch top 3 → fixed reader · live tasks × 3 rounds`, 14, `fill="#333333"`) +
      cards
        .map(([label, ids, lines], i) => {
          const cx = 40 + i * (cw + 14);
          const names = ids.map(L);
          const size = names.length > 1 || names[0].length > 12 ? 20 : 24;
          // A tie lists every name on one line when it fits, else stacked with
          // a single detail line below.
          const oneLine = names.join(" · ");
          const stacked = names.length > 1 && oneLine.length > 14;
          return (
            sunken(cx, 148, cw, 118) +
            ids.map((id, k) => favicon(id, cx + 12 + k * 22, 160)).join("") +
            `<text x="${cx + 14 + ids.length * 22}" y="174" font-family="${PIXEL}" font-size="12" fill="#000080">${x(label)}</text>` +
            (stacked
              ? names.slice(0, 2).map((n, k) => text(cx + 12, 200 + k * 24, n, size, `font-weight="bold" fill="#111111"`)).join("") +
                text(cx + 12, 254, lines.join(" · "), 13, `fill="#333333"`)
              : text(cx + 12, 210, oneLine, size, `font-weight="bold" fill="#111111"`) +
                lines.map((l, j) => text(cx + 12, 236 + j * 18, l, 13, `fill="#333333"`)).join(""))
          );
        })
        .join(""),
  );

  // LEADERBOARD
  const cols = { grp: 40, prov: 92, overall: 280, quality: 560, pass: 740, p50: 820, cost: 905, reach: 1025, mirror: 1100 };
  const rowH = 44;
  const top = 108;
  const barW = 110;
  const lbBar = (bx: number, by: number, v: number, max: number, fill: string) =>
    `<rect x="${bx}" y="${by}" width="${barW}" height="10" fill="#eeeeee" stroke="#999999"/>` +
    `<rect x="${bx}" y="${by}" width="${Math.max(2, (barW * v) / max).toFixed(1)}" height="10" fill="${fill}"/>`;
  const lbH = top + board.length * rowH + 80;
  const header = (
    [["GROUP", cols.grp], ["PROVIDER", cols.prov], ["OVERALL (95% CI)", cols.overall], ["ACCURACY", cols.quality], ["PASS", cols.pass], ["P50", cols.p50], ["$/1K PASSED", cols.cost], ["REACH", cols.reach], ["MIRROR", cols.mirror]] as [string, number][]
  ).map(([h, hx]) => `<text x="${hx}" y="${top - 14}" font-family="${PIXEL}" font-size="11" fill="#111111">${h}</text>`).join("");
  const leaderboard = windowSvg(
    lbH,
    "LEADERBOARD",
    "quality 50 · reliability 35 · speed 15",
    sunken(32, top - 36, W - 64, board.length * rowH + 44) +
      `<rect x="34" y="${top - 34}" width="${W - 68}" height="28" fill="#e4e4e4"/>` +
      header +
      board
        .map((b, i) => {
          const ry = top + i * rowH;
          const mid = ry + 27;
          return (
            (i ? `<line x1="34" x2="${W - 34}" y1="${ry}" y2="${ry}" stroke="#dddddd"/>` : "") +
            `<rect x="${cols.grp}" y="${mid - 15}" width="24" height="20" fill="#ffffe1" stroke="#000000"/>` +
            `<text x="${cols.grp + 12}" y="${mid}" text-anchor="middle" font-family="${PIXEL}" font-size="12">${b.rank_group}</text>` +
            favicon(b.provider, cols.prov, mid - 14) +
            text(cols.prov + 26, mid, L(b.provider), 16, `font-weight="bold" fill="#111111"`) +
            text(cols.overall, mid, `${b.overall}`, 16, `font-weight="bold" fill="#111111"`) +
            text(cols.overall + 44, mid, `(${b.ci_low}–${b.ci_high})`, 12, `fill="#555555"`) +
            lbBar(cols.overall + 140, mid - 10, num(b, "overall"), 100, "#000080") +
            text(cols.quality, mid, b.quality, 15, `fill="#111111"`) +
            lbBar(cols.quality + 46, mid - 10, num(b, "quality"), 100, "#000080") +
            text(cols.pass, mid, `${b.pass_rate}%`, 15, `fill="#111111"`) +
            text(cols.p50, mid, `${(num(b, "p50_ms") / 1000).toFixed(1)}s`, 15, `fill="#111111"`) +
            text(cols.cost, mid, `$${b.usd_per_1k_passed}`, 15, `fill="#111111"`) +
            text(cols.reach, mid, `${reach[b.provider]}/${famous.length}`, 15, `fill="#111111"`) +
            text(cols.mirror, mid, `${mirror[b.provider]}`, 15, `fill="#111111"`)
          );
        })
        .join("") +
      text(40, lbH - 46, "Same group = statistically tied (95% paired-bootstrap CI of the gap includes 0). Reach = famous hard sites passed on ≥ half the attempts.", 12, `fill="#333333"`) +
      text(40, lbH - 28, "Mirror = live answers that were right but read from a mirror/aggregator (nitter, redlib…), scored as fails. Cost is a column, not scored.", 12, `fill="#333333"`),
  );

  // WEB_ACCESS.MAP
  const siteW = 210;
  const colW = (W - 80 - siteW) / providers.length;
  const cellH = 30;
  const mTop = 110;
  const heatFill = (c: { p: number; a: number; r: number }) =>
    c.a === 0 ? "#bbbbbb" : c.r >= 0.99 ? "#2e8b57" : c.r >= 0.5 ? "#c9a227" : c.r > 0 ? "#d2691e" : "#aa3333";
  const mapH = mTop + famous.length * (cellH + 4) + 60;
  const accessMap = windowSvg(
    mapH,
    "WEB_ACCESS.MAP",
    "passed / attempts · hardest first",
    providers
      .map((p, j) => {
        const hx = 40 + siteW + j * colW + colW / 2;
        // "parallel (turbo)" does not fit one column: the mode goes on a second line.
        const [main, mode] = L(p).split(/ (?=\()/);
        return (
          favicon(p, hx - 50, mTop - 44) +
          `<text x="${hx - 26}" y="${mTop - 30}" font-family="${PIXEL}" font-size="12" fill="#111111">${x(main)}</text>` +
          (mode ? `<text x="${hx - 26}" y="${mTop - 14}" font-family="${PIXEL}" font-size="12" fill="#555555">${x(mode)}</text>` : "")
        );
      })
      .join("") +
      famous
        .map((s, i) => {
          const ry = mTop + i * (cellH + 4);
          return (
            text(40, ry + 20, s.site, 14, `font-weight="bold" fill="#111111"`) +
            providers
              .map((p, j) => {
                const c = cell(s[p]);
                const cx = 40 + siteW + j * colW;
                return (
                  `<rect x="${cx + 2}" y="${ry}" width="${colW - 4}" height="${cellH}" fill="${heatFill(c)}"/>` +
                  `<text x="${cx + colW / 2}" y="${ry + 20}" text-anchor="middle" font-family="${SANS}" font-size="13" font-weight="bold" fill="#ffffff">${c.a ? `${c.p}/${c.a}` : "–"}</text>`
                );
              })
              .join("")
          );
        })
        .join("") +
      text(40, mapH - 30, "A pass needs the page fetched from the site itself (mirrors and aggregators don't count) and the task answered correctly.", 12, `fill="#333333"`),
  );

  await fs.mkdir("assets", { recursive: true });
  await fs.writeFile("assets/v2-summary.svg", summary);
  await fs.writeFile("assets/v2-leaderboard.svg", leaderboard);
  await fs.writeFile("assets/v2-access.svg", accessMap);
  console.log("wrote assets/v2-summary.svg, assets/v2-leaderboard.svg, assets/v2-access.svg");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

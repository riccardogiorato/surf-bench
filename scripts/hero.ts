import fs from "fs";
import { faviconDataUri } from "./favicons.js";

// Generates assets/hero.svg — a Y2K window-frame hero: a podium of the three
// top-overall providers (embedded favicons) across the top, big bench name and
// short description on the left, per-event winner panels on the right.

function podiumCard(
  x: number,
  y: number,
  medal: string,
  name: string,
  score: number,
  logo: string,
): string {
  const w = 440, h = 150;
  const logoSvg = logo
    ? `<image x="88" y="47" width="56" height="56" href="${logo}"/>`
    : "";
  return (
    `<g transform="translate(${x} ${y})">` +
    `<rect x="6" y="6" width="${w}" height="${h}" fill="#0a0a0a"/>` +
    `<rect width="${w}" height="${h}" fill="#f4f2ea" stroke="#ffffff" stroke-width="2"/>` +
    `<rect x="2" y="2" width="${w - 4}" height="${h - 4}" fill="none" stroke="#808080" stroke-width="1"/>` +
    `<text x="24" y="93" font-family="Verdana,Arial,sans-serif" font-size="46">${medal}</text>` +
    logoSvg +
    `<text x="162" y="68" font-family="Verdana,Arial,sans-serif" font-size="34" font-weight="bold" fill="#111111">${name}</text>` +
    `<text x="162" y="116" font-family="Verdana,Arial,sans-serif" font-size="38" font-weight="bold" fill="#000080">${score}<tspan font-size="20" fill="#666666"> /100</tspan></text>` +
    `<text x="${w - 24}" y="38" text-anchor="end" font-family="Verdana,Arial,sans-serif" font-size="16" fill="#666666">agent-ready</text>` +
    `</g>`
  );
}

function main() {
  const W = 1600, H = 900; // 16:9 OG image
  const svg: string[] = [];

  svg.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="ht hd">`);
  svg.push(`<title id="ht">SurfBench</title>`);
  svg.push(`<desc id="hd">SurfBench — the web-access benchmark for agents: podium parallel, exa, keenable across the search, scrape and quest events.</desc>`);
  svg.push(`<rect width="${W}" height="${H}" fill="#c0c0c0"/>`);

  // titlebar strip
  svg.push(`<rect width="${W}" height="52" fill="#000080"/>`);
  svg.push(`<text x="32" y="36" font-family="Verdana,Arial,sans-serif" font-size="24" font-weight="bold" fill="#ffffff">SurfBench</text>`);

  // content plate
  svg.push(`<rect x="16" y="68" width="${W - 32}" height="${H - 84}" fill="#ffffff" stroke="#808080" stroke-width="2"/>`);

  // ===== TOP: podium of the three top-overall providers =====
  const winners: Array<[string, string, number]> = [
    ["🥇", "parallel", 74],
    ["🥈", "exa", 66],
    ["🥉", "keenable", 56],
  ];
  winners.forEach(([medal, name, score], i) => {
    svg.push(podiumCard(80 + i * 500, 100, medal, name, score, faviconDataUri(name)));
  });

  // ===== LEFT: name + short description =====
  svg.push(`<text x="80" y="530" font-family="Silkscreen,Verdana,monospace" font-size="110" font-weight="bold" fill="#111111">Surf<tspan fill="#000080">Bench</tspan></text>`);
  svg.push(`<text x="86" y="610" font-family="Verdana,Arial,sans-serif" font-size="40" fill="#444444">The web access benchmark for agents.</text>`);
  svg.push(`<text x="86" y="660" font-family="Verdana,Arial,sans-serif" font-size="22" fill="#666666">search · scrape · quest — judged by Kimi K3 + GLM-5.3</text>`);

  // ===== RIGHT: three event winner panels, stacked =====
  const panels: Array<[string, string, string]> = [
    ["SEARCH", "29 queries / 12 dims", "winner: brave 0.8s p50"],
    ["SCRAPE", "50-URL gauntlet", "winner: parallel 50/50 @ 0.6s"],
    ["QUEST", "15 questions + judge", "winner: keenable 15/15 · judge 8.3"],
  ];
  panels.forEach((p, i) => {
    const x = 1020;
    const y = 270 + i * 185;
    const w = 500, h = 160;
    svg.push(`<g transform="translate(${x} ${y})">`);
    svg.push(`<rect x="5" y="5" width="${w}" height="${h}" fill="#0a0a0a"/>`);
    svg.push(`<rect width="${w}" height="${h}" fill="#f4f2ea" stroke="#808080" stroke-width="2"/>`);
    svg.push(`<rect x="4" y="4" width="${w - 8}" height="42" fill="#000080"/>`);
    svg.push(`<text x="20" y="30" font-family="Verdana,Arial,sans-serif" font-size="20" font-weight="bold" fill="#ffffff">${p[0]}</text>`);
    svg.push(`<text x="20" y="88" font-family="Verdana,Arial,sans-serif" font-size="24" font-weight="bold" fill="#111111">${p[1]}</text>`);
    svg.push(`<text x="20" y="132" font-family="Verdana,Arial,sans-serif" font-size="21" fill="#000080" font-weight="bold">${p[2]}</text>`);
    svg.push(`</g>`);
  });

  // ===== BOTTOM: Y2K taskbar strip with run stats =====
  svg.push(`<rect x="32" y="818" width="${W - 64}" height="52" fill="#c0c0c0" stroke="#808080" stroke-width="2"/>`);
  svg.push(`<rect x="34" y="820" width="${W - 68}" height="2" fill="#ffffff"/>`);
  svg.push(`<text x="52" y="851" font-family="Verdana,Arial,sans-serif" font-size="21" font-weight="bold" fill="#111111">50 URLs · 29 queries · 15 quests — 8 providers · run of 5 September 2026</text>`);
  svg.push(`<text x="${W - 52}" y="851" text-anchor="end" font-family="Verdana,Arial,sans-serif" font-size="19" fill="#000080">github.com/riccardogiorato/surf-bench</text>`);

  svg.push(`</svg>`);
  fs.writeFileSync("assets/hero.svg", svg.join("\n"));
  console.log("wrote assets/hero.svg");
}

main();
import fs from "fs";
import { faviconDataUri } from "./favicons.js";

// Generates assets/hero.svg — a simple Y2K window-frame hero for the README:
// big bench name, short description, provider chips with embedded favicons.

function chip(label: string, x: number, y: number, logo: string): string {
  const w = Math.max(420, label.length * 13 + 60);
  const hasLogo = logo.length > 0;
  const labelX = hasLogo ? w / 2 + 12 : w / 2;
  const logoSvg = hasLogo
    ? `<image x="20" y="20" width="32" height="32" href="${logo}"/>`
    : "";
  return (
    `<g transform="translate(${x} ${y})">` +
    `<rect x="4" y="4" width="${w}" height="72" fill="#0a0a0a"/>` +
    `<rect width="${w}" height="72" fill="#c0c0c0" stroke="#ffffff" stroke-width="2"/>` +
    `<rect x="1.5" y="1.5" width="${w - 3}" height="69" fill="none" stroke="#808080" stroke-width="1"/>` +
    logoSvg +
    `<text x="${labelX}" y="47" font-family="Verdana,Arial,sans-serif" font-size="28" font-weight="bold" fill="#111111" text-anchor="middle">${label}</text>` +
    `</g>`
  );
}

function main() {
  const W = 1600, H = 900; // 16:9 OG image
  const svg: string[] = [];

  svg.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="ht hd">`);
  svg.push(`<title id="ht">SurfBench</title>`);
  svg.push(`<desc id="hd">SurfBench — the web-access benchmark for agents: search, scrape, quest events across eight providers.</desc>`);
  svg.push(`<rect width="${W}" height="${H}" fill="#c0c0c0"/>`);

  // titlebar strip
  svg.push(`<rect width="${W}" height="52" fill="#000080"/>`);
  svg.push(`<text x="32" y="36" font-family="Verdana,Arial,sans-serif" font-size="24" font-weight="bold" fill="#ffffff">SurfBench</text>`);

  // content plate
  svg.push(`<rect x="16" y="68" width="${W - 32}" height="${H - 84}" fill="#ffffff" stroke="#808080" stroke-width="2"/>`);

  // ===== LEFT 60%: name, description, provider chips =====
  svg.push(`<text x="80" y="250" font-family="Silkscreen,Verdana,monospace" font-size="110" font-weight="bold" fill="#111111">Surf<tspan fill="#000080">Bench</tspan></text>`);
  svg.push(`<text x="86" y="330" font-family="Verdana,Arial,sans-serif" font-size="40" fill="#444444">The web access benchmark for agents.</text>`);

  const providers = ["firecrawl", "exa", "linkup", "tavily", "parallel", "jina", "brave", "serper"];
  providers.forEach((p, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 80 + col * 460;
    const y = 420 + row * 100;
    svg.push(chip(p, x, y, faviconDataUri(p)));
  });

  // ===== RIGHT 40%: three event winner panels, stacked =====
  const panels: Array<[string, string, string]> = [
    ["SEARCH", "29 queries / 12 dims", "winner: brave 0.9s p50"],
    ["SCRAPE", "50-URL gauntlet", "winner: parallel 50/50 @ 0.6s"],
    ["QUEST", "15 questions + judge", "winner: exa 7.7s · judge 7.4"],
  ];
  panels.forEach((p, i) => {
    const x = 1020;
    const y = 200 + i * 220;
    const w = 500, h = 170;
    svg.push(`<g transform="translate(${x} ${y})">`);
    svg.push(`<rect x="5" y="5" width="${w}" height="${h}" fill="#0a0a0a"/>`);
    svg.push(`<rect width="${w}" height="${h}" fill="#f4f2ea" stroke="#808080" stroke-width="2"/>`);
    svg.push(`<rect x="4" y="4" width="${w - 8}" height="42" fill="#000080"/>`);
    svg.push(`<text x="20" y="30" font-family="Verdana,Arial,sans-serif" font-size="20" font-weight="bold" fill="#ffffff">${p[0]}</text>`);
    svg.push(`<text x="20" y="86" font-family="Verdana,Arial,sans-serif" font-size="24" font-weight="bold" fill="#111111">${p[1]}</text>`);
    svg.push(`<text x="20" y="130" font-family="Verdana,Arial,sans-serif" font-size="21" fill="#000080" font-weight="bold">${p[2]}</text>`);
    svg.push(`</g>`);
  });

  svg.push(`</svg>`);
  fs.writeFileSync("assets/hero.svg", svg.join("\n"));
  console.log("wrote assets/hero.svg");
}

main();
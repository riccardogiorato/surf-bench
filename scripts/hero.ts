import fs from "fs";
import { faviconDataUri } from "./favicons.js";

// Generates assets/hero.svg — a simple Y2K window-frame hero for the README:
// big bench name, short description, provider chips with embedded favicons.

function chip(label: string, x: number, y: number, logo: string): string {
  const w = Math.max(150, label.length * 10 + 44);
  const hasLogo = logo.length > 0;
  const labelX = hasLogo ? w / 2 + 12 : w / 2;
  const logoSvg = hasLogo
    ? `<image x="10" y="10" width="20" height="20" href="${logo}"/>`
    : "";
  return (
    `<g transform="translate(${x} ${y})">` +
    `<rect x="3" y="3" width="${w}" height="40" fill="#0a0a0a"/>` +
    `<rect width="${w}" height="40" fill="#c0c0c0" stroke="#ffffff" stroke-width="2"/>` +
    `<rect x="1.5" y="1.5" width="${w - 3}" height="37" fill="none" stroke="#808080" stroke-width="1"/>` +
    logoSvg +
    `<text x="${labelX}" y="27" font-family="Verdana,Arial,sans-serif" font-size="16" font-weight="bold" fill="#111111" text-anchor="middle">${label}</text>` +
    `</g>`
  );
}

function main() {
  const W = 1600, H = 520;
  const svg: string[] = [];

  svg.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="ht hd">`);
  svg.push(`<title id="ht">SurfBench</title>`);
  svg.push(`<desc id="hd">A Y2K desktop window frame: SurfBench, the web-access benchmark for agents — search, scrape, quest events across eight providers.</desc>`);
  svg.push(`<defs><pattern id="dith" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="#008080"/><rect x="1" y="1" width="1" height="1" fill="#007a7a"/></pattern></defs>`);
  svg.push(`<rect width="${W}" height="${H}" fill="url(#dith)"/>`);

  // window — slim 36px dithered frame around it
  const wx = 36, wy = 36, ww = 1528, wh = 448;
  svg.push(`<g transform="translate(${wx} ${wy})">`);
  svg.push(`<rect x="8" y="8" width="${ww}" height="${wh}" fill="#0a0a0a" opacity="0.35"/>`);
  svg.push(`<rect width="${ww}" height="${wh}" fill="#c0c0c0" stroke="#ffffff" stroke-width="2"/>`);
  svg.push(`<rect x="2" y="2" width="${ww - 4}" height="${wh - 4}" fill="none" stroke="#808080" stroke-width="2"/>`);
  // titlebar
  svg.push(`<rect x="4" y="4" width="${ww - 8}" height="34" fill="#000080"/>`);
  svg.push(`<text x="16" y="27" font-family="Verdana,Arial,sans-serif" font-size="15" font-weight="bold" fill="#ffffff">SurfBench — The Web Access Benchmark for Agents</text>`);
  // titlebar buttons
  [ww - 92, ww - 62, ww - 32].forEach((bx, i) => {
    svg.push(`<rect x="${bx}" y="10" width="22" height="20" fill="#c0c0c0" stroke="#0a0a0a"/>`);
    const glyph = i === 2 ? "✕" : i === 1 ? "□" : "_";
    svg.push(`<text x="${bx + 11}" y="25" font-family="Verdana,Arial,sans-serif" font-size="13" fill="#111111" text-anchor="middle">${glyph}</text>`);
  });
  // content plate
  svg.push(`<rect x="14" y="46" width="${ww - 28}" height="${wh - 60}" fill="#ffffff" stroke="#808080"/>`);

  // big name
  svg.push(`<text x="60" y="150" font-family="Verdana,Arial,sans-serif" font-size="96" font-weight="bold" fill="#111111" letter-spacing="-3">Surf<tspan fill="#000080">Bench</tspan></text>`);
  // short description
  svg.push(`<text x="62" y="200" font-family="Verdana,Arial,sans-serif" font-size="20" fill="#444444">Find the fastest, highest-quality web access API for your agents.</text>`);
  svg.push(`<text x="62" y="234" font-family="Verdana,Arial,sans-serif" font-size="15" fill="#0a0a0a">Three events: search / scrape / quest — judged, timed, 30s wipeout rule.</text>`);

  // provider chips — tight taskbar cluster, two rows of four
  const providers = ["firecrawl", "exa", "linkup", "tavily", "parallel", "jina", "brave", "serper"];
  providers.forEach((p, i) => {
    const col = i % 4, row = Math.floor(i / 4);
    const x = 60 + col * 186;
    const y = 274 + row * 62;
    svg.push(chip(p, x, y, faviconDataUri(p)));
  });

  // status bar
  svg.push(`<text x="60" y="${wh - 24}" font-family="Verdana,monospace" font-size="13" fill="#000080">*** 50 waves · 29 queries · 15 quests · judged by Kimi K3 + GLM-5.3 ***</text>`);
  svg.push(`</g>`);

  svg.push(`</svg>`);
  fs.writeFileSync("assets/hero.svg", svg.join("\n"));
  console.log("wrote assets/hero.svg");
}

main();
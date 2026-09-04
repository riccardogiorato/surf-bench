import fs from "fs";

// Generates assets/hero.svg — the Y2K portal illustration for the README.
// The mascot renders from a string-grid sprite via a tiny run-length loop,
// so no hand-authored pixel rect math.

const PAL: Record<string, string> = {
  N: "#0d2c4d", W: "#ffffff", F: "#bfe0ff", B: "#2e86de", D: "#1b4f8a",
  K: "#101820", G: "#7fb3ff", Y: "#f0a832", O: "#b96f10",
};

const CURL: string[] = [
  ".......NNNNN..........",
  ".....NNWWWWWNN........",
  "....NWWWWFWWWWN.......",
  "...NWWFWNNWWWFWN......",
  "...NWWWN...NWWBBN.....",
  "..NWWWN....NWBBBBN....",
  "..NWWN....NBBBBBBN....",
  "..NWWN...NBBBBBBBBN...",
  "..NWBN..NBBBBBBBBBBN..",
  "..NBBN.NBBBBBBBBBBBBN.",
  "..NBBBNBBBBBBBBBBBBBN.",
  ".NBBBBBBBBBBBBBBBBBBN.",
  "NBBBBBBBBBBBBBBBBBBBBN",
  "NBBBKKKKKKKKKKKKKKBBBN",
  "NBBBKGGGKBBBBKGGGKBBBN",
  "NBBBBBBBBBBBBBBBBBBBBN",
  "NBBBBBBBBBBBBBBBBBBBBN",
  "NBBBBBBBBBBBBBBBBBBBBN",
  "NBBBNNBBBBBBBBBBNNBBBBN",
  "NBBBBBNNNNNNNNNNBBBBBN",
  ".NNBBBBBBBBBBBBBBBBNN.",
  "...YYYYYYWWYYYYYYYY...",
  "..OYYYYYYYYYYYYYYYYO..",
  "...OOOOOOOOOOOOOOOO...",
];

function spriteSvg(scale: number): string {
  const parts: string[] = [];
  CURL.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === ".") { x++; continue; }
      let run = 1;
      while (x + run < row.length && row[x + run] === ch) run++;
      parts.push(`<rect x="${x}" y="${y}" width="${run}" height="1" fill="${PAL[ch]}"/>`);
      x += run;
    }
  });
  return `<g shape-rendering="crispEdges" transform="scale(${scale})">${parts.join("")}</g>`;
}

// --- hero composition: dithered desktop, icon plate, window, badges ---
function badge(text: string, bg: string, fg: string): string {
  return (
    `<rect width="88" height="31" fill="${bg}"/>` +
    `<text x="44" y="20" font-family="Verdana,Arial,sans-serif" font-size="9" font-weight="bold" fill="${fg}" text-anchor="middle">${text}</text>`
  );
}

function main() {
  const W = 1600, H = 600;
  const svg: string[] = [];

  svg.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="ht hd">`);
  svg.push(`<title id="ht">SurfBench</title>`);
  svg.push(`<desc id="hd">Pixel wave mascot curl.exe on a teal dithered desktop beside a retro browser window.</desc>`);
  svg.push(`<defs><pattern id="dith" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="#008080"/><rect x="1" y="1" width="1" height="1" fill="#007a7a"/></pattern></defs>`);
  svg.push(`<rect width="${W}" height="${H}" fill="url(#dith)"/>`);

  // mascot icon plate
  svg.push(`<g transform="translate(90 110)">`);
  svg.push(`<rect x="-12" y="-12" width="246" height="300" fill="#f4faff" stroke="#808080" stroke-width="3"/>`);
  svg.push(`<rect width="222" height="276" fill="#d8ecff"/>`);
  svg.push(spriteSvg(10));
  svg.push(`<text y="298" font-family="Verdana,monospace" font-size="13" fill="#ffffff" font-weight="bold">curl.exe</text>`);
  svg.push(`</g>`);

  // browser window
  svg.push(`<g transform="translate(400 110)">`);
  svg.push(`<rect width="1100" height="380" fill="#c0c0c0" stroke="#0a0a0a" stroke-width="2"/>`);
  svg.push(`<rect x="3" y="3" width="1094" height="30" fill="#000080"/>`);
  svg.push(`<text x="16" y="24" font-family="Verdana,Arial,sans-serif" font-size="15" font-weight="bold" fill="#ffffff">SurfBench — The Web Access Benchmark</text>`);
  svg.push(`<rect x="14" y="44" width="1072" height="320" fill="#ffffff" stroke="#808080"/>`);
  svg.push(`<text x="36" y="92" font-family="Verdana,Arial,sans-serif" font-size="34" font-weight="bold" fill="#111111">SurfBench</text>`);
  svg.push(`<text x="36" y="126" font-family="Verdana,Arial,sans-serif" font-size="15" fill="#444444">The benchmark that hires the best web assistant for your agent.</text>`);
  svg.push(`<text x="36" y="164" font-family="Verdana,Arial,sans-serif" font-size="14" fill="#111111">Events: search / scrape / quest</text>`);
  svg.push(`<text x="36" y="190" font-family="Verdana,Arial,sans-serif" font-size="13" fill="#111111">Providers: firecrawl exa linkup tavily parallel jina brave serper</text>`);
  svg.push(`<text x="36" y="216" font-family="Verdana,Arial,sans-serif" font-size="14" fill="#111111">Judges: Kimi K3 + GLM-5 via Together AI</text>`);
  svg.push(`<text x="36" y="242" font-family="Verdana,Arial,sans-serif" font-size="13" fill="#111111">30s wipeout rule: slow is a DQ, not a data point</text>`);
  svg.push(`<rect x="36" y="270" width="440" height="30" fill="#ffffff" stroke="#808080"/>`);
  svg.push(`<text x="48" y="290" font-family="Verdana,monospace" font-size="13" fill="#444444">which provider should my agent use?</text>`);
  svg.push(`<rect x="488" y="270" width="84" height="30" fill="#c0c0c0" stroke="#0a0a0a"/>`);
  svg.push(`<text x="506" y="290" font-family="Verdana,Arial,sans-serif" font-size="13" fill="#111111">Surf!</text>`);
  svg.push(`<rect x="36" y="316" width="1050" height="8" fill="#ffd800"/>`);
  svg.push(`<text x="36" y="352" font-family="Verdana,monospace" font-size="12" fill="#000080">*** SEARCH: tavily fastest *** SCRAPE: parallel most waves *** QUEST: see results/ ***</text>`);
  svg.push(`</g>`);

  // badges row
  svg.push(`<g transform="translate(90 470)">`);
  svg.push(badge("SURF BENCH", "#000080", "#ffffff"));
  svg.push(`<g transform="translate(96 0)">${badge("POWERED BY VITEST", "#1084d0", "#ffffff")}</g>`);
  svg.push(`<g transform="translate(192 0)">${badge("JUDGED BY LLMS", "#ffd800", "#3a2c00")}</g>`);
  svg.push(`<g transform="translate(288 0)">${badge("30S WIPEOUT", "#ff6600", "#ffffff")}</g>`);
  svg.push(`<g transform="translate(384 0)">${badge("PNPM INSIDE", "#c0c0c0", "#111111")}</g>`);
  svg.push(`</g>`);

  svg.push(`</svg>`);
  fs.writeFileSync("assets/hero.svg", svg.join("\n"));
  console.log("wrote assets/hero.svg");
}

main();
import fs from "fs";
import path from "path";
import cp from "child_process";

// Provider favicons as base64 data URIs — downloaded once from Google's s2
// endpoint (follows redirects) and cached under cache/favicons. Data URIs
// render on GitHub, unlike remote <image> hrefs inside SVG files.

const PROVIDER_DOMAINS: Record<string, string> = {
  parallel: "parallel.ai",
  tavily: "tavily.com",
  firecrawl: "firecrawl.dev",
  exa: "exa.ai",
  linkup: "linkup.so",
  jina: "jina.ai",
  brave: "brave.com",
  serper: "serper.dev",
  keenable: "keenable.ai",
};

export function faviconDataUri(provider: string): string {
  const domain = PROVIDER_DOMAINS[provider];
  if (!domain) return "";
  const cacheFile = path.join("cache", "favicons", `${provider}.txt`);
  try {
    const cached = fs.readFileSync(cacheFile, "utf8");
    if (cached.startsWith("data:image/png;base64,iVBOR")) return cached;
  } catch {
    // fetch below
  }
  try {
    const res = cp.execSync(
      `curl -sL "https://www.google.com/s2/favicons?domain=${domain}&sz=64"`,
      { maxBuffer: 1024 * 1024 },
    );
    const uri = `data:image/png;base64,${res.toString("base64")}`;
    fs.mkdirSync(path.join("cache", "favicons"), { recursive: true });
    fs.writeFileSync(cacheFile, uri);
    return uri;
  } catch {
    return "";
  }
}
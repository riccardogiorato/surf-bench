import { SearchFunction, SearchResponse } from "../types.js";

import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const CACHE_BASE_DIR = "./cache/search";
const CACHE_TTL_SECONDS = 86400; // 24 hours

interface CacheEntry {
  data: SearchResponse;
  timestamp: number;
}

function queryToFilename(query: string, numResults: number): string {
  const hash = crypto
    .createHash("md5")
    .update(`${query}:${numResults}`)
    .digest("hex");
  const slug = query
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${slug}-${hash}.json`;
}

async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch {
    // Directory might already exist, ignore error
  }
}

export function withSearchCache(
  vendor: string,
  fn: SearchFunction,
): SearchFunction {
  return async (query: string, numResults = 5) => {
    // Live tasks and repeat rounds must hit the provider every time.
    if (process.env.SURFBENCH_NO_CACHE) return fn(query, numResults);
    const vendorDir = path.join(CACHE_BASE_DIR, vendor);
    const filePath = path.join(vendorDir, queryToFilename(query, numResults));

    try {
      const cached = await fs.readFile(filePath, "utf-8");
      const cacheEntry: CacheEntry = JSON.parse(cached);
      if (Date.now() - cacheEntry.timestamp < CACHE_TTL_SECONDS * 1000) {
        return cacheEntry.data;
      }
    } catch {
      // Cache miss or invalid cache, continue to fetch
    }

    const result = await fn(query, numResults);

    // An error (rate limit, quota, timeout...) is not a result worth caching
    // for 24h: it previously meant one bad run against a provider's per-second
    // cap stayed "rate limited" in every re-run for a full day, regardless of
    // retry/pacing fixes made after the fact. Same rule the judge cache uses:
    // never persist a failure as if it were data.
    if (!result.error) {
      try {
        await ensureDir(vendorDir);
        const cacheEntry: CacheEntry = { data: result, timestamp: Date.now() };
        await fs.writeFile(filePath, JSON.stringify(cacheEntry, null, 2));
      } catch {
        // Ignore cache write errors
      }
    }

    return result;
  };
}

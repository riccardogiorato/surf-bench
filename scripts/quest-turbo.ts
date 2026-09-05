import { QUEST_CASES } from "../src/suites/quest/questCases.js";
import { grade } from "../src/lib/judge/judge.js";
import { recordQuestRun } from "../src/lib/results.js";
import {
  parallelClientFactory,
  exaClientFactory,
} from "../src/lib/apiClients.js";
import { fetchParallelContent } from "../src/lib/parallelClient.js";
import type { QuestResult, ScrapedContent } from "../src/lib/types.js";
import "dotenv/config";

// Side-event: "quest · super fast" — the same 15 quest questions run through
// each provider's fastest-mode configuration, judged by the same panel, and
// recorded to results/raw/quest-turbo.jsonl so the default-config leaderboard
// stays untouched.
//
//   parallel-turbo  search mode "turbo" (fastest preset, $1/1k tier) + the
//                   same full-content extract as the main bench
//   exa-express     search type "fast" + contents livecrawl "never" (index-only)
//
// Compare against the default-quest numbers in results/README.md.

const SEARCH_TIMEOUT_MS = 30000; // wipeout rule: 30s per leg
const FETCH_TIMEOUT_MS = 30000;
const FILE = "quest-turbo";

interface FastConfig {
  name: string;
  search: (query: string) => Promise<string[]>; // top result URLs
  fetch: (url: string) => Promise<ScrapedContent>;
}

const configs: FastConfig[] = [
  {
    name: "parallel-turbo",
    search: async (query) => {
      const response = await parallelClientFactory().search({
        search_queries: [query],
        mode: "turbo",
      });
      return (response.results ?? [])
        .map((item: any) => item.url || "")
        .filter(Boolean);
    },
    fetch: async (url) => {
      const response = await fetchParallelContent(url, FETCH_TIMEOUT_MS);
      return {
        url,
        response: {
          title: response.title,
          content: response.content,
          scrapingTimeMs: response.scrapingTimeMs,
        },
      };
    },
  },
  {
    name: "exa-express",
    search: async (query) => {
      const response = await exaClientFactory().search(query, {
        numResults: 3,
        type: "fast",
      });
      return (response.results ?? [])
        .map((item: any) => item.url || "")
        .filter(Boolean);
    },
    fetch: async (url) => {
      const response = await exaClientFactory().getContents([url], {
        text: true,
        livecrawl: "never", // index-only: no live-crawl latency
      });
      const result = response.results?.[0];
      if (!result) return { url, error: "no content in exa index" };
      return {
        url,
        response: { title: result.title ?? "", content: result.text ?? "" },
      };
    },
  },
];

async function runQuest(
  config: FastConfig,
  quest: (typeof QUEST_CASES)[number],
): Promise<QuestResult> {
  const searchStart = Date.now();
  let urls: string[] = [];
  let searchError: string | undefined;
  try {
    urls = (await config.search(quest.question)).slice(0, 3);
  } catch (e) {
    searchError = e instanceof Error ? e.message : "search failed";
  }
  const searchMs = Date.now() - searchStart;

  if (searchError || urls.length === 0) {
    return {
      provider: config.name,
      questId: quest.id,
      searchMs,
      fetchMs: 0,
      totalMs: Date.now() - searchStart,
      urlsFetched: urls,
      contentChars: 0,
      wipeout: searchMs > SEARCH_TIMEOUT_MS,
      error: searchError ?? "no search results",
    };
  }

  const fetchStart = Date.now();
  const fetches = await Promise.all(
    urls.map((url) =>
      config
        .fetch(url)
        .catch((): ScrapedContent => ({ url, error: "fetch failed" })),
    ),
  );
  const fetchMs = Date.now() - fetchStart;

  const contents = fetches.map((f) => f.response?.content ?? "").filter(Boolean);
  const content = contents.join("\n\n---\n\n");
  return {
    provider: config.name,
    questId: quest.id,
    searchMs,
    fetchMs,
    totalMs: searchMs + fetchMs,
    urlsFetched: urls,
    contentChars: content.length,
    content,
    wipeout:
      (searchMs > SEARCH_TIMEOUT_MS ||
        fetches.some((f) => f.error === "fetch failed")) || undefined,
    error: content.length === 0 ? "no content extracted" : undefined,
  };
}

async function main() {
  console.log(
    `quest · super fast — ${configs.length} configs × ${QUEST_CASES.length} quests`,
  );
  const answered: QuestResult[] = [];
  for (const config of configs) {
    for (const quest of QUEST_CASES) {
      const result = await runQuest(config, quest);
      await recordQuestRun(result, FILE);
      if (result.content && result.content.length > 200) answered.push(result);
      console.log(
        `${config.name} ${quest.id}: ${result.error ?? "answered"} ` +
          `${result.contentChars}c search=${result.searchMs}ms fetch=${result.fetchMs}ms`,
      );
    }
  }

  // judge every answered record with the standard panel (cache-aware)
  for (const result of answered) {
    const quest = QUEST_CASES.find((q) => q.id === result.questId);
    if (!quest) continue;
    const { verdicts, average, flagged } = await grade(
      quest.question,
      result.content ?? "",
    );
    if (Number.isNaN(average)) {
      console.error(`${result.provider} ${result.questId}: ALL JUDGES ERRORED`);
      continue;
    }
    await recordQuestRun(
      {
        ...result,
        judgeAverage: average,
        judgeVerdicts: verdicts,
        judgeFlagged: flagged,
      } as unknown as QuestResult,
      FILE,
    );
    console.log(
      `${result.provider} ${result.questId}: judge ${average.toFixed(1)}${flagged ? " (flagged)" : ""}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
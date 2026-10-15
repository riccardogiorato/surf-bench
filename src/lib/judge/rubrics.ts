import { createHash } from "crypto";

// Grading rubrics for the judge panel. Each rubric is sent as the system
// message AND salts the verdict cache key, so changing a rubric's text
// invalidates every verdict graded under the old wording.
//
// Anti-gaming rules that apply to every rubric:
//   - the provider's name never appears in a prompt (verdicts must not be
//     attributable to a vendor), and
//   - per-result text is truncated before it reaches the model, so a provider
//     cannot win by returning more prose than its competitors.

export const QUEST_RUBRIC =
  "You are a strict but fair judge at a web-benchmark contest. Given a QUESTION and CONTENT fetched from the web, score 0-10 whether the content contains a usable answer to the question. 10 = the answer is present, specific and quotable. 7-9 = answer is present but partial. 4-6 = only partially relevant. 1-3 = mostly irrelevant. 0 = nothing usable (blocked page, login wall, boilerplate). Judge only what is present in CONTENT; never use your own knowledge to fill a gap. Length is not quality: a long page of navigation, cookie notices or related-article lists scores 0-3 no matter how many characters it has.";

// Grades the ranked result list an agent sees BEFORE fetching anything:
// title + url + a capped snippet. This is the dimension the old substring
// assertions pretended to measure.
export const SEARCH_RESULTS_RUBRIC =
  "You are a strict but fair judge of web search quality. Given a QUESTION and a ranked list of search results (title, url, snippet), score 0-10 how well this result set would let a capable agent answer the question. Consider: does a result actually address the question, is it ranked near the top, and is the source trustworthy for this kind of question. 10 = the top results directly answer it from sources you would cite. 7-9 = answerable, but the best source is ranked low or the answer needs assembling. 4-6 = on-topic but the specific answer is probably not there. 1-3 = mostly off-topic, SEO filler or the wrong entity. 0 = unusable or empty. Penalise duplicate domains, listicles and content farms. Do not reward verbose snippets: judge whether the RIGHT pages were found and ranked, not how much text came back.";

// Separates real page body from shells: a scraper that returns a cookie
// banner plus a nav tree should not pass the scrape event.
export const SCRAPE_SUBSTANCE_RUBRIC =
  "You are a strict judge of web page extraction quality. Given the TARGET PAGE description and the EXTRACTED CONTENT a scraper returned, score 0-10 how usable this extraction is as the page's actual content. 10 = the main body of the expected page, cleanly extracted. 7-9 = the main content is present with some navigation or boilerplate mixed in. 4-6 = partial content: only a fraction of the main body (e.g. an article cut off after its opening paragraphs, a product page missing its price and details), or content heavily diluted by menus, footers, cookie notices or related links. 1-3 = almost entirely boilerplate, navigation, a teaser or metadata stub, or a different page than requested. 0 = a block page, captcha, login wall, consent interstitial, or an error. Lists, tables and data (listings, box scores, forecasts, rankings) are substantive content when they are what the page is for. Length is not quality: a short page extracted completely deserves a high score, and padding earns nothing. Judge only whether the page's substantive content is there, and how much of it.";

// Stamped on each graded scrape record so verdicts from an older wording are
// recognised as stale instead of being scored under the new pass threshold.
export const SCRAPE_RUBRIC_ID = createHash("sha256")
  .update(SCRAPE_SUBSTANCE_RUBRIC)
  .digest("hex")
  .slice(0, 12);

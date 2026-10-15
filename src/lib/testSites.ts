import { TestSite } from "./types.js";

// Comprehensive test sites for web scraper evaluation
// Includes real-world use cases (jobs, real estate, social media) and content quality sites (academic, news, technical, e-commerce)
//
// 2026-10 audit fix: several sites here used to be internal SERPs, hub/section pages, or a
// fabricated address (Zillow's 123-Main-St-Anytown placeholder). Those always return thin,
// near-identical shells regardless of scraper quality, so the deterministic substance score
// couldn't tell a good extraction from a bad one. Every entry below now targets a concrete
// destination page (a specific listing, article, or product) — the kind of page an agent
// doing a real fetch would actually want. Product/listing URLs can rot over time (SKUs get
// discontinued, individual posts expire); when that happens the harness correctly reports it
// as a scrape error (empty/blocked), not a quality score, but the list still needs periodic
// re-curation — treat staleness here the same as any other maintenance item.

// Job listing test sites - structured employment data
const jobListingTestSites: TestSite[] = [
  {
    name: "Weworkremotely Remote Full Stack Jobs",
    url: "https://weworkremotely.com/categories/remote-full-stack-programming-jobs#job-listings",
    category: "jobs"
  },
  {
    // Was an Indeed query-string search page (a SERP). Indeed's own job postings churn too
    // fast to pin a stable one, so this points at a company review page instead — a
    // specific, durable, content-rich destination in the same "jobs" vertical.
    name: "Indeed Company Reviews",
    url: "https://www.indeed.com/cmp/Google/reviews",
    category: "jobs"
  },
  {
    // Was a ZipRecruiter search-results redirect URL. ZipRecruiter's salary guide pages are
    // specific, substantive, and far more stable than individual job postings.
    name: "ZipRecruiter Plumber Salary Guide",
    url: "https://www.ziprecruiter.com/Salaries/Qualified-Plumber-Salary",
    category: "jobs"
  }
];

// Real estate test sites - property listings and details
const realEstateTestSites: TestSite[] = [
  {
    // Was "https://www.zillow.com/homedetails/123-Main-St-Anytown-CA-90210/12345_zpid/" — a
    // fabricated placeholder address that 404s. Individual Zillow listings also rotate as
    // homes sell, so this points at Zillow's own evergreen state housing-market data page.
    name: "Zillow Texas Housing Market",
    url: "https://www.zillow.com/home-values/54/tx/",
    category: "realestate"
  },
  {
    // Was "https://www.zillow.com/prattville-al/" — a generic city browse page mislabeled as
    // a condo listing. Replaced with another Zillow Home Values Index page for consistency.
    name: "Zillow Maine Housing Market",
    url: "https://www.zillow.com/home-values/28/me/",
    category: "realestate"
  },
  {
    // Was "https://www.realtor.com/realestateforsale" — a generic nationwide search landing
    // page. Replaced with a real, specific Realtor.com advice article.
    name: "Realtor.com Home Affordability Advice",
    url: "https://www.realtor.com/advice/buy/afford-the-home-when-numbers-dont-add-up/",
    category: "realestate"
  },
  {
    // Was "https://www.redfin.com/houses-near-me" — a geo-personalized page with no fixed
    // location, unlikely to resolve to real content for a server-side fetch. Replaced with
    // Redfin's own stable per-city housing-market data page.
    name: "Redfin Austin Housing Market",
    url: "https://www.redfin.com/city/30818/TX/Austin/housing-market",
    category: "realestate"
  }
];

// Social media test sites - public profiles and posts (within ToS)
const socialMediaTestSites: TestSite[] = [
  {
    name: "Instagram NASA Profile",
    url: "https://www.instagram.com/nasa/",
    category: "social"
  },
  {
    name: "Instagram National Geographic Profile",
    url: "https://www.instagram.com/natgeo/",
    category: "social"
  },
  {
    name: "X.com Elon Musk Profile",
    url: "https://x.com/elonmusk",
    category: "social"
  },
  {
    name: "X.com Together Compute Profile",
    url: "https://x.com/togethercompute",
    category: "social"
  },
];

// Academic test sites - research papers and scholarly content
const academicTestSites: TestSite[] = [
  // Was arxiv.org/abs/2301.00001 — a sequential placeholder ID, not a real paper. Replaced
  // with a genuine, famous, permanently-indexed paper.
  { name: "arXiv Attention Is All You Need Paper", url: "https://arxiv.org/abs/1706.03762", category: "academic" },
  // Was pubmed.ncbi.nlm.nih.gov/36000000/ — a placeholder PMID. Replaced with the real,
  // landmark Human Genome Project paper (Nature, 2001).
  { name: "PubMed Human Genome Paper", url: "https://pubmed.ncbi.nlm.nih.gov/11237011/", category: "academic" },
  // Was ieeexplore.ieee.org/document/9000000 — a placeholder document ID. Replaced with the
  // real, highly-cited ResNet paper (CVPR 2016).
  { name: "IEEE Xplore ResNet Paper", url: "https://ieeexplore.ieee.org/document/7780459/", category: "academic" }
];

// News test sites - articles with potential paywalls
const newsTestSites: TestSite[] = [
  // These three used to be section/hub pages (lists of headline blurbs), not articles. Each
  // now points at one specific, substantive, evergreen-style piece.
  { name: "BBC Future Subsea Cables Article", url: "https://www.bbc.com/future/article/20241014-the-deep-sea-emergency-service-that-keeps-the-internet-running", category: "news" },
  { name: "Reuters CDS Explainer Article", url: "https://www.reuters.com/business/finance/global-markets-cds-explainer-2026-07-29/", category: "news" },
  { name: "New York Times LLM Explainer", url: "https://www.nytimes.com/2023/03/28/technology/ai-chatbots-chatgpt-bing-bard-llm.html", category: "news" }
];

// Technical documentation sites - structured content with code examples
const technicalTestSites: TestSite[] = [
  { name: "MDN Web API Documentation", url: "https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API", category: "technical" },
  { name: "Stack Overflow Question", url: "https://stackoverflow.com/questions/979256/sorting-an-array-of-objects-by-property-values", category: "technical" },
  { name: "GitHub TypeScript README", url: "https://github.com/microsoft/TypeScript/blob/main/README.md", category: "technical" }
];

// E-commerce sites - product information and structured data
const ecommerceTestSites: TestSite[] = [
  { name: "Amazon Product Page", url: "https://www.amazon.com/New-Amazon-Kindle-glare-free-adjustable/dp/B0DDZQTYHL", category: "ecommerce" },
  { name: "Shopify merch store", url: "https://shopify.supply/products/shopify-counter", category: "ecommerce" },
  { name: "Tesla Store Product", url: "https://shop.tesla.com/product/model-s-key-fob", category: "ecommerce" }
];

// High-traffic and common scrape targets - added from current web traffic and marketplace rankings
const popularWebTestSites: TestSite[] = [
  { name: "YouTube TED Channel", url: "https://www.youtube.com/@TED", category: "social" },
  { name: "Reddit Technology Community", url: "https://www.reddit.com/r/technology/", category: "social" },
  { name: "Wikipedia Artificial Intelligence", url: "https://en.wikipedia.org/wiki/Artificial_intelligence", category: "technical" },
  { name: "Facebook NASA Page", url: "https://www.facebook.com/NASA/", category: "social" },
  { name: "LinkedIn OpenAI Company", url: "https://www.linkedin.com/company/openai/", category: "social" },
  { name: "TikTok NASA Profile", url: "https://www.tiktok.com/@nasa", category: "social" },
  { name: "Pinterest Home Decor Ideas", url: "https://www.pinterest.com/search/pins/?q=home%20decor", category: "social" },
  { name: "IMDb Top Movies", url: "https://www.imdb.com/chart/top/", category: "extra" },
  { name: "ESPN NBA Scores", url: "https://www.espn.com/nba/scoreboard", category: "extra" },
  { name: "Weather.com New York Forecast", url: "https://weather.com/weather/today/l/USNY0996:1:US", category: "extra" },
  // Was a /world hub page (headline list). Replaced with one specific, substantive explainer.
  { name: "CNN Arctic Race Explainer", url: "https://www.cnn.com/2026/01/21/world/arctic-race-security-trump-explainer", category: "news" },
  // Was a /tech hub page. Replaced with one specific, long-form feature article.
  { name: "The Verge AI Safety Feature", url: "https://www.theverge.com/ai-artificial-intelligence/996563/ai-safety-research-metr-redwood-openai-anthropic", category: "news" },
  // Was a /hub/technology page (literally named "hub" in the URL). Replaced with a specific
  // AP explainer article.
  { name: "AP News Crypto Explainer", url: "https://apnews.com/article/cryptocurrency-technology-business-environment-blockchain-0075f9c32e9680c4657890c06a62669b", category: "news" },
  // Was an eBay keyword search page. Individual eBay auction/BIN listings churn too fast to
  // pin a stable one, so this points at eBay's own permanent help-center article — a
  // first-party, substantive destination page, not a user search query.
  { name: "eBay Returns and Refunds Help Article", url: "https://www.ebay.com/help/buying/returns-refunds/returns-refunds?id=4041", category: "ecommerce" },
  // Was a Walmart keyword search page. Replaced with a specific flagship product page.
  { name: "Walmart AirPods Pro Product Page", url: "https://www.walmart.com/ip/Apple-AirPods-Pro-with-MagSafe-USB-C-Charging-Case-2nd-Gen/15191113204", category: "ecommerce" },
  // Was "https://www.etsy.com/search?q=handmade+mug" — the internal search page explicitly
  // called out as an unlikely production target. Replaced with a specific, established
  // listing (15.9k+ sales, real reviews) in the same mug category.
  { name: "Etsy Car Lover Mug Listing", url: "https://www.etsy.com/listing/987071048/life-is-too-short-to-drive-boring-cars", category: "ecommerce" },
  // Was a Target keyword search page. Replaced with a specific flagship product page.
  { name: "Target AirPods Pro Product Page", url: "https://www.target.com/p/airpods-pro-2nd-generation-with-magsafe-case-usb-c/-/A-85978622", category: "ecommerce" },
  // Was a Home Depot keyword search page. Replaced with a specific, long-standing, highly
  // reviewed (10k+ reviews) product page.
  { name: "Home Depot DeWalt Drill Product Page", url: "https://www.homedepot.com/p/DEWALT-20V-MAX-Cordless-1-2-in-Drill-Driver-2-20V-1-3Ah-Batteries-Charger-and-Bag-DCD771C2/204279858", category: "ecommerce" },
  // Was a Best Buy keyword search page. Replaced with the current flagship MacBook Air page.
  { name: "Best Buy MacBook Air Product Page", url: "https://www.bestbuy.com/product/apple-macbook-air-13-inch-laptop-m5-chip-with-10-core-cpu-and-8-core-gpu-16gb-memory-512gb-ssd-midnight/JJGCQLKXL7", category: "ecommerce" },
  // Kept as a search/listing page intentionally: individual Craigslist posts expire within
  // days, making the category search page the more stable, representative destination for
  // this marketplace (there's no durable "single listing" equivalent).
  { name: "Craigslist NYC Apartments", url: "https://newyork.craigslist.org/search/apa", category: "realestate" },
  // Was a generic Yelp search-results page. Replaced with a specific, well-reviewed business
  // profile — a real destination page, not a query.
  { name: "Yelp Blue Bottle Coffee Jackson Square", url: "https://www.yelp.com/biz/blue-bottle-coffee-jackson-square-san-francisco-2", category: "extra" },
  // Was a generic "all hotels in a city" listing page. Replaced with one specific, well-known
  // hotel's review page.
  { name: "Tripadvisor The Plaza Hotel Reviews", url: "https://www.tripadvisor.com/Hotel_Review-g60763-d675616-Reviews-The_Plaza_New_York_A_Fairmont_Managed_Hotel-New_York_City_New_York.html", category: "extra" },
  // Was a Booking.com search-results page. Replaced with one specific hotel's property page.
  { name: "Booking.com The Plaza Hotel Page", url: "https://www.booking.com/hotel/us/the-plaza.html", category: "extra" },
  { name: "Apple iPhone Product", url: "https://www.apple.com/iphone-16/", category: "ecommerce" },
  { name: "Hacker News Front Page", url: "https://news.ycombinator.com/", category: "technical" }
];

// Extra test sites - additional sites for testing
const extraTestSites: TestSite[] = [
  { name: "Together AI", url: "https://www.together.ai/", category: "extra" },
  { name: "Nutlope", url: "https://www.nutlope.com/", category: "extra" }
];

// All test sites combined - real-world and content quality
export const ALL_TEST_SITES: TestSite[] = [
  ...jobListingTestSites,
  ...realEstateTestSites,
  ...socialMediaTestSites,
  ...academicTestSites,
  ...newsTestSites,
  ...technicalTestSites,
  ...ecommerceTestSites,
  ...popularWebTestSites,
  ...extraTestSites
].sort((a, b) => a.name.localeCompare(b.name));

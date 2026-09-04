import { TestSite } from "./types.js";

// Comprehensive test sites for web scraper evaluation
// Includes real-world use cases (jobs, real estate, social media) and content quality sites (academic, news, technical, e-commerce)

// Job listing test sites - structured employment data
export const jobListingTestSites: TestSite[] = [
  {
    name: "Weworkremotely Remote Full Stack Jobs",
    url: "https://weworkremotely.com/categories/remote-full-stack-programming-jobs#job-listings",
    category: "jobs"
  },
  {
    name: "Indeed Product Manager Usa Jobs",
    url: "https://www.indeed.com/q-product-manager-usa-jobs.html",
    category: "jobs"
  },
  {
    name: "ZipRecruiter Plumber Jobs",
    url: "https://www.ziprecruiter.ie/jobs/search?q=Journeyman+Plumber&utm_source=zr-go-redirect",
    category: "jobs"
  }
];

// Real estate test sites - property listings and details
export const realEstateTestSites: TestSite[] = [
  {
    name: "Zillow Single Family Home",
    url: "https://www.zillow.com/homedetails/123-Main-St-Anytown-CA-90210/12345_zpid/",
    category: "realestate"
  },
  {
    name: "Zillow Condo Listing",
    url: "https://www.zillow.com/prattville-al/",
    category: "realestate"
  },
  {
    name: "Realtor.com Property Details",
    url: "https://www.realtor.com/realestateforsale",
    category: "realestate"
  },
  {
    name: "Redfin Home Listing",
    url: "https://www.redfin.com/houses-near-me",
    category: "realestate"
  }
];

// Social media test sites - public profiles and posts (within ToS)
export const socialMediaTestSites: TestSite[] = [
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
export const academicTestSites: TestSite[] = [
  { name: "arXiv Computer Science Paper", url: "https://arxiv.org/abs/2301.00001", category: "academic" },
  { name: "PubMed Medical Article", url: "https://pubmed.ncbi.nlm.nih.gov/36000000/", category: "academic" },
  { name: "IEEE Xplore Technical Paper", url: "https://ieeexplore.ieee.org/document/9000000", category: "academic" }
];

// News test sites - articles with potential paywalls
export const newsTestSites: TestSite[] = [
  { name: "BBC Technology News", url: "https://www.bbc.com/news/technology", category: "news" },
  { name: "Reuters Business Article", url: "https://www.reuters.com/business/", category: "news" },
  { name: "New York Times Technology", url: "https://www.nytimes.com/section/technology", category: "news" }
];

// Technical documentation sites - structured content with code examples
export const technicalTestSites: TestSite[] = [
  { name: "MDN Web API Documentation", url: "https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API", category: "technical" },
  { name: "Stack Overflow Question", url: "https://stackoverflow.com/questions/979256/sorting-an-array-of-objects-by-property-values", category: "technical" },
  { name: "GitHub TypeScript README", url: "https://github.com/microsoft/TypeScript/blob/main/README.md", category: "technical" }
];

// E-commerce sites - product information and structured data
export const ecommerceTestSites: TestSite[] = [
  { name: "Amazon Product Page", url: "https://www.amazon.com/New-Amazon-Kindle-glare-free-adjustable/dp/B0DDZQTYHL", category: "ecommerce" },
  { name: "Shopify merch store", url: "https://shopify.supply/products/shopify-counter", category: "ecommerce" },
  { name: "Tesla Store Product", url: "https://shop.tesla.com/product/model-s-key-fob", category: "ecommerce" }
];

// High-traffic and common scrape targets - added from current web traffic and marketplace rankings
export const popularWebTestSites: TestSite[] = [
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
  { name: "CNN World News", url: "https://www.cnn.com/world", category: "news" },
  { name: "The Verge Tech News", url: "https://www.theverge.com/tech", category: "news" },
  { name: "AP News Technology", url: "https://apnews.com/hub/technology", category: "news" },
  { name: "eBay Wireless Headphones Search", url: "https://www.ebay.com/sch/i.html?_nkw=wireless+headphones", category: "ecommerce" },
  { name: "Walmart Wireless Headphones Search", url: "https://www.walmart.com/search?q=wireless+headphones", category: "ecommerce" },
  { name: "Etsy Handmade Mug Search", url: "https://www.etsy.com/search?q=handmade+mug", category: "ecommerce" },
  { name: "Target Wireless Headphones Search", url: "https://www.target.com/s?searchTerm=wireless+headphones", category: "ecommerce" },
  { name: "Home Depot Cordless Drill Search", url: "https://www.homedepot.com/s/cordless%20drill", category: "ecommerce" },
  { name: "Best Buy Laptop Search", url: "https://www.bestbuy.com/site/searchpage.jsp?st=laptop", category: "ecommerce" },
  { name: "Craigslist NYC Apartments", url: "https://newyork.craigslist.org/search/apa", category: "realestate" },
  { name: "Yelp San Francisco Coffee", url: "https://www.yelp.com/search?find_desc=Coffee&find_loc=San+Francisco%2C+CA", category: "extra" },
  { name: "Tripadvisor NYC Hotels", url: "https://www.tripadvisor.com/Hotels-g60763-New_York_City_New_York-Hotels.html", category: "extra" },
  { name: "Booking.com NYC Hotels", url: "https://www.booking.com/searchresults.html?ss=New+York", category: "extra" },
  { name: "Apple iPhone Product", url: "https://www.apple.com/iphone-16/", category: "ecommerce" },
  { name: "Hacker News Front Page", url: "https://news.ycombinator.com/", category: "technical" }
];

// Extra test sites - additional sites for testing
export const extraTestSites: TestSite[] = [
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

import { describe, expect, it } from "vitest"

import {
  type FeedDirectoryFeed,
  feedDirectoryCategories,
  feedDirectoryFeeds,
  getFeedDirectoryCategory,
  getFeedDirectoryFeed,
  isDirectoryFeedSubscribed,
  listFeedDirectoryFeeds,
  validateFeedDirectoryCatalog,
} from "./feed-directory"

const expectedUsGeneralFeedRecords = [
  {
    aliases: ["http://feeds.abcnews.com/abcnews/usheadlines"],
    categoryId: "us-general",
    id: "abc-news-us",
    label: "ABC News - U.S.",
    source: "abcnews.com",
    url: "https://abcnews.com/abcnews/usheadlines",
  },
  {
    aliases: [],
    categoryId: "us-general",
    id: "cnn-top-stories",
    label: "CNN Top Stories",
    source: "cnn.com",
    url: "http://rss.cnn.com/rss/cnn_topstories.rss",
  },
  {
    aliases: ["http://www.cbsnews.com/latest/rss/main"],
    categoryId: "us-general",
    id: "cbs-news-latest",
    label: "CBS News - Latest",
    source: "cbsnews.com",
    url: "https://www.cbsnews.com/latest/rss/main",
  },
  {
    aliases: [
      "http://www.nytimes.com/services/xml/rss/nyt/National.xml",
      "https://www.nytimes.com/services/xml/rss/nyt/National.xml",
    ],
    categoryId: "us-general",
    id: "nyt-us",
    label: "New York Times - U.S.",
    source: "nytimes.com",
    url: "https://rss.nytimes.com/services/xml/rss/nyt/US.xml",
  },
  {
    aliases: ["http://online.wsj.com/xml/rss/3_7085.xml"],
    categoryId: "us-general",
    id: "wsj-us-news",
    label: "Wall Street Journal - U.S. News",
    source: "wsj.com",
    url: "https://feeds.content.dowjones.io/public/rss/RSSUSnews",
  },
  {
    aliases: ["http://rss.csmonitor.com/feeds/usa"],
    categoryId: "us-general",
    id: "cs-monitor-usa",
    label: "Christian Science Monitor - USA",
    source: "csmonitor.com",
    url: "https://rss.csmonitor.com/feeds/usa",
  },
  {
    aliases: ["http://feeds.nbcnews.com/feeds/topstories"],
    categoryId: "us-general",
    id: "nbc-top-stories",
    label: "NBC News - Top Stories",
    source: "nbcnews.com",
    url: "https://feeds.nbcnews.com/nbcnews/public/news",
  },
  {
    aliases: ["http://feeds.nbcnews.com/feeds/worldnews"],
    categoryId: "us-general",
    id: "nbc-world",
    label: "NBC News - World",
    source: "nbcnews.com",
    url: "https://feeds.nbcnews.com/nbcnews/public/world",
  },
  {
    aliases: ["http://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml"],
    categoryId: "us-general",
    id: "bbc-us-canada",
    label: "BBC News - U.S. & Canada",
    source: "bbc.co.uk",
    url: "https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml",
  },
  {
    aliases: ["http://news.yahoo.com/rss/us"],
    categoryId: "us-general",
    id: "yahoo-us",
    label: "Yahoo News - U.S.",
    source: "yahoo.com",
    url: "https://news.yahoo.com/rss/us",
  },
  {
    aliases: ["http://rss.news.yahoo.com/rss/world"],
    categoryId: "us-general",
    id: "yahoo-world",
    label: "Yahoo News - World",
    source: "yahoo.com",
    url: "https://news.yahoo.com/rss/world",
  },
  {
    aliases: ["http://feeds.feedburner.com/thedailybeast/articles"],
    categoryId: "us-general",
    id: "daily-beast-latest",
    label: "The Daily Beast - Latest",
    source: "thedailybeast.com",
    url: "https://feeds.feedburner.com/thedailybeast/articles",
  },
  {
    aliases: ["http://qz.com/feed"],
    categoryId: "us-general",
    id: "quartz",
    label: "Quartz",
    source: "qz.com",
    url: "https://qz.com/rss",
  },
  {
    aliases: ["http://www.theguardian.com/world/usa/rss"],
    categoryId: "us-general",
    id: "guardian-us",
    label: "The Guardian - U.S. News",
    source: "theguardian.com",
    url: "https://www.theguardian.com/us-news/rss",
  },
  {
    aliases: ["http://www.politico.com/rss/politicopicks.xml"],
    categoryId: "us-general",
    id: "politico-politics",
    label: "Politico - Politics",
    source: "politico.com",
    url: "https://rss.politico.com/politics-news.xml",
  },
  {
    aliases: ["http://www.newyorker.com/feed/news"],
    categoryId: "us-general",
    id: "new-yorker-news",
    label: "The New Yorker - News",
    source: "newyorker.com",
    url: "https://www.newyorker.com/feed/news",
  },
  {
    aliases: ["http://feeds.feedburner.com/NationPBSNewsHour"],
    categoryId: "us-general",
    id: "pbs-newshour-nation",
    label: "PBS NewsHour - Nation",
    source: "pbs.org",
    url: "https://feeds.feedburner.com/NationPBSNewsHour",
  },
  {
    aliases: ["http://feeds.feedburner.com/NewshourWorld"],
    categoryId: "us-general",
    id: "pbs-newshour-world",
    label: "PBS NewsHour - World",
    source: "pbs.org",
    url: "https://feeds.feedburner.com/NewshourWorld",
  },
  {
    aliases: ["http://www.npr.org/rss/rss.php?id=1003"],
    categoryId: "us-general",
    id: "npr-national",
    label: "NPR - National",
    source: "npr.org",
    url: "https://feeds.npr.org/1003/rss.xml",
  },
  {
    aliases: ["http://www.npr.org/rss/rss.php?id=1004"],
    categoryId: "us-general",
    id: "npr-world",
    label: "NPR - World",
    source: "npr.org",
    url: "https://feeds.npr.org/1004/rss.xml",
  },
  {
    aliases: ["http://feeds.feedburner.com/AtlanticNational"],
    categoryId: "us-general",
    id: "atlantic-us",
    label: "The Atlantic - U.S.",
    source: "theatlantic.com",
    url: "https://feeds.feedburner.com/AtlanticNational",
  },
  {
    aliases: ["http://www.latimes.com/nation/rss2.0.xml"],
    categoryId: "us-general",
    id: "la-times-nation",
    label: "Los Angeles Times - Nation",
    source: "latimes.com",
    url: "https://www.latimes.com/nation/rss2.0.xml",
  },
  {
    aliases: ["http://www.latimes.com/world/rss2.0.xml"],
    categoryId: "us-general",
    id: "la-times-world",
    label: "Los Angeles Times - World",
    source: "latimes.com",
    url: "https://www.latimes.com/world/rss2.0.xml",
  },
  {
    aliases: ["http://talkingpointsmemo.com/feed/livewire"],
    categoryId: "us-general",
    id: "talking-points-memo",
    label: "Talking Points Memo",
    source: "talkingpointsmemo.com",
    url: "https://talkingpointsmemo.com/feed",
  },
  {
    aliases: ["http://www.salon.com/category/news/feed/rss/"],
    categoryId: "us-general",
    id: "salon-news",
    label: "Salon - News",
    source: "salon.com",
    url: "https://www.salon.com/category/news/feed",
  },
  {
    aliases: ["http://time.com/newsfeed/feed/"],
    categoryId: "us-general",
    id: "time",
    label: "TIME",
    source: "time.com",
    url: "https://time.com/newsfeed/feed/",
  },
  {
    aliases: ["http://feeds.foxnews.com/foxnews/latest?format=xml"],
    categoryId: "us-general",
    id: "fox-news-latest",
    label: "Fox News - Latest",
    source: "foxnews.com",
    url: "https://moxie.foxnews.com/google-publisher/latest.xml?format=xml",
  },
]

const expectedUsPoliticsFeedRecords = [
  {
    aliases: ["http://www.politico.com/rss/magazine.xml"],
    categoryId: "us-politics",
    id: "politico-magazine",
    label: "Politico Magazine",
    source: "politico.com",
    url: "https://rss.politico.com/magazine.xml",
  },
  {
    aliases: ["http://www.politico.com/rss/Top10Blogs.xml"],
    categoryId: "us-politics",
    id: "politico-politics-news",
    label: "Politico - Politics",
    source: "politico.com",
    url: "https://rss.politico.com/politics-news.xml",
  },
  {
    aliases: [
      "http://www.huffingtonpost.com/feeds/verticals/politics/index.xml",
    ],
    categoryId: "us-politics",
    id: "huffpost-politics",
    label: "HuffPost - Politics",
    source: "huffpost.com",
    url: "https://www.huffpost.com/section/politics/feed",
  },
  {
    aliases: [],
    categoryId: "us-politics",
    id: "cnn-politics",
    label: "CNN Politics",
    source: "cnn.com",
    url: "http://rss.cnn.com/rss/cnn_allpolitics.rss",
  },
  {
    aliases: ["http://www.buzzfeed.com/politics.xml"],
    categoryId: "us-politics",
    id: "buzzfeed-politics",
    label: "BuzzFeed News - Politics",
    source: "buzzfeed.com",
    url: "https://www.buzzfeed.com/politics.xml",
  },
  {
    aliases: ["http://feeds.nbcnews.com/feeds/nbcpolitics"],
    categoryId: "us-politics",
    id: "nbc-politics",
    label: "NBC News - Politics",
    source: "nbcnews.com",
    url: "https://feeds.nbcnews.com/nbcnews/public/politics",
  },
  {
    aliases: ["http://feeds.foxnews.com/foxnews/politics"],
    categoryId: "us-politics",
    id: "fox-news-politics",
    label: "Fox News - Politics",
    source: "foxnews.com",
    url: "https://moxie.foxnews.com/google-publisher/politics.xml",
  },
  {
    aliases: ["http://feeds.washingtonpost.com/rss/rss_election-2012"],
    categoryId: "us-politics",
    id: "washington-post-politics",
    label: "Washington Post - Politics",
    source: "washingtonpost.com",
    url: "https://feeds.washingtonpost.com/rss/politics",
  },
  {
    aliases: [
      "http://rss.nytimes.com/services/xml/rss/nyt/Politics.xml",
      "http://thecaucus.blogs.nytimes.com/feed/",
    ],
    categoryId: "us-politics",
    id: "nyt-politics",
    label: "New York Times - Politics",
    source: "nytimes.com",
    url: "https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml",
  },
  {
    aliases: ["http://rss.nytimes.com/services/xml/rss/nyt/Upshot.xml"],
    categoryId: "us-politics",
    id: "nyt-upshot",
    label: "New York Times - The Upshot",
    source: "nytimes.com",
    url: "https://rss.nytimes.com/services/xml/rss/nyt/Upshot.xml",
  },
  {
    aliases: ["http://www.reddit.com/r/politics/.rss"],
    categoryId: "us-politics",
    id: "reddit-politics",
    label: "Reddit - r/politics",
    source: "reddit.com",
    url: "https://www.reddit.com/r/politics/.rss",
  },
  {
    aliases: ["http://feeds.dailykos.com/dailykos/index.xml"],
    categoryId: "us-politics",
    id: "daily-kos",
    label: "Daily Kos",
    source: "dailykos.com",
    url: "https://www.dailykos.com/feed/",
  },
  {
    aliases: ["http://www.npr.org/rss/rss.php?id=1014"],
    categoryId: "us-politics",
    id: "npr-politics",
    label: "NPR - Politics",
    source: "npr.org",
    url: "https://feeds.npr.org/1014/rss.xml",
  },
  {
    aliases: ["http://www.rollcall.com/rss/all_news.xml"],
    categoryId: "us-politics",
    id: "roll-call-all",
    label: "Roll Call",
    source: "rollcall.com",
    url: "https://rollcall.com/feed/",
  },
  {
    aliases: ["http://www.rollcall.com/news/?zkDo=showRSS"],
    categoryId: "us-politics",
    id: "roll-call-politics",
    label: "Roll Call - Politics",
    source: "rollcall.com",
    url: "https://rollcall.com/category/politics/feed/",
  },
  {
    aliases: ["http://www.rollcall.com/politics/archives/?zkDo=showRSS"],
    categoryId: "us-politics",
    id: "roll-call-congress",
    label: "Roll Call - Congress",
    source: "rollcall.com",
    url: "https://rollcall.com/category/congress/feed/",
  },
  {
    aliases: ["http://www.rollcall.com/policy/archives/?zkDo=showRSS"],
    categoryId: "us-politics",
    id: "roll-call-policy",
    label: "Roll Call - Policy",
    source: "rollcall.com",
    url: "https://rollcall.com/category/policy/feed/",
  },
  {
    aliases: ["http://www.thenation.com/rss/articles"],
    categoryId: "us-politics",
    id: "nation-articles",
    label: "The Nation - Articles",
    source: "thenation.com",
    url: "https://www.thenation.com/feed/?post_type=article",
  },
  {
    aliases: ["http://www.thenation.com/blogs/rss/politics"],
    categoryId: "us-politics",
    id: "nation-politics",
    label: "The Nation - Politics",
    source: "thenation.com",
    url: "https://www.thenation.com/subject/politics/feed/",
  },
  {
    aliases: ["http://www.thenation.com/blogs/rss/foreign-reporting"],
    categoryId: "us-politics",
    id: "nation-foreign-policy",
    label: "The Nation - Foreign Policy",
    source: "thenation.com",
    url: "https://www.thenation.com/subject/foreign-policy/feed/",
  },
  {
    aliases: ["http://www.washingtontimes.com/rss/headlines/news/politics/"],
    categoryId: "us-politics",
    id: "washington-times-politics",
    label: "Washington Times - Politics",
    source: "washingtontimes.com",
    url: "https://www.washingtontimes.com/rss/headlines/news/politics/",
  },
  {
    aliases: [],
    categoryId: "us-politics",
    id: "real-clear-politics",
    label: "RealClearPolitics",
    source: "realclearpolitics.com",
    url: "http://feeds.feedburner.com/realclearpolitics/qlMj",
  },
  {
    aliases: [],
    categoryId: "us-politics",
    id: "breitbart",
    label: "Breitbart News",
    source: "breitbart.com",
    url: "http://feeds.feedburner.com/BreitbartFeed",
  },
  {
    aliases: ["http://dailycaller.com/section/politics/feed/"],
    categoryId: "us-politics",
    id: "daily-caller-politics",
    label: "Daily Caller - Politics",
    source: "dailycaller.com",
    url: "https://dailycaller.com/section/politics/feed/",
  },
  {
    aliases: ["https://www.nationalreview.com/rss.xml"],
    categoryId: "us-politics",
    id: "national-review",
    label: "National Review",
    source: "nationalreview.com",
    url: "https://www.nationalreview.com/feed/",
  },
  {
    aliases: [],
    categoryId: "us-politics",
    id: "drudge-report",
    label: "Drudge Report Feed",
    source: "drudgereport.com",
    url: "http://feeds.feedburner.com/DrudgeReportFeed",
  },
  {
    aliases: ["http://feeds.slate.com/slate-101526"],
    categoryId: "us-politics",
    id: "slate",
    label: "Slate",
    source: "slate.com",
    url: "https://slate.com/feeds/all.rss",
  },
  {
    aliases: [],
    categoryId: "us-politics",
    id: "mother-jones-politics",
    label: "Mother Jones - Politics",
    source: "motherjones.com",
    url: "http://feeds.feedburner.com/motherjones/Politics",
  },
  {
    aliases: ["http://www.newrepublic.com/taxonomy/term/17538/feed"],
    categoryId: "us-politics",
    id: "new-republic",
    label: "The New Republic",
    source: "newrepublic.com",
    url: "https://newrepublic.com/rss.xml",
  },
  {
    aliases: ["http://www.redstate.com/feed/"],
    categoryId: "us-politics",
    id: "redstate",
    label: "RedState",
    source: "redstate.com",
    url: "https://redstate.com/feed/",
  },
  {
    aliases: ["http://humanevents.com/feed/", "https://humanevents.com/feed/"],
    categoryId: "us-politics",
    id: "human-events",
    label: "Human Events",
    source: "humanevents.com",
    url: "https://humanevents.com/rss.xml",
  },
  {
    aliases: ["http://twitchy.com/category/us-politics/feed/"],
    categoryId: "us-politics",
    id: "twitchy-politics",
    label: "Twitchy - U.S. Politics",
    source: "twitchy.com",
    url: "https://twitchy.com/category/us-politics/feed/",
  },
  {
    aliases: ["http://talkingpointsmemo.com/feed/all"],
    categoryId: "us-politics",
    id: "talking-points-memo-politics",
    label: "Talking Points Memo",
    source: "talkingpointsmemo.com",
    url: "https://talkingpointsmemo.com/feed",
  },
]

const expectedUsBusinessFeedRecords = [
  {
    aliases: ["http://online.wsj.com/xml/rss/3_7014.xml"],
    categoryId: "us-business",
    id: "wsj-us-business",
    label: "Wall Street Journal - U.S. Business",
    source: "wsj.com",
    url: "https://feeds.content.dowjones.io/public/rss/WSJcomUSBusiness",
  },
  {
    aliases: [
      "http://www.nytimes.com/services/xml/rss/nyt/Business.xml",
      "http://rss.nytimes.com/services/xml/rss/nyt/Business.xml",
    ],
    categoryId: "us-business",
    id: "nyt-business",
    label: "New York Times - Business",
    source: "nytimes.com",
    url: "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml",
  },
  {
    aliases: [
      "http://feeds.washingtonpost.com/rss/rss_storyline",
      "http://feeds.washingtonpost.com/rss/rss_wonkblog",
    ],
    categoryId: "us-business",
    id: "washington-post-business",
    label: "Washington Post - Business",
    source: "washingtonpost.com",
    url: "https://feeds.washingtonpost.com/rss/business",
  },
  {
    aliases: ["http://www.economist.com/feeds/print-sections/77/business.xml"],
    categoryId: "us-business",
    id: "economist-business",
    label: "The Economist - Business",
    source: "economist.com",
    url: "https://www.economist.com/business/rss.xml",
  },
  {
    aliases: [],
    categoryId: "us-business",
    id: "harvard-business-review",
    label: "Harvard Business Review",
    source: "hbr.org",
    url: "http://feeds.harvardbusiness.org/harvardbusiness?format=xml",
  },
  {
    aliases: ["http://au.ibtimes.com/rss/articles/region/1.rss"],
    categoryId: "us-business",
    id: "ibtimes-business",
    label: "International Business Times - Business",
    source: "ibtimes.com",
    url: "https://www.ibtimes.com/rss/business",
  },
  {
    aliases: ["http://www.businessweek.com/search/rssfeed.htm"],
    categoryId: "us-business",
    id: "bloomberg-businessweek",
    label: "Bloomberg Businessweek",
    source: "bloomberg.com",
    url: "https://feeds.bloomberg.com/businessweek/news.rss",
  },
  {
    aliases: ["http://www.huffingtonpost.com/feeds/verticals/business/news.xml"],
    categoryId: "us-business",
    id: "huffpost-business",
    label: "HuffPost - Business",
    source: "huffpost.com",
    url: "https://www.huffpost.com/section/business/feed",
  },
  {
    aliases: [
      "http://www.ft.com/rss/home/us",
      "https://www.ft.com/world/us?format=rss",
    ],
    categoryId: "us-business",
    id: "financial-times-us",
    label: "Financial Times - U.S.",
    source: "ft.com",
    url: "https://www.ft.com/us?format=rss",
  },
  {
    aliases: [],
    categoryId: "us-business",
    id: "cnn-business",
    label: "CNN Business",
    source: "cnn.com",
    url: "http://rss.cnn.com/rss/edition_business.rss",
  },
  {
    aliases: ["http://www.bloomberg.com/feed/podcast/law.xml"],
    categoryId: "us-business",
    id: "bloomberg-law",
    label: "Bloomberg Law",
    source: "bloomberg.com",
    url: "https://feeds.bloomberg.com/podcasts/law.xml",
  },
]

const expectedUsHealthFeedRecords = [
  {
    aliases: [],
    categoryId: "us-health",
    id: "cnn-health",
    label: "CNN Health",
    source: "cnn.com",
    url: "http://rss.cnn.com/rss/cnn_health.rss",
  },
  {
    aliases: [
      "http://www.nytimes.com/services/xml/rss/nyt/Health.xml",
      "http://rss.nytimes.com/services/xml/rss/nyt/Health.xml",
    ],
    categoryId: "us-health",
    id: "nyt-health",
    label: "New York Times - Health",
    source: "nytimes.com",
    url: "https://rss.nytimes.com/services/xml/rss/nyt/Health.xml",
  },
  {
    aliases: ["http://feeds.bbci.co.uk/news/health/rss.xml?edition=us"],
    categoryId: "us-health",
    id: "bbc-health",
    label: "BBC News - Health",
    source: "bbc.co.uk",
    url: "https://feeds.bbci.co.uk/news/health/rss.xml?edition=us",
  },
  {
    aliases: ["http://feeds.abcnews.com/abcnews/healthheadlines"],
    categoryId: "us-health",
    id: "abc-news-health",
    label: "ABC News - Health",
    source: "abcnews.com",
    url: "https://abcnews.com/abcnews/healthheadlines",
  },
  {
    aliases: ["http://feeds.nbcnews.com/feeds/health"],
    categoryId: "us-health",
    id: "nbc-health",
    label: "NBC News - Health",
    source: "nbcnews.com",
    url: "https://feeds.nbcnews.com/nbcnews/public/health",
  },
  {
    aliases: ["http://feeds.huffingtonpost.com/c/35496/f/677071/index.rss"],
    categoryId: "us-health",
    id: "huffpost-health",
    label: "HuffPost - Health",
    source: "huffpost.com",
    url: "https://www.huffpost.com/section/health/feed",
  },
  {
    aliases: ["http://www.theguardian.com/society/health/rss"],
    categoryId: "us-health",
    id: "guardian-health",
    label: "The Guardian - Health",
    source: "theguardian.com",
    url: "https://www.theguardian.com/society/health/rss",
  },
  {
    aliases: ["http://www.menshealth.com/events-promotions/washpofeed"],
    categoryId: "us-health",
    id: "mens-health",
    label: "Men's Health",
    source: "menshealth.com",
    url: "https://www.menshealth.com/rss/all.xml/",
  },
  {
    aliases: ["http://feeds.glamour.com/glamour/health_fitness"],
    categoryId: "us-health",
    id: "glamour-health-fitness",
    label: "Glamour - Health & Fitness",
    source: "glamour.com",
    url: "https://www.glamour.com/feed/health-fitness/rss",
  },
  {
    aliases: ["http://feeds.newscientist.com/health"],
    categoryId: "us-health",
    id: "new-scientist-health",
    label: "New Scientist - Health",
    source: "newscientist.com",
    url: "https://www.newscientist.com/subject/health/feed/",
  },
  {
    aliases: ["http://time.com/health/feed/"],
    categoryId: "us-health",
    id: "time-health",
    label: "TIME - Health",
    source: "time.com",
    url: "https://time.com/health/feed/",
  },
  {
    aliases: ["http://news.yahoo.com/rss/health"],
    categoryId: "us-health",
    id: "yahoo-health",
    label: "Yahoo News - Health",
    source: "yahoo.com",
    url: "https://news.yahoo.com/rss/health",
  },
  {
    aliases: ["http://www.wsj.com/xml/rss/3_7201.xml"],
    categoryId: "us-health",
    id: "wsj-health",
    label: "Wall Street Journal - Health",
    source: "wsj.com",
    url: "https://feeds.content.dowjones.io/public/rss/socialhealth",
  },
  {
    aliases: ["http://feeds.sciencedaily.com/sciencedaily/top_news/top_health"],
    categoryId: "us-health",
    id: "science-daily-health",
    label: "ScienceDaily - Top Health",
    source: "sciencedaily.com",
    url: "https://www.sciencedaily.com/rss/top/health.xml",
  },
  {
    aliases: ["http://khn.org/feed/"],
    categoryId: "us-health",
    id: "kff-health-news",
    label: "KFF Health News",
    source: "kffhealthnews.org",
    url: "https://kffhealthnews.org/feed/",
  },
  {
    aliases: ["http://feeds.lexblog.com/foodsafetynews/mRcs"],
    categoryId: "us-health",
    id: "food-safety-news",
    label: "Food Safety News",
    source: "foodsafetynews.com",
    url: "https://www.foodsafetynews.com/rss/",
  },
  {
    aliases: ["http://feeds.washingtonpost.com/rss/lifestyle"],
    categoryId: "us-health",
    id: "washington-post-lifestyle",
    label: "Washington Post - Lifestyle",
    source: "washingtonpost.com",
    url: "https://feeds.washingtonpost.com/rss/lifestyle",
  },
  {
    aliases: ["http://www.buzzfeed.com/health.xml"],
    categoryId: "us-health",
    id: "buzzfeed-health",
    label: "BuzzFeed - Health",
    source: "buzzfeed.com",
    url: "https://www.buzzfeed.com/health.xml",
  },
  {
    aliases: ["http://vitals.lifehacker.com/rss"],
    categoryId: "us-health",
    id: "lifehacker",
    label: "Lifehacker",
    source: "lifehacker.com",
    url: "https://lifehacker.com/feed/rss",
  },
  {
    aliases: ["http://www.self.com/feed/fitness-news/"],
    categoryId: "us-health",
    id: "self",
    label: "SELF",
    source: "self.com",
    url: "https://www.self.com/feed/rss",
  },
  {
    aliases: ["http://feeds.huffingtonpost.com/c/35496/f/677070/index.rss"],
    categoryId: "us-health",
    id: "huffpost-wellness",
    label: "HuffPost - Wellness",
    source: "huffpost.com",
    url: "https://chaski.huffpost.com/us/auto/vertical/healthy-living",
  },
  {
    aliases: ["http://www.cpsc.gov/en/Newsroom/CPSC-RSS-Feed/Recalls-RSS/"],
    categoryId: "us-health",
    id: "cpsc-recalls",
    label: "CPSC - Recalls",
    source: "cpsc.gov",
    url: "https://www.cpsc.gov/Newsroom/CPSC-RSS-Feed/Recalls-RSS",
  },
  {
    aliases: ["http://www.medpagetoday.com/rss/Headlines.xml"],
    categoryId: "us-health",
    id: "medpage-today",
    label: "MedPage Today",
    source: "medpagetoday.com",
    url: "https://www.medpagetoday.com/rss/headlines.xml",
  },
  {
    aliases: ["http://www.medscape.com/cx/rssfeeds/2700.xml"],
    categoryId: "us-health",
    id: "medscape",
    label: "Medscape Medical News",
    source: "medscape.com",
    url: "https://www.medscape.com/cx/rssfeeds/2700.xml",
  },
  {
    aliases: ["http://www.theguardian.com/lifeandstyle/health-and-wellbeing/rss"],
    categoryId: "us-health",
    id: "guardian-health-wellbeing",
    label: "The Guardian - Health & Wellbeing",
    source: "theguardian.com",
    url: "https://www.theguardian.com/lifeandstyle/health-and-wellbeing/rss",
  },
  {
    aliases: ["http://www.npr.org/rss/rss.php?id=1128"],
    categoryId: "us-health",
    id: "npr-health",
    label: "NPR - Health",
    source: "npr.org",
    url: "https://feeds.npr.org/1128/rss.xml",
  },
]

const expectedUsScienceFeedRecords = [
  {
    aliases: ["http://www.huffingtonpost.com/feeds/verticals/science/index.xml"],
    categoryId: "us-science",
    id: "huffpost-science",
    label: "HuffPost - Science",
    source: "huffpost.com",
    url: "https://www.huffpost.com/section/science/feed",
  },
  {
    aliases: ["http://rss.nytimes.com/services/xml/rss/nyt/Science.xml"],
    categoryId: "us-science",
    id: "nyt-science",
    label: "New York Times - Science",
    source: "nytimes.com",
    url: "https://rss.nytimes.com/services/xml/rss/nyt/Science.xml",
  },
  {
    aliases: ["http://rss.nytimes.com/services/xml/rss/nyt/Space.xml"],
    categoryId: "us-science",
    id: "nyt-space",
    label: "New York Times - Space",
    source: "nytimes.com",
    url: "https://rss.nytimes.com/services/xml/rss/nyt/Space.xml",
  },
  {
    aliases: ["http://feeds.foxnews.com/foxnews/science"],
    categoryId: "us-science",
    id: "fox-news-science",
    label: "Fox News - Science",
    source: "foxnews.com",
    url: "https://moxie.foxnews.com/google-publisher/science.xml",
  },
  {
    aliases: ["http://feeds.nbcnews.com/feeds/science"],
    categoryId: "us-science",
    id: "nbc-science",
    label: "NBC News - Science",
    source: "nbcnews.com",
    url: "https://feeds.nbcnews.com/nbcnews/public/science",
  },
  {
    aliases: [],
    categoryId: "us-science",
    id: "scientific-american-global",
    label: "Scientific American - Global",
    source: "scientificamerican.com",
    url: "http://rss.sciam.com/ScientificAmerican-Global",
  },
  {
    aliases: ["http://feeds.feedburner.com/BreakingScienceNews?format=xml"],
    categoryId: "us-science",
    id: "sci-news",
    label: "Sci.News",
    source: "sci.news",
    url: "https://www.sci.news/feed",
  },
  {
    aliases: [
      "http://feeds.wired.com/wiredscience",
      "http://www.wired.com/category/science/science-blogs/feed/",
    ],
    categoryId: "us-science",
    id: "wired-science",
    label: "WIRED - Science",
    source: "wired.com",
    url: "https://www.wired.com/feed/category/science/latest/rss",
  },
  {
    aliases: ["http://feeds.sciencedaily.com/sciencedaily"],
    categoryId: "us-science",
    id: "science-daily",
    label: "ScienceDaily",
    source: "sciencedaily.com",
    url: "https://www.sciencedaily.com/rss/all.xml",
  },
  {
    aliases: ["http://www.latimes.com/health/rss2.0.xml"],
    categoryId: "us-science",
    id: "la-times-health",
    label: "Los Angeles Times - Health",
    source: "latimes.com",
    url: "https://www.latimes.com/health/rss2.0.xml",
  },
  {
    aliases: ["http://www.chron.com/rss/feed/AP-Technology-and-Science-266.php"],
    categoryId: "us-science",
    id: "chron-ap-technology-science",
    label: "Houston Chronicle - AP Technology and Science",
    source: "chron.com",
    url: "https://www.chron.com/rss/feed/AP-Technology-and-Science-266.php",
  },
  {
    aliases: ["http://feeds.washingtonpost.com/rss/rss_speaking-of-science"],
    categoryId: "us-science",
    id: "washington-post-science",
    label: "Washington Post - Science",
    source: "washingtonpost.com",
    url: "https://feeds.washingtonpost.com/rss/rss_speaking-of-science",
  },
  {
    aliases: ["http://www.sciencemag.org/rss/current.xml"],
    categoryId: "us-science",
    id: "science-magazine",
    label: "Science Magazine",
    source: "science.org",
    url: "https://feeds.science.org/rss/science.xml",
  },
  {
    aliases: [],
    categoryId: "us-science",
    id: "discover-magazine",
    label: "Discover Magazine",
    source: "discovermagazine.com",
    url: "http://feeds.feedburner.com/DiscoverTopStories",
  },
  {
    aliases: ["http://feeds.bbci.co.uk/news/science_and_environment/rss.xml"],
    categoryId: "us-science",
    id: "bbc-science-environment",
    label: "BBC News - Science & Environment",
    source: "bbc.co.uk",
    url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
  },
  {
    aliases: ["http://feeds.howtogeek.com/howtogeek"],
    categoryId: "us-science",
    id: "how-to-geek",
    label: "How-To Geek",
    source: "howtogeek.com",
    url: "https://www.howtogeek.com/feed/",
  },
  {
    aliases: ["http://syndication.howstuffworks.com/rss/science"],
    categoryId: "us-science",
    id: "howstuffworks-science",
    label: "HowStuffWorks - Science",
    source: "howstuffworks.com",
    url: "https://syndication.howstuffworks.com/rss/science",
  },
  {
    aliases: ["http://www.npr.org/templates/rss/podlayer.php?id=1007"],
    categoryId: "us-science",
    id: "npr-science",
    label: "NPR - Science",
    source: "npr.org",
    url: "https://feeds.npr.org/1007/rss.xml",
  },
  {
    aliases: ["http://www.nasa.gov/rss/dyn/breaking_news.rss"],
    categoryId: "us-science",
    id: "nasa-breaking-news",
    label: "NASA - Breaking News",
    source: "nasa.gov",
    url: "https://www.nasa.gov/news-release/feed/",
  },
  {
    aliases: ["http://www.livescience.com/home/feed/site.xml"],
    categoryId: "us-science",
    id: "live-science",
    label: "Live Science",
    source: "livescience.com",
    url: "https://www.livescience.com/feeds.xml",
  },
  {
    aliases: [],
    categoryId: "us-science",
    id: "scientific-american-news",
    label: "Scientific American - News",
    source: "scientificamerican.com",
    url: "http://rss.sciam.com/ScientificAmerican-News",
  },
  {
    aliases: ["http://www.popsci.com/rss.xml"],
    categoryId: "us-science",
    id: "popular-science",
    label: "Popular Science",
    source: "popsci.com",
    url: "https://www.popsci.com/feed/",
  },
  {
    aliases: ["http://nautil.us/rss/all"],
    categoryId: "us-science",
    id: "nautilus",
    label: "Nautilus",
    source: "nautil.us",
    url: "https://nautil.us/feed/",
  },
  {
    aliases: [],
    categoryId: "us-science",
    id: "ars-technica-science",
    label: "Ars Technica - Science",
    source: "arstechnica.com",
    url: "http://feeds.arstechnica.com/arstechnica/science",
  },
  {
    aliases: ["http://www.smithsonianmag.com/rss/science-nature/"],
    categoryId: "us-science",
    id: "smithsonian-science-nature",
    label: "Smithsonian Magazine - Science & Nature",
    source: "smithsonianmag.com",
    url: "https://www.smithsonianmag.com/rss/science-nature/",
  },
  {
    aliases: [
      "http://feeds.gawker.com/io9/full#_ga=1.239815749.772722176.1436906624",
    ],
    categoryId: "us-science",
    id: "io9",
    label: "io9",
    source: "gizmodo.com",
    url: "https://gizmodo.com/io9/feed",
  },
  {
    aliases: ["http://feeds.newscientist.com/science-news"],
    categoryId: "us-science",
    id: "new-scientist",
    label: "New Scientist",
    source: "newscientist.com",
    url: "https://www.newscientist.com/feed/home/",
  },
  {
    aliases: ["http://feeds.newscientist.com/space"],
    categoryId: "us-science",
    id: "new-scientist-space",
    label: "New Scientist - Space",
    source: "newscientist.com",
    url: "https://www.newscientist.com/subject/space/feed/",
  },
  {
    aliases: ["http://www.pnas.org/rss/Feature_Article.xml"],
    categoryId: "us-science",
    id: "pnas",
    label: "PNAS",
    source: "pnas.org",
    url: "https://www.pnas.org/action/showFeed?type=etoc&feed=rss&jc=PNAS",
  },
  {
    aliases: ["http://feeds2.feedburner.com/time/scienceandhealth"],
    categoryId: "us-science",
    id: "time-science",
    label: "TIME - Science",
    source: "time.com",
    url: "https://time.com/science/feed/",
  },
  {
    aliases: ["http://phys.org/rss-feed/"],
    categoryId: "us-science",
    id: "phys-org",
    label: "Phys.org",
    source: "phys.org",
    url: "https://phys.org/rss-feed/",
  },
  {
    aliases: ["http://rss.csmonitor.com/feeds/science"],
    categoryId: "us-science",
    id: "cs-monitor-science",
    label: "Christian Science Monitor - Science",
    source: "csmonitor.com",
    url: "https://rss.csmonitor.com/feeds/science",
  },
  {
    aliases: ["http://news.yahoo.com/rss/science"],
    categoryId: "us-science",
    id: "yahoo-science",
    label: "Yahoo News - Science",
    source: "yahoo.com",
    url: "https://news.yahoo.com/rss/science",
  },
  {
    aliases: ["http://feeds.feedburner.com/IeeeSpectrumFullText"],
    categoryId: "us-science",
    id: "ieee-spectrum",
    label: "IEEE Spectrum",
    source: "spectrum.ieee.org",
    url: "https://spectrum.ieee.org/feeds/feed.rss",
  },
  {
    aliases: ["http://www.theverge.com/science/rss/index.xml"],
    categoryId: "us-science",
    id: "the-verge-science",
    label: "The Verge - Science",
    source: "theverge.com",
    url: "https://www.theverge.com/rss/science/index.xml",
  },
  {
    aliases: ["http://grist.org/feed/"],
    categoryId: "us-science",
    id: "grist",
    label: "Grist",
    source: "grist.org",
    url: "https://grist.org/feed/",
  },
  {
    aliases: ["http://www.theguardian.com/science/rss"],
    categoryId: "us-science",
    id: "guardian-science",
    label: "The Guardian - Science",
    source: "theguardian.com",
    url: "https://www.theguardian.com/science/rss",
  },
  {
    aliases: ["http://www.theguardian.com/us/environment/rss"],
    categoryId: "us-science",
    id: "guardian-us-environment",
    label: "The Guardian - U.S. Environment",
    source: "theguardian.com",
    url: "https://www.theguardian.com/us/environment/rss",
  },
  {
    aliases: ["http://www.viralnova.com/feed"],
    categoryId: "us-science",
    id: "viralnova",
    label: "ViralNova",
    source: "viralnova.com",
    url: "http://viralnova.com/feed/",
  },
]

const expectedFeedRecords = [
  ...expectedUsGeneralFeedRecords,
  ...expectedUsPoliticsFeedRecords,
  ...expectedUsBusinessFeedRecords,
  ...expectedUsHealthFeedRecords,
  ...expectedUsScienceFeedRecords,
]

const expectedUsGeneralFeedIds = expectedUsGeneralFeedRecords.map(
  (feed) => feed.id
)
const expectedUsPoliticsFeedIds = expectedUsPoliticsFeedRecords.map(
  (feed) => feed.id
)
const expectedUsBusinessFeedIds = expectedUsBusinessFeedRecords.map(
  (feed) => feed.id
)
const expectedUsHealthFeedIds = expectedUsHealthFeedRecords.map(
  (feed) => feed.id
)
const expectedUsScienceFeedIds = expectedUsScienceFeedRecords.map(
  (feed) => feed.id
)

describe("feed directory catalog", () => {
  it("contains the approved categories and validates without errors", () => {
    expect(feedDirectoryCategories).toEqual([
      {
        description:
          "National and world reporting from established U.S. newsrooms.",
        id: "us-general",
        label: "US General",
      },
      {
        description:
          "Campaigns, Congress, policy, and political analysis from U.S. outlets.",
        id: "us-politics",
        label: "US Politics",
      },
      {
        description:
          "Markets, companies, economy, and workplace coverage from business outlets.",
        id: "us-business",
        label: "US Business",
      },
      {
        description:
          "Health news, wellness, medicine, and public-health reporting from trusted outlets.",
        id: "us-health",
        label: "US Health",
      },
      {
        description:
          "Science news, space, research, environment, and discovery coverage from major outlets and journals.",
        id: "us-science",
        label: "US Science",
      },
    ])
    expect(validateFeedDirectoryCatalog()).toEqual([])
  })

  it("reports duplicate normalized URLs within one category", () => {
    const runtimeCatalog =
      feedDirectoryFeeds as unknown as FeedDirectoryFeed[]
    const originalLength = runtimeCatalog.length

    try {
      runtimeCatalog.push(
        {
          categoryId: "us-general",
          id: "",
          label: "Empty ID Feed",
          source: "example.com",
          url: "http://EXAMPLE.com:80/collision/?b=2&a=1#first",
        },
        {
          categoryId: "us-general",
          id: "second-owner",
          label: "Second Owner",
          source: "example.com",
          url: "https://example.com/collision?a=1&b=2",
        }
      )

      expect(validateFeedDirectoryCatalog()).toContain(
        'Duplicate normalized URL "https://example.com/collision?a=1&b=2" for feeds "" and "second-owner"'
      )
    } finally {
      runtimeCatalog.splice(originalLength)
    }
  })

  it("contains exactly the approved feed records in order", () => {
    expect(
      feedDirectoryFeeds.map((feed) => ({
        aliases: [...(feed.aliases ?? [])],
        categoryId: feed.categoryId,
        id: feed.id,
        label: feed.label,
        source: feed.source,
        url: feed.url,
      }))
    ).toEqual(expectedFeedRecords)
  })

  it("looks up categories with a first-category fallback", () => {
    expect(getFeedDirectoryCategory("us-general")).toBe(
      feedDirectoryCategories[0]
    )
    expect(getFeedDirectoryCategory("us-politics")).toBe(
      feedDirectoryCategories[1]
    )
    expect(getFeedDirectoryCategory("us-business")).toBe(
      feedDirectoryCategories[2]
    )
    expect(getFeedDirectoryCategory("us-health")).toBe(
      feedDirectoryCategories[3]
    )
    expect(getFeedDirectoryCategory("us-science")).toBe(
      feedDirectoryCategories[4]
    )
    expect(getFeedDirectoryCategory("missing")).toBe(
      feedDirectoryCategories[0]
    )
    expect(getFeedDirectoryCategory()).toBe(feedDirectoryCategories[0])
  })

  it("looks up feeds and lists category feeds in catalog order", () => {
    expect(getFeedDirectoryFeed("nyt-us")).toBe(feedDirectoryFeeds[3])
    expect(getFeedDirectoryFeed("npr-politics")?.url).toBe(
      "https://feeds.npr.org/1014/rss.xml"
    )
    expect(getFeedDirectoryFeed("wsj-us-business")?.url).toBe(
      "https://feeds.content.dowjones.io/public/rss/WSJcomUSBusiness"
    )
    expect(getFeedDirectoryFeed("npr-health")?.url).toBe(
      "https://feeds.npr.org/1128/rss.xml"
    )
    expect(getFeedDirectoryFeed("wired-science")?.url).toBe(
      "https://www.wired.com/feed/category/science/latest/rss"
    )
    expect(getFeedDirectoryFeed("missing")).toBeUndefined()
    expect(listFeedDirectoryFeeds("us-general").map((feed) => feed.id)).toEqual(
      expectedUsGeneralFeedIds
    )
    expect(
      listFeedDirectoryFeeds("us-politics").map((feed) => feed.id)
    ).toEqual(expectedUsPoliticsFeedIds)
    expect(
      listFeedDirectoryFeeds("us-business").map((feed) => feed.id)
    ).toEqual(expectedUsBusinessFeedIds)
    expect(listFeedDirectoryFeeds("us-health").map((feed) => feed.id)).toEqual(
      expectedUsHealthFeedIds
    )
    expect(listFeedDirectoryFeeds("us-science").map((feed) => feed.id)).toEqual(
      expectedUsScienceFeedIds
    )
    expect(listFeedDirectoryFeeds("missing")).toEqual([])
  })

  it("matches New York Times, NBC, politics, business, health, and science legacy aliases", () => {
    const nyt = getFeedDirectoryFeed("nyt-us")
    const nbc = getFeedDirectoryFeed("nbc-top-stories")
    const politics = getFeedDirectoryFeed("npr-politics")
    const huffpost = getFeedDirectoryFeed("huffpost-politics")
    const wsjBusiness = getFeedDirectoryFeed("wsj-us-business")
    const ft = getFeedDirectoryFeed("financial-times-us")
    const bloombergLaw = getFeedDirectoryFeed("bloomberg-law")
    const wsjHealth = getFeedDirectoryFeed("wsj-health")
    const nprHealth = getFeedDirectoryFeed("npr-health")
    const huffpostWellness = getFeedDirectoryFeed("huffpost-wellness")
    const wiredScience = getFeedDirectoryFeed("wired-science")
    const nprScience = getFeedDirectoryFeed("npr-science")
    const scienceDaily = getFeedDirectoryFeed("science-daily")
    const vergeScience = getFeedDirectoryFeed("the-verge-science")

    expect(nyt).toBeDefined()
    expect(nbc).toBeDefined()
    expect(politics).toBeDefined()
    expect(huffpost).toBeDefined()
    expect(wsjBusiness).toBeDefined()
    expect(ft).toBeDefined()
    expect(bloombergLaw).toBeDefined()
    expect(wsjHealth).toBeDefined()
    expect(nprHealth).toBeDefined()
    expect(huffpostWellness).toBeDefined()
    expect(wiredScience).toBeDefined()
    expect(nprScience).toBeDefined()
    expect(scienceDaily).toBeDefined()
    expect(vergeScience).toBeDefined()
    expect(
      isDirectoryFeedSubscribed(nyt!, [
        "http://www.nytimes.com/services/xml/rss/nyt/National.xml",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(nbc!, [
        "http://feeds.nbcnews.com/feeds/topstories",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(politics!, [
        "http://www.npr.org/rss/rss.php?id=1014",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(huffpost!, [
        "http://www.huffingtonpost.com/feeds/verticals/politics/index.xml",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(wsjBusiness!, [
        "http://online.wsj.com/xml/rss/3_7014.xml",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(ft!, ["http://www.ft.com/rss/home/us"])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(bloombergLaw!, [
        "http://www.bloomberg.com/feed/podcast/law.xml",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(wsjHealth!, [
        "http://www.wsj.com/xml/rss/3_7201.xml",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(nprHealth!, [
        "http://www.npr.org/rss/rss.php?id=1128",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(huffpostWellness!, [
        "http://feeds.huffingtonpost.com/c/35496/f/677070/index.rss",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(wiredScience!, [
        "http://feeds.wired.com/wiredscience",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(nprScience!, [
        "http://www.npr.org/templates/rss/podlayer.php?id=1007",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(scienceDaily!, [
        "http://feeds.sciencedaily.com/sciencedaily",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(vergeScience!, [
        "http://www.theverge.com/science/rss/index.xml",
      ])
    ).toBe(true)
  })

  it("normalizes stored HTTP URLs before matching", () => {
    const feed = getFeedDirectoryFeed("fox-news-latest")

    expect(feed).toBeDefined()
    expect(
      isDirectoryFeedSubscribed(feed!, [
        "HTTP://MOXIE.FOXNEWS.COM:80/google-publisher/latest.xml/?format=xml#top",
      ])
    ).toBe(true)
  })

  it("allows the same verified feed to appear in multiple categories", () => {
    const generalPolitico = getFeedDirectoryFeed("politico-politics")
    const politicsPolitico = getFeedDirectoryFeed("politico-politics-news")
    const generalTpm = getFeedDirectoryFeed("talking-points-memo")
    const politicsTpm = getFeedDirectoryFeed("talking-points-memo-politics")

    expect(generalPolitico?.url).toBe(politicsPolitico?.url)
    expect(generalTpm?.url).toBe(politicsTpm?.url)
    expect(validateFeedDirectoryCatalog()).toEqual([])
  })

  it("ignores invalid stored URLs and does not match unrelated URLs", () => {
    const feed = getFeedDirectoryFeed("nyt-us")

    expect(feed).toBeDefined()
    expect(
      isDirectoryFeedSubscribed(feed!, [
        "not a url",
        "ftp://rss.nytimes.com/services/xml/rss/nyt/US.xml",
        "https://example.com/feed.xml",
      ])
    ).toBe(false)
  })

  it("does not include retired or hijacked feeds", () => {
    const directoryUrls = feedDirectoryFeeds.flatMap((feed) => [
      feed.url,
      ...(feed.aliases ?? []),
    ])

    expect(directoryUrls).not.toContain(
      "http://feeds.feedburner.com/TheAtlanticWire"
    )
    expect(directoryUrls).not.toContain(
      "http://www.weeklystandard.com/rss/site.xml"
    )
    expect(directoryUrls).not.toContain(
      "http://feeds.reuters.com/Reuters/PoliticsNews"
    )
    expect(directoryUrls).not.toContain(
      "http://hosted2.ap.org/atom/APDEFAULT/f70471f764144b2fab526d39972d37b3"
    )
    expect(directoryUrls).not.toContain(
      "http://feeds.reuters.com/reuters/businessNews"
    )
    expect(directoryUrls).not.toContain(
      "http://www.business-standard.com/rss/latest.rss"
    )
    expect(directoryUrls).not.toContain(
      "http://www.business-standard.com/rss/home_page_top_stories.rss"
    )
    expect(directoryUrls).not.toContain("http://www.health.harvard.edu/rss.php")
    expect(directoryUrls).not.toContain(
      "http://www.health.com/health/healthy-happy/feed"
    )
    expect(directoryUrls).not.toContain("http://www.forbes.com/health/feed2/")
    expect(directoryUrls).not.toContain(
      "http://feeds.reuters.com/reuters/healthNews"
    )
    expect(directoryUrls).not.toContain(
      "http://www.chicagotribune.com/lifestyles/health/rss2.0.xml"
    )
    expect(directoryUrls).not.toContain(
      "http://www.nydailynews.com/lifestyle/health/index_rss.xml"
    )
    expect(directoryUrls).not.toContain(
      "http://hosted2.ap.org/atom/APDEFAULT/bbd825583c8542898e6fa7d440b9febc"
    )
    expect(directoryUrls).not.toContain(
      "http://www.womenshealthandfitness.com.au/component/obrss/women-s-health-fitnesscombined-feed"
    )
    expect(directoryUrls).not.toContain(
      "http://www.usnews.com/rss/health?int=a7fe09"
    )
    expect(directoryUrls).not.toContain(
      "http://www.healthcareitnews.com/home/feed"
    )
    expect(directoryUrls).not.toContain(
      "http://www.modernhealthcare.com/section/rss01&mime=xml"
    )
    expect(directoryUrls).not.toContain(
      "http://www.mayoclinic.org/rss/all-health-information-topics"
    )
    expect(directoryUrls).not.toContain(
      "http://rss.medicalnewstoday.com/featurednews.xml"
    )
    expect(directoryUrls).not.toContain(
      "http://www.treehugger.com/feeds/category/science/"
    )
    expect(directoryUrls).not.toContain("http://www.eurekalert.org/rss.xml")
    expect(directoryUrls).not.toContain(
      "http://hosted2.ap.org/atom/APDEFAULT/b2f0ca3a594644ee9e50a8ec4ce2d6de"
    )
    expect(directoryUrls).not.toContain(
      "http://omnifeed.com/feed/www.iflscience.com/rss.xml"
    )
    expect(directoryUrls).not.toContain(
      "http://news.nationalgeographic.com/rss/index.rss"
    )
    expect(directoryUrls).not.toContain(
      "http://feeds.reuters.com/reuters/scienceNews"
    )
    expect(directoryUrls).not.toContain(
      "http://feeds.nature.com/nbt/rss/current"
    )
  })
})

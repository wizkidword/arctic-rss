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

const expectedUsSportsFeedRecords = [
  {
    aliases: ["http://rss.nytimes.com/services/xml/rss/nyt/Sports.xml"],
    categoryId: "us-sports",
    id: "nyt-sports",
    label: "New York Times - Sports",
    source: "nytimes.com",
    url: "https://rss.nytimes.com/services/xml/rss/nyt/Sports.xml",
  },
  {
    aliases: ["http://www.buzzfeed.com/sports.xml"],
    categoryId: "us-sports",
    id: "buzzfeed-sports",
    label: "BuzzFeed - Sports",
    source: "buzzfeed.com",
    url: "https://www.buzzfeed.com/sports.xml",
  },
  {
    aliases: [],
    categoryId: "us-sports",
    id: "fox-news-sports",
    label: "Fox News - Sports",
    source: "foxnews.com",
    url: "http://feeds.foxnews.com/foxnews/sports",
  },
  {
    aliases: [],
    categoryId: "us-sports",
    id: "sb-nation",
    label: "SB Nation",
    source: "sbnation.com",
    url: "http://feeds.sbnation.com/rss/streams",
  },
  {
    aliases: ["http://sports.espn.go.com/espn/rss/news"],
    categoryId: "us-sports",
    id: "espn-top-news",
    label: "ESPN - Top News",
    source: "espn.com",
    url: "https://www.espn.com/espn/rss/news",
  },
  {
    aliases: ["http://www.latimes.com/sports/rss2.0.xml"],
    categoryId: "us-sports",
    id: "la-times-sports",
    label: "Los Angeles Times - Sports",
    source: "latimes.com",
    url: "https://www.latimes.com/sports/rss2.0.xml",
  },
  {
    aliases: ["http://www.cbssports.com/partners/feeds/rss/home_news"],
    categoryId: "us-sports",
    id: "cbs-sports-headlines",
    label: "CBS Sports - Headlines",
    source: "cbssports.com",
    url: "https://www.cbssports.com/rss/headlines/",
  },
  {
    aliases: ["http://www.si.com/rss/si_topstories.rss"],
    categoryId: "us-sports",
    id: "sports-illustrated",
    label: "Sports Illustrated",
    source: "si.com",
    url: "https://www.si.com/feed",
  },
  {
    aliases: ["http://feeds.gawker.com/deadspin/full"],
    categoryId: "us-sports",
    id: "deadspin",
    label: "Deadspin",
    source: "deadspin.com",
    url: "https://deadspin.com/rss/",
  },
  {
    aliases: ["https://sports.yahoo.com/top/rss.xml"],
    categoryId: "us-sports",
    id: "yahoo-sports",
    label: "Yahoo Sports",
    source: "yahoo.com",
    url: "https://sports.yahoo.com/rss/",
  },
  {
    aliases: ["http://feeds.washingtonpost.com/rss/rss_early-lead"],
    categoryId: "us-sports",
    id: "washington-post-early-lead",
    label: "Washington Post - The Early Lead",
    source: "washingtonpost.com",
    url: "https://feeds.washingtonpost.com/rss/rss_early-lead",
  },
  {
    aliases: ["http://www.theguardian.com/sport/us-sport/rss"],
    categoryId: "us-sports",
    id: "guardian-us-sports",
    label: "The Guardian - U.S. Sports",
    source: "theguardian.com",
    url: "https://www.theguardian.com/sport/us-sport/rss",
  },
]

const expectedUsTechFeedRecords = [
  {
    aliases: ["http://www.huffingtonpost.com/feeds/verticals/technology/news.xml"],
    categoryId: "us-tech",
    id: "huffpost-technology",
    label: "HuffPost - Technology",
    source: "huffpost.com",
    url: "https://www.huffpost.com/section/technology/feed",
  },
  {
    aliases: [],
    categoryId: "us-tech",
    id: "cnn-tech",
    label: "CNN Tech",
    source: "cnn.com",
    url: "http://rss.cnn.com/rss/cnn_tech.rss",
  },
  {
    aliases: ["http://rss.nytimes.com/services/xml/rss/nyt/Technology.xml"],
    categoryId: "us-tech",
    id: "nyt-technology",
    label: "New York Times - Technology",
    source: "nytimes.com",
    url: "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml",
  },
  {
    aliases: ["http://feeds.foxnews.com/foxnews/tech"],
    categoryId: "us-tech",
    id: "fox-news-tech",
    label: "Fox News - Tech",
    source: "foxnews.com",
    url: "https://moxie.foxnews.com/google-publisher/tech.xml",
  },
  {
    aliases: ["http://www.theverge.com/rss/group/features/index.xml"],
    categoryId: "us-tech",
    id: "the-verge-features",
    label: "The Verge - Features",
    source: "theverge.com",
    url: "https://www.theverge.com/rss/features/index.xml",
  },
  {
    aliases: [],
    categoryId: "us-tech",
    id: "techcrunch",
    label: "TechCrunch",
    source: "techcrunch.com",
    url: "https://techcrunch.com/feed/",
  },
  {
    aliases: ["http://feeds.wired.com/wired/index"],
    categoryId: "us-tech",
    id: "wired",
    label: "WIRED",
    source: "wired.com",
    url: "https://www.wired.com/feed",
  },
  {
    aliases: ["http://www.cnet.com/rss/news/"],
    categoryId: "us-tech",
    id: "cnet-news",
    label: "CNET - News",
    source: "cnet.com",
    url: "https://www.cnet.com/rss/news/",
  },
  {
    aliases: ["http://www.cnet.com/rss/iphone-update/"],
    categoryId: "us-tech",
    id: "cnet-iphone-update",
    label: "CNET - iPhone Update",
    source: "cnet.com",
    url: "https://www.cnet.com/rss/iphone-update/",
  },
  {
    aliases: [
      "http://online.wsj.com/xml/rss/3_7455.xml",
      "http://www.wsj.com/xml/rss/3_7455.xml",
    ],
    categoryId: "us-tech",
    id: "wsj-technology",
    label: "Wall Street Journal - Technology",
    source: "wsj.com",
    url: "https://feeds.content.dowjones.io/public/rss/RSSWSJD",
  },
  {
    aliases: ["http://www.npr.org/rss/rss.php?id=1019"],
    categoryId: "us-tech",
    id: "npr-technology",
    label: "NPR - Technology",
    source: "npr.org",
    url: "https://feeds.npr.org/1019/rss.xml",
  },
  {
    aliases: ["http://www.macworld.com/index.rss"],
    categoryId: "us-tech",
    id: "macworld",
    label: "Macworld",
    source: "macworld.com",
    url: "https://www.macworld.com/feed",
  },
  {
    aliases: ["http://www.pcworld.com/index.rss"],
    categoryId: "us-tech",
    id: "pcworld",
    label: "PCWorld",
    source: "pcworld.com",
    url: "https://www.pcworld.com/feed",
  },
  {
    aliases: [
      "http://recode.net/category/general/feed/",
      "http://recode.net/category/mobile/feed/",
      "http://recode.net/category/security/feed/",
      "http://recode.net/category/enterprise/feed/",
      "http://recode.net/feed/",
    ],
    categoryId: "us-tech",
    id: "the-verge-recode",
    label: "The Verge - Recode",
    source: "theverge.com",
    url: "https://www.theverge.com/rss/recode/index.xml",
  },
  {
    aliases: ["http://www.engadget.com/rss.xml"],
    categoryId: "us-tech",
    id: "engadget",
    label: "Engadget",
    source: "engadget.com",
    url: "https://www.engadget.com/rss.xml",
  },
  {
    aliases: ["http://feeds.gawker.com/gizmodo/full"],
    categoryId: "us-tech",
    id: "gizmodo",
    label: "Gizmodo",
    source: "gizmodo.com",
    url: "https://gizmodo.com/feed",
  },
  {
    aliases: ["http://feeds.feedburner.com/techcrunch/startups?format=xml"],
    categoryId: "us-tech",
    id: "techcrunch-startups",
    label: "TechCrunch - Startups",
    source: "techcrunch.com",
    url: "https://techcrunch.com/category/startups/feed/",
  },
  {
    aliases: ["http://feeds.feedburner.com/TechCrunch/Gaming?format=xml"],
    categoryId: "us-tech",
    id: "techcrunch-gaming",
    label: "TechCrunch - Gaming",
    source: "techcrunch.com",
    url: "https://techcrunch.com/category/gaming/feed/",
  },
  {
    aliases: ["http://feeds.venturebeat.com/VentureBeat"],
    categoryId: "us-tech",
    id: "venturebeat",
    label: "VentureBeat",
    source: "venturebeat.com",
    url: "https://venturebeat.com/feed",
  },
  {
    aliases: ["http://www.latimes.com/business/technology/rss2.0.xml"],
    categoryId: "us-tech",
    id: "la-times-technology",
    label: "Los Angeles Times - Technology",
    source: "latimes.com",
    url: "https://www.latimes.com/business/technology/rss2.0.xml",
  },
  {
    aliases: ["http://feeds.abcnews.com/abcnews/technologyheadlines"],
    categoryId: "us-tech",
    id: "abc-news-technology",
    label: "ABC News - Technology",
    source: "abcnews.com",
    url: "https://abcnews.com/abcnews/technologyheadlines",
  },
  {
    aliases: ["http://www.buzzfeed.com/tech.xml"],
    categoryId: "us-tech",
    id: "buzzfeed-tech",
    label: "BuzzFeed - Tech",
    source: "buzzfeed.com",
    url: "https://www.buzzfeed.com/tech.xml",
  },
  {
    aliases: ["http://feeds.webservice.techradar.com/us/rss/new"],
    categoryId: "us-tech",
    id: "techradar",
    label: "TechRadar",
    source: "techradar.com",
    url: "https://www.techradar.com/feeds.xml",
  },
  {
    aliases: [],
    categoryId: "us-tech",
    id: "gigaom",
    label: "Gigaom",
    source: "gigaom.com",
    url: "http://gigaom.com/feed/",
  },
  {
    aliases: [],
    categoryId: "us-tech",
    id: "ars-technica-tech",
    label: "Ars Technica - Tech",
    source: "arstechnica.com",
    url: "http://feeds.arstechnica.com/arstechnica/gadgets",
  },
  {
    aliases: ["http://www.computerweekly.com/rss/All-Computer-Weekly-content.xml"],
    categoryId: "us-tech",
    id: "computerweekly",
    label: "ComputerWeekly",
    source: "computerweekly.com",
    url: "https://www.computerweekly.com/rss/All-Computer-Weekly-content.xml",
  },
  {
    aliases: ["http://techrepublic.com.feedsportal.com/c/35463/f/670841/index.rss"],
    categoryId: "us-tech",
    id: "techrepublic",
    label: "TechRepublic",
    source: "techrepublic.com",
    url: "https://www.techrepublic.com/rssfeeds/articles/",
  },
  {
    aliases: ["http://zdnet.com.feedsportal.com/c/35462/f/675634/index.rss"],
    categoryId: "us-tech",
    id: "zdnet",
    label: "ZDNET",
    source: "zdnet.com",
    url: "https://www.zdnet.com/news/rss.xml",
  },
  {
    aliases: ["http://www.forbes.com/technology/feed/"],
    categoryId: "us-tech",
    id: "forbes-technology",
    label: "Forbes - Technology",
    source: "forbes.com",
    url: "https://www.forbes.com/technology/feed/",
  },
  {
    aliases: ["http://time.com/tech/feed/"],
    categoryId: "us-tech",
    id: "time-technology",
    label: "TIME - Tech",
    source: "time.com",
    url: "https://time.com/tech/feed/",
  },
  {
    aliases: ["http://feeds.bbci.co.uk/news/technology/rss.xml"],
    categoryId: "us-tech",
    id: "bbc-technology",
    label: "BBC News - Technology",
    source: "bbc.co.uk",
    url: "https://feeds.bbci.co.uk/news/technology/rss.xml",
  },
  {
    aliases: ["http://techreport.com/news.rss"],
    categoryId: "us-tech",
    id: "techreport",
    label: "TechReport",
    source: "techreport.com",
    url: "https://techreport.com/feed/",
  },
  {
    aliases: ["http://www.techspot.com/backend.xml"],
    categoryId: "us-tech",
    id: "techspot",
    label: "TechSpot",
    source: "techspot.com",
    url: "https://www.techspot.com/backend.xml",
  },
  {
    aliases: [],
    categoryId: "us-tech",
    id: "digital-trends",
    label: "Digital Trends",
    source: "digitaltrends.com",
    url: "http://www.digitaltrends.com/feed/",
  },
  {
    aliases: [],
    categoryId: "us-tech",
    id: "ars-technica-biz-it",
    label: "Ars Technica - Biz & IT",
    source: "arstechnica.com",
    url: "http://feeds.arstechnica.com/arstechnica/technology-lab",
  },
  {
    aliases: [],
    categoryId: "us-tech",
    id: "ars-technica-business",
    label: "Ars Technica - Business",
    source: "arstechnica.com",
    url: "http://feeds.arstechnica.com/arstechnica/business",
  },
  {
    aliases: ["http://www.informationweek.com/rss_simple.asp"],
    categoryId: "us-tech",
    id: "informationweek",
    label: "InformationWeek",
    source: "informationweek.com",
    url: "https://www.informationweek.com/rss.xml",
  },
  {
    aliases: ["http://feeds.newscientist.com/tech"],
    categoryId: "us-tech",
    id: "new-scientist-technology",
    label: "New Scientist - Technology",
    source: "newscientist.com",
    url: "https://www.newscientist.com/subject/technology/feed/",
  },
  {
    aliases: ["http://feeds.nature.com/news/rss/news_s16"],
    categoryId: "us-tech",
    id: "nature-technology",
    label: "Nature - Technology",
    source: "nature.com",
    url: "https://www.nature.com/subjects/technology.rss",
  },
  {
    aliases: ["http://www.technologyreview.com/stream/rss/"],
    categoryId: "us-tech",
    id: "mit-technology-review",
    label: "MIT Technology Review",
    source: "technologyreview.com",
    url: "https://www.technologyreview.com/feed/",
  },
  {
    aliases: [],
    categoryId: "us-tech",
    id: "science-daily-technology",
    label: "ScienceDaily - Technology",
    source: "sciencedaily.com",
    url: "https://www.sciencedaily.com/rss/top/technology.xml",
  },
  {
    aliases: ["http://feeds.washingtonpost.com/rss/business/technology"],
    categoryId: "us-tech",
    id: "washington-post-technology",
    label: "Washington Post - Technology",
    source: "washingtonpost.com",
    url: "https://feeds.washingtonpost.com/rss/business/technology",
  },
  {
    aliases: ["http://www.techinsider.io/rss"],
    categoryId: "us-tech",
    id: "business-insider",
    label: "Business Insider",
    source: "businessinsider.com",
    url: "https://feeds.businessinsider.com/custom/all",
  },
  {
    aliases: ["http://feeds.feedburner.com/IeeeSpectrumRoboticsChannel"],
    categoryId: "us-tech",
    id: "ieee-spectrum-robotics",
    label: "IEEE Spectrum - Robotics",
    source: "spectrum.ieee.org",
    url: "https://spectrum.ieee.org/feeds/topic/robotics.rss",
  },
  {
    aliases: ["http://www.theverge.com/tech/rss/index.xml"],
    categoryId: "us-tech",
    id: "the-verge-tech",
    label: "The Verge - Tech",
    source: "theverge.com",
    url: "https://www.theverge.com/rss/tech/index.xml",
  },
]

const expectedUsEntertainmentFeedRecords = [
  {
    aliases: ["http://blogs.wsj.com/speakeasy/feed/"],
    categoryId: "us-entertainment",
    id: "wsj-lifestyle",
    label: "Wall Street Journal - Lifestyle",
    source: "wsj.com",
    url: "https://feeds.content.dowjones.io/public/rss/RSSLifestyle",
  },
  {
    aliases: [
      "http://www.hollywoodreporter.com/blogs/live-feed/rss",
      "https://www.hollywoodreporter.com/blogs/live-feed/feed/",
    ],
    categoryId: "us-entertainment",
    id: "hollywood-reporter-live-feed",
    label: "The Hollywood Reporter - Live Feed",
    source: "hollywoodreporter.com",
    url: "https://www.hollywoodreporter.com/e/live-feed/feed/",
  },
  {
    aliases: ["http://variety.com/feed/"],
    categoryId: "us-entertainment",
    id: "variety",
    label: "Variety",
    source: "variety.com",
    url: "https://variety.com/feed/",
  },
  {
    aliases: ["http://www.rollingstone.com/news.rss"],
    categoryId: "us-entertainment",
    id: "rolling-stone",
    label: "Rolling Stone",
    source: "rollingstone.com",
    url: "https://www.rollingstone.com/feed/",
  },
  {
    aliases: ["http://www.latimes.com/entertainment/rss2.0.xml"],
    categoryId: "us-entertainment",
    id: "la-times-entertainment",
    label: "Los Angeles Times - Entertainment",
    source: "latimes.com",
    url: "https://www.latimes.com/entertainment/rss2.0.xml",
  },
  {
    aliases: [],
    categoryId: "us-entertainment",
    id: "vulture",
    label: "Vulture",
    source: "vulture.com",
    url: "http://feeds.feedburner.com/nymag/vulture",
  },
  {
    aliases: ["http://www.newyorker.com/feed/culture"],
    categoryId: "us-entertainment",
    id: "new-yorker-culture",
    label: "The New Yorker - Culture",
    source: "newyorker.com",
    url: "https://www.newyorker.com/feed/culture",
  },
  {
    aliases: ["http://www.buzzfeed.com/tvandmovies.xml"],
    categoryId: "us-entertainment",
    id: "buzzfeed-tv-movies",
    label: "BuzzFeed - TV & Movies",
    source: "buzzfeed.com",
    url: "https://www.buzzfeed.com/tvandmovies.xml",
  },
  {
    aliases: ["http://www.tmz.com/rss.xml"],
    categoryId: "us-entertainment",
    id: "tmz",
    label: "TMZ",
    source: "tmz.com",
    url: "https://www.tmz.com/rss.xml",
  },
  {
    aliases: ["http://www.cbsnews.com/latest/rss/entertainment"],
    categoryId: "us-entertainment",
    id: "cbs-entertainment",
    label: "CBS News - Entertainment",
    source: "cbsnews.com",
    url: "https://www.cbsnews.com/latest/rss/entertainment",
  },
  {
    aliases: ["http://feeds.abcnews.com/abcnews/entertainmentheadlines"],
    categoryId: "us-entertainment",
    id: "abc-news-entertainment",
    label: "ABC News - Entertainment",
    source: "abcnews.com",
    url: "https://abcnews.com/abcnews/entertainmentheadlines",
  },
  {
    aliases: [
      "http://www.huffingtonpost.com/feeds/verticals/entertainment/index.xml",
    ],
    categoryId: "us-entertainment",
    id: "huffpost-entertainment",
    label: "HuffPost - Entertainment",
    source: "huffpost.com",
    url: "https://www.huffpost.com/section/entertainment/feed",
  },
  {
    aliases: ["http://deadline.com/feed/"],
    categoryId: "us-entertainment",
    id: "deadline",
    label: "Deadline",
    source: "deadline.com",
    url: "https://deadline.com/feed/",
  },
  {
    aliases: ["http://feeds.feedburner.com/EtsBreakingNews"],
    categoryId: "us-entertainment",
    id: "entertainment-tonight",
    label: "Entertainment Tonight",
    source: "etonline.com",
    url: "https://www.etonline.com/news/rss",
  },
  {
    aliases: ["http://feeds.nbcnews.com/feeds/todayentertainment"],
    categoryId: "us-entertainment",
    id: "nbc-today-pop-culture",
    label: "TODAY - Pop Culture",
    source: "today.com",
    url: "https://feeds.nbcnews.com/today/public/popculture",
  },
  {
    aliases: ["http://www.popsugar.com/feed"],
    categoryId: "us-entertainment",
    id: "popsugar",
    label: "POPSUGAR",
    source: "popsugar.com",
    url: "https://www.popsugar.com/feed",
  },
  {
    aliases: ["http://feed2.hollywood.com/hollywood/RhHn"],
    categoryId: "us-entertainment",
    id: "hollywood-com",
    label: "Hollywood.com",
    source: "hollywood.com",
    url: "https://www.hollywood.com/feed",
  },
  {
    aliases: ["http://www.esquire.com/blogs/culture/culture-rss"],
    categoryId: "us-entertainment",
    id: "esquire-entertainment",
    label: "Esquire - Entertainment",
    source: "esquire.com",
    url: "https://www.esquire.com/rss/entertainment.xml/",
  },
  {
    aliases: ["http://www.usmagazine.com/feeds/movies_tv_music/atom"],
    categoryId: "us-entertainment",
    id: "us-weekly-entertainment",
    label: "Us Weekly - Entertainment",
    source: "usmagazine.com",
    url: "https://www.usmagazine.com/category/entertainment/feed/",
  },
  {
    aliases: ["http://feeds2.feedburner.com/nmecom/rss/newsxml"],
    categoryId: "us-entertainment",
    id: "nme",
    label: "NME",
    source: "nme.com",
    url: "https://www.nme.com/feed",
  },
  {
    aliases: ["http://www.washingtonpost.com/rss/entertainment"],
    categoryId: "us-entertainment",
    id: "washington-post-entertainment",
    label: "Washington Post - Arts & Entertainment",
    source: "washingtonpost.com",
    url: "https://feeds.washingtonpost.com/rss/entertainment",
  },
]

const expectedUsGamingFeedRecords = [
  {
    aliases: ["http://feeds.ign.com/ign/all"],
    categoryId: "us-gaming",
    id: "ign",
    label: "IGN",
    source: "ign.com",
    url: "https://www.ign.com/rss/articles/feed",
  },
  {
    aliases: [
      "http://feeds.gawker.com/kotaku/full#_ga=1.111114893.94307673.1446233598",
    ],
    categoryId: "us-gaming",
    id: "kotaku",
    label: "Kotaku",
    source: "kotaku.com",
    url: "https://kotaku.com/feed",
  },
  {
    aliases: [],
    categoryId: "us-gaming",
    id: "rock-paper-shotgun",
    label: "Rock Paper Shotgun",
    source: "rockpapershotgun.com",
    url: "http://feeds.feedburner.com/RockPaperShotgun",
  },
  {
    aliases: [],
    categoryId: "us-gaming",
    id: "vgchartz",
    label: "VGChartz",
    source: "vgchartz.com",
    url: "http://feeds.feedburner.com/VGChartz",
  },
  {
    aliases: ["http://www.gamesindustry.biz/rss/gamesindustry_news_feed.rss"],
    categoryId: "us-gaming",
    id: "gamesindustry",
    label: "GamesIndustry.biz",
    source: "gamesindustry.biz",
    url: "https://www.gamesindustry.biz/feed",
  },
  {
    aliases: ["http://www.gamespot.com/feeds/mashup/"],
    categoryId: "us-gaming",
    id: "gamespot",
    label: "GameSpot",
    source: "gamespot.com",
    url: "https://www.gamespot.com/feeds/mashup/",
  },
  {
    aliases: ["http://www.pcworld.com/column/game-on/index.rss"],
    categoryId: "us-gaming",
    id: "pcworld-gaming",
    label: "PCWorld - Gaming",
    source: "pcworld.com",
    url: "https://www.pcworld.com/gaming/feed",
  },
  {
    aliases: ["http://www.gamasutra.com/static2/rssfeeds.html"],
    categoryId: "us-gaming",
    id: "game-developer",
    label: "Game Developer",
    source: "gamedeveloper.com",
    url: "https://www.gamedeveloper.com/rss.xml",
  },
  {
    aliases: ["http://www.eurogamer.net/?format=rss"],
    categoryId: "us-gaming",
    id: "eurogamer",
    label: "Eurogamer",
    source: "eurogamer.net",
    url: "https://www.eurogamer.net/feed",
  },
  {
    aliases: ["http://rss.escapistmagazine.com/tags/video-games.xml"],
    categoryId: "us-gaming",
    id: "escapist",
    label: "The Escapist",
    source: "escapistmagazine.com",
    url: "https://www.escapistmagazine.com/feed/",
  },
  {
    aliases: ["http://www.destructoid.com/?mode=atom"],
    categoryId: "us-gaming",
    id: "destructoid",
    label: "Destructoid",
    source: "destructoid.com",
    url: "https://www.destructoid.com/feed/",
  },
  {
    aliases: [
      "https://www.cheapassgamer.com/rss/forums/1-cheap-ass-gamer-video-game-dealsforum/",
    ],
    categoryId: "us-gaming",
    id: "cheapassgamer",
    label: "Cheap Ass Gamer - Video Game Deals",
    source: "cheapassgamer.com",
    url: "https://www.cheapassgamer.com/forums/video-game-deals.2196/index.rss",
  },
  {
    aliases: ["http://www.gametrailers.com/about/rss"],
    categoryId: "us-gaming",
    id: "gametrailers",
    label: "GameTrailers",
    source: "youtube.com",
    url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCJx5KP-pCUmL9eZUv-mIcNw",
  },
  {
    aliases: [],
    categoryId: "us-gaming",
    id: "rpg-cast",
    label: "RPG Cast",
    source: "rpgamer.com",
    url: "http://feeds.feedburner.com/Rpgcast",
  },
  {
    aliases: ["http://www.pocketgamer.co.uk/rss.asp"],
    categoryId: "us-gaming",
    id: "pocket-gamer",
    label: "Pocket Gamer",
    source: "pocketgamer.com",
    url: "https://www.pocketgamer.com/index.rss",
  },
  {
    aliases: ["http://www.polygon.com/rss/index.xml"],
    categoryId: "us-gaming",
    id: "polygon",
    label: "Polygon",
    source: "polygon.com",
    url: "https://www.polygon.com/feed/",
  },
  {
    aliases: ["http://www.gamesradar.com/all-platforms/news/rss/"],
    categoryId: "us-gaming",
    id: "gamesradar",
    label: "GamesRadar+",
    source: "gamesradar.com",
    url: "https://www.gamesradar.com/all-platforms/news/rss/",
  },
  {
    aliases: ["http://feeds.feedburner.com/TechCrunch/gaming"],
    categoryId: "us-gaming",
    id: "techcrunch-gaming-feed",
    label: "TechCrunch - Gaming",
    source: "techcrunch.com",
    url: "https://techcrunch.com/category/gaming/feed/",
  },
  {
    aliases: ["http://feeds.webservice.techradar.com/us/rss/news/gaming"],
    categoryId: "us-gaming",
    id: "techradar-gaming",
    label: "TechRadar - Gaming",
    source: "techradar.com",
    url: "https://www.techradar.com/feeds/tag/gaming",
  },
  {
    aliases: [],
    categoryId: "us-gaming",
    id: "ars-technica-gaming",
    label: "Ars Technica - Gaming",
    source: "arstechnica.com",
    url: "http://feeds.arstechnica.com/arstechnica/gaming",
  },
]

const expectedCaGeneralFeedRecords = [
  {
    aliases: ["http://www.journaldemontreal.com/rss.xml"],
    categoryId: "ca-general",
    id: "journal-de-montreal",
    label: "Le Journal de Montreal",
    source: "journaldemontreal.com",
    url: "https://www.journaldemontreal.com/rss.xml",
  },
  {
    aliases: ["http://rss.radio-canada.ca/fils/nouvelles/national.xml"],
    categoryId: "ca-general",
    id: "radio-canada-info",
    label: "Radio-Canada - Info",
    source: "radio-canada.ca",
    url: "https://ici.radio-canada.ca/info/rss/info/a-la-une",
  },
  {
    aliases: ["http://leaderpost.com/feed/"],
    categoryId: "ca-general",
    id: "regina-leader-post",
    label: "Regina Leader-Post",
    source: "leaderpost.com",
    url: "https://leaderpost.com/feed",
  },
  {
    aliases: ["http://thestarphoenix.com/feed/"],
    categoryId: "ca-general",
    id: "saskatoon-starphoenix",
    label: "Saskatoon StarPhoenix",
    source: "thestarphoenix.com",
    url: "https://thestarphoenix.com/feed",
  },
  {
    aliases: ["http://windsorstar.com/feed/"],
    categoryId: "ca-general",
    id: "windsor-star",
    label: "Windsor Star",
    source: "windsorstar.com",
    url: "https://windsorstar.com/feed",
  },
  {
    aliases: ["http://www.cbc.ca/cmlink/rss-canada"],
    categoryId: "ca-general",
    id: "cbc-canada",
    label: "CBC - Canada",
    source: "cbc.ca",
    url: "https://www.cbc.ca/webfeed/rss/rss-canada",
  },
  {
    aliases: ["http://globalnews.ca/canada/feed/"],
    categoryId: "ca-general",
    id: "global-news-canada",
    label: "Global News - Canada",
    source: "globalnews.ca",
    url: "https://globalnews.ca/canada/feed/",
  },
  {
    aliases: ["http://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml"],
    categoryId: "ca-general",
    id: "bbc-us-canada-ca",
    label: "BBC News - U.S. & Canada",
    source: "bbc.co.uk",
    url: "https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml",
  },
  {
    aliases: ["http://www.brandonsun.com/rss/?path=%2Fnational%2Fbreaking-news"],
    categoryId: "ca-general",
    id: "brandon-sun-national",
    label: "Brandon Sun - National",
    source: "brandonsun.com",
    url: "https://www.brandonsun.com/feed?path=%2Fnational%2Fbreaking-news",
  },
  {
    aliases: ["http://thewalrus.ca/feed/"],
    categoryId: "ca-general",
    id: "the-walrus",
    label: "The Walrus",
    source: "thewalrus.ca",
    url: "https://thewalrus.ca/feed/",
  },
  {
    aliases: [],
    categoryId: "ca-general",
    id: "national-post-canada",
    label: "National Post - Canada",
    source: "nationalpost.com",
    url: "https://nationalpost.com/category/news/canada/feed.xml",
  },
  {
    aliases: ["http://www.torontosun.com/home/rss.xml"],
    categoryId: "ca-general",
    id: "toronto-sun",
    label: "Toronto Sun",
    source: "torontosun.com",
    url: "https://torontosun.com/feed",
  },
  {
    aliases: ["http://www.calgarysun.com/home/rss.xml"],
    categoryId: "ca-general",
    id: "calgary-sun",
    label: "Calgary Sun",
    source: "calgarysun.com",
    url: "https://calgarysun.com/feed",
  },
  {
    aliases: ["http://ottawacitizen.com/feed"],
    categoryId: "ca-general",
    id: "ottawa-citizen",
    label: "Ottawa Citizen",
    source: "ottawacitizen.com",
    url: "https://ottawacitizen.com/feed",
  },
  {
    aliases: [],
    categoryId: "ca-general",
    id: "vancouver-sun",
    label: "Vancouver Sun",
    source: "vancouversun.com",
    url: "https://vancouversun.com/feed",
  },
  {
    aliases: [],
    categoryId: "ca-general",
    id: "citynews-calgary",
    label: "CityNews Calgary",
    source: "calgary.citynews.ca",
    url: "https://calgary.citynews.ca/feed/",
  },
  {
    aliases: ["http://feeds.feedblitz.com/thetyee"],
    categoryId: "ca-general",
    id: "the-tyee",
    label: "The Tyee",
    source: "thetyee.ca",
    url: "https://thetyee.ca/rss2.xml",
  },
]

const expectedCaPoliticsFeedRecords = [
  {
    aliases: [],
    categoryId: "ca-politics",
    id: "national-post-politics-ca",
    label: "National Post - Politics",
    source: "nationalpost.com",
    url: "https://nationalpost.com/category/news/politics/feed.xml",
  },
  {
    aliases: ["http://rss.cbc.ca/lineup/politics.xml"],
    categoryId: "ca-politics",
    id: "cbc-politics-ca",
    label: "CBC - Politics",
    source: "cbc.ca",
    url: "http://rss.cbc.ca/lineup/politics.xml",
  },
  {
    aliases: ["http://globalnews.ca/politics/feed/"],
    categoryId: "ca-politics",
    id: "global-politics-ca",
    label: "Global News - Politics",
    source: "globalnews.ca",
    url: "https://globalnews.ca/politics/feed/",
  },
  {
    aliases: [
      "http://topics.nytimes.com/top/news/international/countriesandterritories/canada/index.html?rss=1",
    ],
    categoryId: "ca-politics",
    id: "nyt-canada",
    label: "New York Times - Canada",
    source: "nytimes.com",
    url: "https://www.nytimes.com/svc/collections/v1/publish/www.nytimes.com/topic/destination/canada/rss.xml",
  },
  {
    aliases: [],
    categoryId: "ca-politics",
    id: "the-tyee-politics",
    label: "The Tyee",
    source: "thetyee.ca",
    url: "https://thetyee.ca/rss2.xml",
  },
]

const expectedCaBusinessFeedRecords = [
  {
    aliases: ["http://rss.cbc.ca/lineup/business.xml"],
    categoryId: "ca-business",
    id: "cbc-business-ca",
    label: "CBC - Business",
    source: "cbc.ca",
    url: "http://rss.cbc.ca/lineup/business.xml",
  },
  {
    aliases: [],
    categoryId: "ca-business",
    id: "financial-post",
    label: "Financial Post",
    source: "financialpost.com",
    url: "https://financialpost.com/feed",
  },
  {
    aliases: ["http://feeds.feedburner.com/FP_TopStories?format=xml"],
    categoryId: "ca-business",
    id: "financial-post-top-stories",
    label: "Financial Post - Top Stories",
    source: "financialpost.com",
    url: "http://feeds.feedburner.com/FP_TopStories?format=xml",
  },
  {
    aliases: [],
    categoryId: "ca-business",
    id: "global-money",
    label: "Global News - Money",
    source: "globalnews.ca",
    url: "https://globalnews.ca/money/feed/",
  },
  {
    aliases: [],
    categoryId: "ca-business",
    id: "global-economy",
    label: "Global News - Economy",
    source: "globalnews.ca",
    url: "https://globalnews.ca/tag/economy/feed/",
  },
  {
    aliases: ["http://betakit.com/feed/"],
    categoryId: "ca-business",
    id: "betakit-business",
    label: "BetaKit",
    source: "betakit.com",
    url: "https://betakit.com/feed/",
  },
]

const expectedCaGamingFeedRecords = [
  {
    aliases: ["http://cogconnected.com/feed/"],
    categoryId: "ca-gaming",
    id: "cogconnected",
    label: "COGconnected",
    source: "cogconnected.com",
    url: "http://cogconnected.com/feed/",
  },
  {
    aliases: [],
    categoryId: "ca-gaming",
    id: "cgmagazine",
    label: "CGMagazine",
    source: "cgmagonline.com",
    url: "https://www.cgmagonline.com/feed/",
  },
  {
    aliases: [],
    categoryId: "ca-gaming",
    id: "can-i-play-that",
    label: "Can I Play That?",
    source: "caniplaythat.com",
    url: "https://caniplaythat.com/feed/",
  },
]

const expectedCaHealthFeedRecords = [
  {
    aliases: ["http://www.journaldemontreal.com/jm/sante/rss.xml"],
    categoryId: "ca-health",
    id: "journal-de-montreal-health",
    label: "Le Journal de Montreal - Sante",
    source: "journaldemontreal.com",
    url: "https://www.journaldemontreal.com/jm/sante/rss.xml",
  },
  {
    aliases: [],
    categoryId: "ca-health",
    id: "cbc-health-ca",
    label: "CBC - Health",
    source: "cbc.ca",
    url: "https://www.cbc.ca/webfeed/rss/rss-health",
  },
  {
    aliases: ["http://news.nationalpost.com/category/health/feed/"],
    categoryId: "ca-health",
    id: "national-post-health-ca",
    label: "National Post - Health",
    source: "nationalpost.com",
    url: "https://nationalpost.com/category/health/feed.xml",
  },
  {
    aliases: [],
    categoryId: "ca-health",
    id: "global-health-ca",
    label: "Global News - Health",
    source: "globalnews.ca",
    url: "https://globalnews.ca/health/feed/",
  },
  {
    aliases: [],
    categoryId: "ca-health",
    id: "healthing",
    label: "Healthing.ca",
    source: "healthing.ca",
    url: "https://www.healthing.ca/feed",
  },
]

const expectedCaScienceFeedRecords = [
  {
    aliases: ["http://globalnews.ca/science/feed/"],
    categoryId: "ca-science",
    id: "global-science-ca",
    label: "Global News - Science",
    source: "globalnews.ca",
    url: "https://globalnews.ca/science/feed/",
  },
  {
    aliases: [],
    categoryId: "ca-science",
    id: "national-post-science",
    label: "National Post - Science",
    source: "nationalpost.com",
    url: "https://nationalpost.com/category/news/science/feed.xml",
  },
  {
    aliases: ["http://www.cbc.ca/cmlink/1.392"],
    categoryId: "ca-science",
    id: "cbc-science-technology",
    label: "CBC - Science & Technology",
    source: "cbc.ca",
    url: "https://www.cbc.ca/webfeed/rss/rss-technology",
  },
]

const expectedCaSportsFeedRecords = [
  {
    aliases: ["http://www.journaldemontreal.com/sports/rss.xml"],
    categoryId: "ca-sports",
    id: "journal-de-montreal-sports",
    label: "Le Journal de Montreal - Sports",
    source: "journaldemontreal.com",
    url: "https://www.journaldemontreal.com/sports/rss.xml",
  },
  {
    aliases: ["http://www.cbc.ca/cmlink/rss-sports"],
    categoryId: "ca-sports",
    id: "cbc-sports-ca",
    label: "CBC - Sports",
    source: "cbc.ca",
    url: "https://www.cbc.ca/webfeed/rss/rss-sports",
  },
  {
    aliases: ["https://ca.sports.yahoo.com/top/rss.xml"],
    categoryId: "ca-sports",
    id: "yahoo-canada-sports",
    label: "Yahoo Canada Sports",
    source: "yahoo.com",
    url: "https://ca.sports.yahoo.com/rss/",
  },
  {
    aliases: ["http://globalnews.ca/sports/feed/"],
    categoryId: "ca-sports",
    id: "global-sports-ca",
    label: "Global News - Sports",
    source: "globalnews.ca",
    url: "https://globalnews.ca/sports/feed/",
  },
  {
    aliases: ["http://www.winnipegfreepress.com/rss/?path=%2Fsports"],
    categoryId: "ca-sports",
    id: "winnipeg-free-press-sports",
    label: "Winnipeg Free Press - Sports",
    source: "winnipegfreepress.com",
    url: "https://www.winnipegfreepress.com/feed?path=%2Fsports",
  },
  {
    aliases: [],
    categoryId: "ca-sports",
    id: "team-canada",
    label: "Team Canada",
    source: "olympic.ca",
    url: "https://olympic.ca/feed/",
  },
]

const expectedCaTechFeedRecords = [
  {
    aliases: ["http://betakit.com/feed/"],
    categoryId: "ca-tech",
    id: "betakit",
    label: "BetaKit",
    source: "betakit.com",
    url: "https://betakit.com/feed/",
  },
  {
    aliases: ["http://www.cbc.ca/cmlink/rss-technology"],
    categoryId: "ca-tech",
    id: "cbc-technology-ca",
    label: "CBC - Technology",
    source: "cbc.ca",
    url: "https://www.cbc.ca/webfeed/rss/rss-technology",
  },
  {
    aliases: ["http://mobilesyrup.com/feed/"],
    categoryId: "ca-tech",
    id: "mobilesyrup",
    label: "MobileSyrup",
    source: "mobilesyrup.com",
    url: "https://mobilesyrup.com/feed/",
  },
  {
    aliases: ["http://globalnews.ca/tech/feed/"],
    categoryId: "ca-tech",
    id: "global-tech-ca",
    label: "Global News - Tech",
    source: "globalnews.ca",
    url: "https://globalnews.ca/tech/feed/",
  },
]

const expectedCaEntertainmentFeedRecords = [
  {
    aliases: ["http://www.laineygossip.com/Rss"],
    categoryId: "ca-entertainment",
    id: "lainey-gossip",
    label: "LaineyGossip",
    source: "laineygossip.com",
    url: "https://www.laineygossip.com/rss/",
  },
  {
    aliases: ["http://feeds.feedburner.com/ExclaimCaAllArticles"],
    categoryId: "ca-entertainment",
    id: "exclaim",
    label: "Exclaim!",
    source: "exclaim.ca",
    url: "http://feeds.feedburner.com/ExclaimCaAllArticles",
  },
  {
    aliases: ["http://www.chartattack.com/feed/"],
    categoryId: "ca-entertainment",
    id: "chart-attack",
    label: "Chart Attack",
    source: "chartsattack.com",
    url: "https://www.chartsattack.com/feed/",
  },
  {
    aliases: ["http://musiccanada.com/feed/"],
    categoryId: "ca-entertainment",
    id: "music-canada",
    label: "Music Canada",
    source: "musiccanada.com",
    url: "https://musiccanada.com/feed/",
  },
  {
    aliases: ["http://www.journaldemontreal.com/spectacles/rss.xml"],
    categoryId: "ca-entertainment",
    id: "journal-de-montreal-spectacles",
    label: "Le Journal de Montreal - Spectacles",
    source: "journaldemontreal.com",
    url: "https://www.journaldemontreal.com/spectacles/rss.xml",
  },
  {
    aliases: ["http://rss.cbc.ca/lineup/arts.xml"],
    categoryId: "ca-entertainment",
    id: "cbc-arts-ca",
    label: "CBC - Arts",
    source: "cbc.ca",
    url: "https://www.cbc.ca/webfeed/rss/rss-arts",
  },
  {
    aliases: ["http://globalnews.ca/category/entertainment/feed/"],
    categoryId: "ca-entertainment",
    id: "global-entertainment-ca",
    label: "Global News - Entertainment",
    source: "globalnews.ca",
    url: "https://globalnews.ca/entertainment/feed/",
  },
  {
    aliases: ["http://www.dose.ca/feed"],
    categoryId: "ca-entertainment",
    id: "dose-ca",
    label: "Dose.ca",
    source: "dose.ca",
    url: "https://dose.ca/feed/",
  },
  {
    aliases: [],
    categoryId: "ca-entertainment",
    id: "national-post-entertainment",
    label: "National Post - Entertainment",
    source: "nationalpost.com",
    url: "https://nationalpost.com/category/entertainment/feed.xml",
  },
]

const expectedInGeneralFeedRecords = [
  {
    aliases: ["http://indianexpress.com/section/india/feed/"],
    categoryId: "in-general",
    id: "indian-express-india",
    label: "The Indian Express - India",
    source: "indianexpress.com",
    url: "https://indianexpress.com/section/india/feed/",
  },
  {
    aliases: ["http://feeds.bbci.co.uk/news/world/asia/india/rss.xml"],
    categoryId: "in-general",
    id: "bbc-india",
    label: "BBC News - India",
    source: "bbc.co.uk",
    url: "https://feeds.bbci.co.uk/news/world/asia/india/rss.xml",
  },
  {
    aliases: ["http://www.thehindubusinessline.com/news/?service=rss"],
    categoryId: "in-general",
    id: "hindu-businessline-news",
    label: "BusinessLine - News",
    source: "thehindubusinessline.com",
    url: "https://www.thehindubusinessline.com/news/?service=rss",
  },
  {
    aliases: ["http://www.thehindu.com/news/national/?service=rss"],
    categoryId: "in-general",
    id: "the-hindu-national-in",
    label: "The Hindu - National",
    source: "thehindu.com",
    url: "https://www.thehindu.com/news/national/?service=rss",
  },
  {
    aliases: ["http://zeenews.india.com/rss/world-news.xml"],
    categoryId: "in-general",
    id: "zee-world-india",
    label: "Zee News - World",
    source: "zeenews.india.com",
    url: "https://zeenews.india.com/rss/world-news.xml",
  },
  {
    aliases: ["http://economictimes.indiatimes.com/News/rssfeeds/1715249553.cms"],
    categoryId: "in-general",
    id: "economic-times-news",
    label: "Economic Times - News",
    source: "economictimes.indiatimes.com",
    url: "https://economictimes.indiatimes.com/News/rssfeeds/1715249553.cms",
  },
  {
    aliases: ["http://www.business-standard.com/rss/home_page_top_stories.rss"],
    categoryId: "in-general",
    id: "business-standard-top-stories-in",
    label: "Business Standard - Top Stories",
    source: "business-standard.com",
    url: "https://www.business-standard.com/rss/home_page_top_stories.rss",
  },
  {
    aliases: ["http://www.dnaindia.com/rss.xml"],
    categoryId: "in-general",
    id: "dna-india-latest",
    label: "DNA India - Latest",
    source: "dnaindia.com",
    url: "https://www.dnaindia.com/feeds/latest.xml",
  },
  {
    aliases: ["http://feeds.hindustantimes.com/HT-India"],
    categoryId: "in-general",
    id: "hindustan-times-india",
    label: "Hindustan Times - India",
    source: "hindustantimes.com",
    url: "https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml",
  },
  {
    aliases: [],
    categoryId: "in-general",
    id: "ndtv-india-news",
    label: "NDTV - India News",
    source: "ndtv.com",
    url: "https://feeds.feedburner.com/ndtvnews-india-news",
  },
  {
    aliases: ["http://ibnlive.in.com/ibnrss/top.xml"],
    categoryId: "in-general",
    id: "news18-india",
    label: "News18 - India",
    source: "news18.com",
    url: "https://www.news18.com/commonfeeds/v1/eng/rss/india.xml",
  },
  {
    aliases: [],
    categoryId: "in-general",
    id: "firstpost-india",
    label: "Firstpost - India",
    source: "firstpost.com",
    url: "https://www.firstpost.com/commonfeeds/v1/mfp/rss/india.xml",
  },
]

const expectedInPoliticsFeedRecords = [
  {
    aliases: ["http://www.thehindu.com/news/national/?service=rss"],
    categoryId: "in-politics",
    id: "the-hindu-national-politics",
    label: "The Hindu - National",
    source: "thehindu.com",
    url: "https://www.thehindu.com/news/national/?service=rss",
  },
  {
    aliases: ["http://www.ft.com/rss/world/asiapacific/india"],
    categoryId: "in-politics",
    id: "ft-india",
    label: "Financial Times - India",
    source: "ft.com",
    url: "https://www.ft.com/india?format=rss",
  },
  {
    aliases: ["http://indianexpress.com/section/india/politics/feed/"],
    categoryId: "in-politics",
    id: "indian-express-political-pulse",
    label: "The Indian Express - Political Pulse",
    source: "indianexpress.com",
    url: "https://indianexpress.com/section/political-pulse/feed/",
  },
  {
    aliases: ["http://ibnlive.in.com/ibnrss/rss/politics/politics.xml"],
    categoryId: "in-politics",
    id: "news18-politics-in",
    label: "News18 - Politics",
    source: "news18.com",
    url: "https://www.news18.com/commonfeeds/v1/eng/rss/politics.xml",
  },
  {
    aliases: [],
    categoryId: "in-politics",
    id: "india-today-politics",
    label: "India Today - Politics",
    source: "indiatoday.in",
    url: "https://www.indiatoday.in/rss/1206514",
  },
  {
    aliases: ["http://www.firstpost.com/politics/feed"],
    categoryId: "in-politics",
    id: "firstpost-politics-in",
    label: "Firstpost - Politics",
    source: "firstpost.com",
    url: "https://www.firstpost.com/commonfeeds/v1/mfp/rss/politics.xml",
  },
  {
    aliases: ["http://www.frontline.in/politics/?service=rss"],
    categoryId: "in-politics",
    id: "frontline-politics",
    label: "Frontline - Politics",
    source: "frontline.thehindu.com",
    url: "https://frontline.thehindu.com/politics/?service=rss",
  },
]

const expectedInBusinessFeedRecords = [
  {
    aliases: ["http://economictimes.indiatimes.com/rssfeedsdefault.cms"],
    categoryId: "in-business",
    id: "economic-times-business",
    label: "Economic Times - Business",
    source: "economictimes.indiatimes.com",
    url: "https://economictimes.indiatimes.com/rssfeedsdefault.cms",
  },
  {
    aliases: ["http://www.business-standard.com/rss/todays-paper.rss"],
    categoryId: "in-business",
    id: "business-standard-todays-paper",
    label: "Business Standard - Today's Paper",
    source: "business-standard.com",
    url: "https://www.business-standard.com/rss/todays-paper.rss",
  },
  {
    aliases: ["http://www.business-standard.com/rss/home_page_top_stories.rss"],
    categoryId: "in-business",
    id: "business-standard-top-stories-business",
    label: "Business Standard - Top Stories",
    source: "business-standard.com",
    url: "https://www.business-standard.com/rss/home_page_top_stories.rss",
  },
  {
    aliases: ["http://www.livemint.com/rss/companies"],
    categoryId: "in-business",
    id: "livemint-companies",
    label: "Mint - Companies",
    source: "livemint.com",
    url: "https://www.livemint.com/rss/companies",
  },
  {
    aliases: ["http://www.livemint.com/rss/industry"],
    categoryId: "in-business",
    id: "livemint-industry",
    label: "Mint - Industry",
    source: "livemint.com",
    url: "https://www.livemint.com/rss/industry",
  },
  {
    aliases: ["http://www.livemint.com/rss/money"],
    categoryId: "in-business",
    id: "livemint-money",
    label: "Mint - Money",
    source: "livemint.com",
    url: "https://www.livemint.com/rss/money",
  },
  {
    aliases: ["http://zeenews.india.com/rss/business.xml"],
    categoryId: "in-business",
    id: "zee-business",
    label: "Zee News - Business",
    source: "zeenews.india.com",
    url: "https://zeenews.india.com/rss/business.xml",
  },
  {
    aliases: [
      "https://news.google.com/news/feeds?cf=all&ned=in&hl=en&topic=b&output=rss",
    ],
    categoryId: "in-business",
    id: "google-news-india-business",
    label: "Google News - India Business",
    source: "news.google.com",
    url: "https://news.google.com/rss?cf=all&hl=en-IN&topic=b&gl=IN&ceid=IN:en",
  },
  {
    aliases: ["http://feeds.feedburner.com/NDTV-Business?format=xml"],
    categoryId: "in-business",
    id: "ndtv-profit",
    label: "NDTV Profit",
    source: "ndtvprofit.com",
    url: "https://www.ndtvprofit.com/rss",
  },
]

const expectedInHealthFeedRecords = [
  {
    aliases: ["http://timesofindia.indiatimes.com/rssfeeds/2886714.cms"],
    categoryId: "in-health",
    id: "times-of-india-health",
    label: "Times of India - Health",
    source: "timesofindia.indiatimes.com",
    url: "https://timesofindia.indiatimes.com/rssfeeds/2886714.cms",
  },
  {
    aliases: ["http://www.thehindu.com/sci-tech/health/?service=rss"],
    categoryId: "in-health",
    id: "the-hindu-health-in",
    label: "The Hindu - Health",
    source: "thehindu.com",
    url: "https://www.thehindu.com/sci-tech/health/?service=rss",
  },
  {
    aliases: [],
    categoryId: "in-health",
    id: "the-healthsite",
    label: "TheHealthSite",
    source: "thehealthsite.com",
    url: "https://www.thehealthsite.com/feed/",
  },
  {
    aliases: [],
    categoryId: "in-health",
    id: "hindustan-times-health-in",
    label: "Hindustan Times - Health",
    source: "hindustantimes.com",
    url: "https://www.hindustantimes.com/feeds/rss/lifestyle/health/rssfeed.xml",
  },
  {
    aliases: [],
    categoryId: "in-health",
    id: "express-healthcare",
    label: "Express Healthcare",
    source: "expresshealthcare.in",
    url: "https://www.expresshealthcare.in/feed/",
  },
  {
    aliases: [],
    categoryId: "in-health",
    id: "et-healthworld",
    label: "ET HealthWorld",
    source: "health.economictimes.indiatimes.com",
    url: "https://health.economictimes.indiatimes.com/rss/topstories",
  },
  {
    aliases: [],
    categoryId: "in-health",
    id: "medical-buyer",
    label: "Medical Buyer",
    source: "medicalbuyer.co.in",
    url: "https://medicalbuyer.co.in/feed/",
  },
  {
    aliases: [],
    categoryId: "in-health",
    id: "india-today-health",
    label: "India Today - Health",
    source: "indiatoday.in",
    url: "https://www.indiatoday.in/rss/1206515",
  },
]

const expectedInScienceFeedRecords = [
  {
    aliases: ["http://www.thehindu.com/sci-tech/science/?service=rss"],
    categoryId: "in-science",
    id: "the-hindu-science-in",
    label: "The Hindu - Science",
    source: "thehindu.com",
    url: "https://www.thehindu.com/sci-tech/science/?service=rss",
  },
  {
    aliases: ["http://www.dnaindia.com/feeds/scitech.xml"],
    categoryId: "in-science",
    id: "dna-scitech",
    label: "DNA India - Sci-Tech",
    source: "dnaindia.com",
    url: "https://www.dnaindia.com/feeds/scitech.xml",
  },
  {
    aliases: ["http://zeenews.india.com/rss/science-technology-news.xml"],
    categoryId: "in-science",
    id: "zee-science-environment",
    label: "Zee News - Science & Environment",
    source: "zeenews.india.com",
    url: "https://zeenews.india.com/rss/science-environment-news.xml",
  },
  {
    aliases: [],
    categoryId: "in-science",
    id: "india-bioscience",
    label: "IndiaBioscience",
    source: "indiabioscience.org",
    url: "https://indiabioscience.org/feed",
  },
  {
    aliases: [],
    categoryId: "in-science",
    id: "mongabay-india",
    label: "Mongabay India",
    source: "india.mongabay.com",
    url: "https://india.mongabay.com/feed/",
  },
  {
    aliases: [],
    categoryId: "in-science",
    id: "india-today-science",
    label: "India Today - Science",
    source: "indiatoday.in",
    url: "https://www.indiatoday.in/rss/1206516",
  },
]

const expectedInSportsFeedRecords = [
  {
    aliases: ["http://www.espncricinfo.com/rss/content/story/feeds/6.xml"],
    categoryId: "in-sports",
    id: "espncricinfo-india",
    label: "ESPNcricinfo - India",
    source: "espncricinfo.com",
    url: "https://www.espncricinfo.com/rss/content/story/feeds/6.xml",
  },
  {
    aliases: ["http://www.thehindu.com/sport/?service=rss"],
    categoryId: "in-sports",
    id: "the-hindu-sport-in",
    label: "The Hindu - Sport",
    source: "thehindu.com",
    url: "https://www.thehindu.com/sport/?service=rss",
  },
  {
    aliases: ["http://zeenews.india.com/rss/sports-news.xml"],
    categoryId: "in-sports",
    id: "zee-sports-in",
    label: "Zee News - Sports",
    source: "zeenews.india.com",
    url: "https://zeenews.india.com/rss/sports-news.xml",
  },
  {
    aliases: ["http://timesofindia.feedsportal.com/c/33039/f/533921/index.rss"],
    categoryId: "in-sports",
    id: "times-of-india-sports",
    label: "Times of India - Sports",
    source: "timesofindia.indiatimes.com",
    url: "https://timesofindia.indiatimes.com/rssfeeds/4719148.cms",
  },
  {
    aliases: ["http://syndication.indianexpress.com/rss/785/latest-news.xml"],
    categoryId: "in-sports",
    id: "indian-express-sports",
    label: "The Indian Express - Sports",
    source: "indianexpress.com",
    url: "https://indianexpress.com/section/sports/feed/",
  },
  {
    aliases: [],
    categoryId: "in-sports",
    id: "news18-sports-in",
    label: "News18 - Sports",
    source: "news18.com",
    url: "https://www.news18.com/commonfeeds/v1/eng/rss/sports.xml",
  },
]

const expectedInTechFeedRecords = [
  {
    aliases: ["http://indianexpress.com/section/technology/feed/"],
    categoryId: "in-tech",
    id: "indian-express-tech-in",
    label: "The Indian Express - Technology",
    source: "indianexpress.com",
    url: "https://indianexpress.com/section/technology/feed/",
  },
  {
    aliases: ["http://www.thehindu.com/sci-tech/?service=rss"],
    categoryId: "in-tech",
    id: "the-hindu-sci-tech",
    label: "The Hindu - Sci-Tech",
    source: "thehindu.com",
    url: "https://www.thehindu.com/sci-tech/?service=rss",
  },
  {
    aliases: ["http://www.thehindu.com/sci-tech/technology/?service=rss"],
    categoryId: "in-tech",
    id: "the-hindu-technology-in",
    label: "The Hindu - Technology",
    source: "thehindu.com",
    url: "https://www.thehindu.com/sci-tech/technology/?service=rss",
  },
  {
    aliases: ["http://zeenews.india.com/rss/science-technology-news.xml"],
    categoryId: "in-tech",
    id: "zee-science-technology-tech",
    label: "Zee News - Science & Technology",
    source: "zeenews.india.com",
    url: "https://zeenews.india.com/rss/science-environment-news.xml",
  },
  {
    aliases: ["http://www.business-standard.com/rss/technology-108.rss"],
    categoryId: "in-tech",
    id: "business-standard-technology",
    label: "Business Standard - Technology",
    source: "business-standard.com",
    url: "https://www.business-standard.com/rss/technology-108.rss",
  },
  {
    aliases: ["http://feeds.feedburner.com/NDTV-Tech"],
    categoryId: "in-tech",
    id: "gadgets-360",
    label: "Gadgets 360",
    source: "gadgets360.com",
    url: "https://feeds.feedburner.com/gadgets360-latest",
  },
  {
    aliases: [],
    categoryId: "in-tech",
    id: "medianama",
    label: "Medianama",
    source: "medianama.com",
    url: "https://www.medianama.com/feed/",
  },
  {
    aliases: [],
    categoryId: "in-tech",
    id: "inc42",
    label: "Inc42",
    source: "inc42.com",
    url: "https://inc42.com/feed/",
  },
  {
    aliases: [],
    categoryId: "in-tech",
    id: "digit",
    label: "Digit",
    source: "digit.in",
    url: "https://www.digit.in/feed/",
  },
  {
    aliases: [],
    categoryId: "in-tech",
    id: "beebom",
    label: "Beebom",
    source: "beebom.com",
    url: "https://beebom.com/feed/",
  },
]

const expectedInEntertainmentFeedRecords = [
  {
    aliases: ["http://rollingstoneindia.com/feed/"],
    categoryId: "in-entertainment",
    id: "rolling-stone-india",
    label: "Rolling Stone India",
    source: "rollingstoneindia.com",
    url: "https://rollingstoneindia.com/feed/",
  },
  {
    aliases: ["http://timesofindia.indiatimes.com/rssfeeds/1081479906.cms"],
    categoryId: "in-entertainment",
    id: "times-of-india-entertainment",
    label: "Times of India - Entertainment",
    source: "timesofindia.indiatimes.com",
    url: "https://timesofindia.indiatimes.com/rssfeeds/1081479906.cms",
  },
  {
    aliases: ["http://www.bollywoodhungama.com/rss/news.xml"],
    categoryId: "in-entertainment",
    id: "bollywood-hungama",
    label: "Bollywood Hungama",
    source: "bollywoodhungama.com",
    url: "https://www.bollywoodhungama.com/rss/news.xml",
  },
  {
    aliases: ["http://www.bollywoodlife.com/feed/"],
    categoryId: "in-entertainment",
    id: "bollywood-life",
    label: "Bollywood Life",
    source: "bollywoodlife.com",
    url: "https://www.bollywoodlife.com/feed/",
  },
  {
    aliases: ["http://www.dnaindia.com/feeds/entertainment.xml"],
    categoryId: "in-entertainment",
    id: "dna-entertainment",
    label: "DNA India - Entertainment",
    source: "dnaindia.com",
    url: "https://www.dnaindia.com/feeds/entertainment.xml",
  },
  {
    aliases: ["http://www.tellychakkar.com/rss.xml"],
    categoryId: "in-entertainment",
    id: "tellychakkar",
    label: "Tellychakkar",
    source: "tellychakkar.com",
    url: "https://www.tellychakkar.com/rss.xml",
  },
  {
    aliases: ["http://www.thehindu.com/entertainment/?service=rss"],
    categoryId: "in-entertainment",
    id: "the-hindu-entertainment-in",
    label: "The Hindu - Entertainment",
    source: "thehindu.com",
    url: "https://www.thehindu.com/entertainment/?service=rss",
  },
  {
    aliases: [],
    categoryId: "in-entertainment",
    id: "koimoi",
    label: "Koimoi",
    source: "koimoi.com",
    url: "https://www.koimoi.com/feed/",
  },
  {
    aliases: ["http://indianexpress.com/entertainment/feed/"],
    categoryId: "in-entertainment",
    id: "indian-express-entertainment-in",
    label: "The Indian Express - Entertainment",
    source: "indianexpress.com",
    url: "https://indianexpress.com/section/entertainment/feed/",
  },
  {
    aliases: ["http://feeds.hindustantimes.com/HT-Entertainment"],
    categoryId: "in-entertainment",
    id: "hindustan-times-entertainment-in",
    label: "Hindustan Times - Entertainment",
    source: "hindustantimes.com",
    url: "https://www.hindustantimes.com/feeds/rss/entertainment/rssfeed.xml",
  },
]

const expectedInGamingFeedRecords = [
  {
    aliases: [],
    categoryId: "in-gaming",
    id: "ign-india",
    label: "IGN India",
    source: "in.ign.com",
    url: "https://in.ign.com/feed.xml",
  },
  {
    aliases: [],
    categoryId: "in-gaming",
    id: "gamingonphone",
    label: "GamingonPhone",
    source: "gamingonphone.com",
    url: "https://gamingonphone.com/feed/",
  },
  {
    aliases: [],
    categoryId: "in-gaming",
    id: "talkesport",
    label: "TalkEsport",
    source: "talkesport.com",
    url: "https://www.talkesport.com/feed/",
  },
  {
    aliases: [],
    categoryId: "in-gaming",
    id: "gameffine",
    label: "Gameffine",
    source: "gameffine.com",
    url: "https://www.gameffine.com/feed/",
  },
  {
    aliases: ["http://www.pcquest.com/rss-2-2/?cat_slug=games"],
    categoryId: "in-gaming",
    id: "indian-video-gamer",
    label: "IndianVideoGamer",
    source: "indianvideogamer.com",
    url: "https://www.indianvideogamer.com/feed/",
  },
]

const expectedGbGeneralFeedRecords = [
  {
    aliases: ["http://www.theguardian.com/world/rss"],
    categoryId: "gb-general",
    id: "guardian-world-gb",
    label: "The Guardian - World",
    source: "theguardian.com",
    url: "https://www.theguardian.com/world/rss",
  },
  {
    aliases: ["http://www.theweek.co.uk/feeds/all"],
    categoryId: "gb-general",
    id: "the-week-gb",
    label: "The Week",
    source: "theweek.com",
    url: "https://theweek.com/feeds.xml",
  },
  {
    aliases: ["http://feeds.bbci.co.uk/news/world/rss.xml"],
    categoryId: "gb-general",
    id: "bbc-world-gb",
    label: "BBC News - World",
    source: "bbc.co.uk",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
  },
  {
    aliases: ["http://feeds.bbci.co.uk/news/uk/rss.xml"],
    categoryId: "gb-general",
    id: "bbc-uk",
    label: "BBC News - UK",
    source: "bbc.co.uk",
    url: "https://feeds.bbci.co.uk/news/uk/rss.xml",
  },
  {
    aliases: ["http://www.theguardian.com/uk/rss"],
    categoryId: "gb-general",
    id: "guardian-uk",
    label: "The Guardian - UK",
    source: "theguardian.com",
    url: "https://www.theguardian.com/uk/rss",
  },
  {
    aliases: ["http://news.sky.com/feeds/rss/uk.xml"],
    categoryId: "gb-general",
    id: "sky-news-uk",
    label: "Sky News - UK",
    source: "skynews.com",
    url: "https://feeds.skynews.com/feeds/rss/uk.xml",
  },
  {
    aliases: ["http://www.ft.com/rss/world/uk"],
    categoryId: "gb-general",
    id: "ft-uk",
    label: "Financial Times - UK",
    source: "ft.com",
    url: "https://www.ft.com/world-uk?format=rss",
  },
  {
    aliases: ["http://www.standard.co.uk/news/rss"],
    categoryId: "gb-general",
    id: "standard-news",
    label: "The Standard - News",
    source: "standard.co.uk",
    url: "https://www.standard.co.uk/news/rss",
  },
  {
    aliases: ["http://www.oxfordmail.co.uk/news/rss/"],
    categoryId: "gb-general",
    id: "oxford-mail-news",
    label: "Oxford Mail - News",
    source: "oxfordmail.co.uk",
    url: "https://www.oxfordmail.co.uk/news/rss/",
  },
  {
    aliases: ["http://www.dailymail.co.uk/news/index.rss"],
    categoryId: "gb-general",
    id: "daily-mail-news-gb",
    label: "Daily Mail - News",
    source: "dailymail.com",
    url: "https://www.dailymail.com/news/index.rss",
  },
  {
    aliases: [],
    categoryId: "gb-general",
    id: "daily-express-uk-news",
    label: "Daily Express - UK News",
    source: "express.co.uk",
    url: "http://feeds.feedburner.com/daily-express-uk-news",
  },
  {
    aliases: ["http://www.manchestereveningnews.co.uk/rss.xml"],
    categoryId: "gb-general",
    id: "manchester-evening-news",
    label: "Manchester Evening News",
    source: "manchestereveningnews.co.uk",
    url: "https://www.manchestereveningnews.co.uk/?service=rss",
  },
  {
    aliases: [],
    categoryId: "gb-general",
    id: "herald-scotland-news",
    label: "The Herald - Scotland News",
    source: "heraldscotland.com",
    url: "http://feeds.feedburner.com/ScottishNewsHeraldScotland",
  },
  {
    aliases: [],
    categoryId: "gb-general",
    id: "independent-uk",
    label: "The Independent - UK",
    source: "the-independent.com",
    url: "https://www.the-independent.com/news/uk/rss",
  },
]

const expectedGbPoliticsFeedRecords = [
  {
    aliases: ["http://feeds.skynews.com/feeds/rss/politics.xml"],
    categoryId: "gb-politics",
    id: "sky-politics",
    label: "Sky News - Politics",
    source: "skynews.com",
    url: "https://feeds.skynews.com/feeds/rss/politics.xml",
  },
  {
    aliases: ["http://www.ft.com/rss/world/uk/politics"],
    categoryId: "gb-politics",
    id: "ft-uk-politics",
    label: "Financial Times - UK Politics",
    source: "ft.com",
    url: "https://www.ft.com/uk-politics?format=rss",
  },
  {
    aliases: ["http://feeds.bbci.co.uk/news/politics/rss.xml"],
    categoryId: "gb-politics",
    id: "bbc-politics-gb",
    label: "BBC News - Politics",
    source: "bbc.co.uk",
    url: "https://feeds.bbci.co.uk/news/politics/rss.xml",
  },
  {
    aliases: ["http://feeds.theguardian.com/theguardian/politics/rss"],
    categoryId: "gb-politics",
    id: "guardian-politics-gb",
    label: "The Guardian - Politics",
    source: "theguardian.com",
    url: "https://feeds.theguardian.com/theguardian/politics/rss",
  },
  {
    aliases: ["http://www.standard.co.uk/news/politics/rss"],
    categoryId: "gb-politics",
    id: "standard-politics",
    label: "The Standard - Politics",
    source: "standard.co.uk",
    url: "https://www.standard.co.uk/news/politics/rss",
  },
  {
    aliases: [],
    categoryId: "gb-politics",
    id: "independent-politics-gb",
    label: "The Independent - UK Politics",
    source: "the-independent.com",
    url: "https://www.the-independent.com/news/uk/politics/rss",
  },
  {
    aliases: [],
    categoryId: "gb-politics",
    id: "labour-list",
    label: "LabourList",
    source: "labourlist.org",
    url: "https://labourlist.org/feed/",
  },
  {
    aliases: [],
    categoryId: "gb-politics",
    id: "conservative-home",
    label: "ConservativeHome",
    source: "conservativehome.com",
    url: "https://conservativehome.com/feed/",
  },
]

const expectedGbBusinessFeedRecords = [
  {
    aliases: [],
    categoryId: "gb-business",
    id: "daily-express-finance",
    label: "Daily Express - Finance",
    source: "express.co.uk",
    url: "http://feeds.feedburner.com/daily-express-finance-news",
  },
  {
    aliases: ["http://www.manchestereveningnews.co.uk/business/rss.xml"],
    categoryId: "gb-business",
    id: "men-business",
    label: "Manchester Evening News - Business",
    source: "manchestereveningnews.co.uk",
    url: "https://www.manchestereveningnews.co.uk/business/?service=rss",
  },
  {
    aliases: ["http://feeds.theguardian.com/theguardian/uk/business/rss"],
    categoryId: "gb-business",
    id: "guardian-business-gb",
    label: "The Guardian - Business",
    source: "theguardian.com",
    url: "https://feeds.theguardian.com/theguardian/uk/business/rss",
  },
  {
    aliases: ["http://feeds.bbci.co.uk/news/business/rss.xml"],
    categoryId: "gb-business",
    id: "bbc-business-gb",
    label: "BBC News - Business",
    source: "bbc.co.uk",
    url: "https://feeds.bbci.co.uk/news/business/rss.xml",
  },
  {
    aliases: ["http://www.ibtimes.co.uk/rss/uk"],
    categoryId: "gb-business",
    id: "ibtimes-uk-business",
    label: "IBTimes UK",
    source: "ibtimes.co.uk",
    url: "https://feeds.ibtimes.co.uk/feeds/bhsz8.rss",
  },
  {
    aliases: [],
    categoryId: "gb-business",
    id: "ft-companies-gb",
    label: "Financial Times - Companies",
    source: "ft.com",
    url: "https://www.ft.com/companies?format=rss",
  },
  {
    aliases: [],
    categoryId: "gb-business",
    id: "city-am",
    label: "City A.M.",
    source: "cityam.com",
    url: "https://www.cityam.com/feed/",
  },
  {
    aliases: [],
    categoryId: "gb-business",
    id: "this-is-money",
    label: "This is Money",
    source: "thisismoney.co.uk",
    url: "https://www.thisismoney.co.uk/money/index.rss",
  },
  {
    aliases: [],
    categoryId: "gb-business",
    id: "business-matters",
    label: "Business Matters",
    source: "bmmagazine.co.uk",
    url: "https://bmmagazine.co.uk/feed/",
  },
  {
    aliases: [],
    categoryId: "gb-business",
    id: "retail-gazette",
    label: "Retail Gazette",
    source: "retailgazette.co.uk",
    url: "https://www.retailgazette.co.uk/feed/",
  },
]

const expectedGbHealthFeedRecords = [
  {
    aliases: ["http://www.theguardian.com/lifeandstyle/health-and-wellbeing/rss"],
    categoryId: "gb-health",
    id: "guardian-health-wellbeing-gb",
    label: "The Guardian - Health & Wellbeing",
    source: "theguardian.com",
    url: "https://www.theguardian.com/lifeandstyle/health-and-wellbeing/rss",
  },
  {
    aliases: ["http://feeds.bbci.co.uk/news/health/rss.xml"],
    categoryId: "gb-health",
    id: "bbc-health-gb",
    label: "BBC News - Health",
    source: "bbc.co.uk",
    url: "https://feeds.bbci.co.uk/news/health/rss.xml",
  },
  {
    aliases: [
      "http://www.independent.co.uk/life-style/health-and-families/health-news/rss",
    ],
    categoryId: "gb-health",
    id: "independent-health-gb",
    label: "The Independent - Health News",
    source: "the-independent.com",
    url: "https://www.the-independent.com/life-style/health-and-families/health-news/rss",
  },
  {
    aliases: ["http://www.express.co.uk/posts/rss/11/health"],
    categoryId: "gb-health",
    id: "daily-express-health",
    label: "Daily Express - Health",
    source: "express.co.uk",
    url: "https://www.express.co.uk/posts/rss/11/health",
  },
  {
    aliases: ["http://www.dailymail.co.uk/health/index.rss"],
    categoryId: "gb-health",
    id: "daily-mail-health-gb",
    label: "Daily Mail - Health",
    source: "dailymail.com",
    url: "https://www.dailymail.com/health/index.rss",
  },
  {
    aliases: [],
    categoryId: "gb-health",
    id: "nhs-england",
    label: "NHS England",
    source: "england.nhs.uk",
    url: "https://www.england.nhs.uk/feed/",
  },
  {
    aliases: [],
    categoryId: "gb-health",
    id: "uk-health-security-agency",
    label: "UK Health Security Agency",
    source: "ukhsa.blog.gov.uk",
    url: "https://ukhsa.blog.gov.uk/feed/",
  },
  {
    aliases: [],
    categoryId: "gb-health",
    id: "nursing-times",
    label: "Nursing Times",
    source: "nursingtimes.net",
    url: "https://www.nursingtimes.net/feed/",
  },
  {
    aliases: [],
    categoryId: "gb-health",
    id: "digital-health",
    label: "Digital Health",
    source: "digitalhealth.net",
    url: "https://www.digitalhealth.net/feed/",
  },
]

const expectedGbScienceFeedRecords = [
  {
    aliases: ["http://www.theguardian.com/uk/environment/rss"],
    categoryId: "gb-science",
    id: "guardian-environment-gb",
    label: "The Guardian - Environment",
    source: "theguardian.com",
    url: "https://www.theguardian.com/uk/environment/rss",
  },
  {
    aliases: ["https://www.newscientist.com/feed/home"],
    categoryId: "gb-science",
    id: "new-scientist-gb",
    label: "New Scientist",
    source: "newscientist.com",
    url: "https://www.newscientist.com/feed/home/",
  },
  {
    aliases: ["http://feeds.theguardian.com/theguardian/science/rss"],
    categoryId: "gb-science",
    id: "guardian-science-gb",
    label: "The Guardian - Science",
    source: "theguardian.com",
    url: "https://feeds.theguardian.com/theguardian/science/rss",
  },
  {
    aliases: ["http://feeds.bbci.co.uk/news/science_and_environment/rss.xml"],
    categoryId: "gb-science",
    id: "bbc-science-environment-gb",
    label: "BBC News - Science & Environment",
    source: "bbc.co.uk",
    url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
  },
  {
    aliases: ["http://www.independent.co.uk/news/science/rss"],
    categoryId: "gb-science",
    id: "independent-science-gb",
    label: "The Independent - Science",
    source: "independent.co.uk",
    url: "http://www.independent.co.uk/news/science/rss",
  },
  {
    aliases: ["http://www.theregister.co.uk/science/headlines.atom"],
    categoryId: "gb-science",
    id: "register-science",
    label: "The Register - Science",
    source: "theregister.com",
    url: "https://api.theregister.com/api/v1/article?orderBy=published&site_id=2&remapper=rss",
  },
  {
    aliases: ["http://www.dailymail.co.uk/sciencetech/articles.rss"],
    categoryId: "gb-science",
    id: "daily-mail-science-tech",
    label: "Daily Mail - Science & Tech",
    source: "dailymail.com",
    url: "https://www.dailymail.com/sciencetech/articles.rss",
  },
  {
    aliases: ["http://www.mirror.co.uk/news/technology-science/rss.xml"],
    categoryId: "gb-science",
    id: "mirror-technology-science",
    label: "Mirror - Technology & Science",
    source: "mirror.co.uk",
    url: "https://www.mirror.co.uk/news/technology-science/?service=rss",
  },
  {
    aliases: [],
    categoryId: "gb-science",
    id: "science-museum-blog",
    label: "Science Museum Blog",
    source: "sciencemuseum.org.uk",
    url: "https://blog.sciencemuseum.org.uk/feed/",
  },
  {
    aliases: [],
    categoryId: "gb-science",
    id: "ukri-news",
    label: "UKRI - News",
    source: "ukri.org",
    url: "https://www.ukri.org/news/feed/",
  },
]

const expectedGbSportsFeedRecords = [
  {
    aliases: ["http://www.theguardian.com/football/rss"],
    categoryId: "gb-sports",
    id: "guardian-football-gb",
    label: "The Guardian - Football",
    source: "theguardian.com",
    url: "https://www.theguardian.com/football/rss",
  },
  {
    aliases: [],
    categoryId: "gb-sports",
    id: "daily-express-sport",
    label: "Daily Express - Sport",
    source: "express.co.uk",
    url: "http://feeds.feedburner.com/daily-express-sport-news",
  },
  {
    aliases: ["http://www.mirror.co.uk/sport/rss.xml"],
    categoryId: "gb-sports",
    id: "mirror-sport-gb",
    label: "Mirror - Sport",
    source: "mirror.co.uk",
    url: "https://www.mirror.co.uk/sport/?service=rss",
  },
  {
    aliases: ["http://www.standard.co.uk/sport/football/rss"],
    categoryId: "gb-sports",
    id: "standard-football",
    label: "The Standard - Football",
    source: "standard.co.uk",
    url: "https://www.standard.co.uk/sport/football/rss",
  },
  {
    aliases: ["http://www.skysports.com/rss/0,20514,12040,00.xml"],
    categoryId: "gb-sports",
    id: "sky-sports-news-gb",
    label: "Sky Sports - News",
    source: "skysports.com",
    url: "https://www.skysports.com/rss/12040",
  },
  {
    aliases: [],
    categoryId: "gb-sports",
    id: "sky-sports-football-gb",
    label: "Sky Sports - Football",
    source: "skysports.com",
    url: "https://www.skysports.com/rss/11661",
  },
  {
    aliases: ["http://feeds.theguardian.com/theguardian/uk/sport/rss"],
    categoryId: "gb-sports",
    id: "guardian-sport-gb",
    label: "The Guardian - Sport",
    source: "theguardian.com",
    url: "https://feeds.theguardian.com/theguardian/uk/sport/rss",
  },
  {
    aliases: ["http://feeds.bbci.co.uk/sport/0/rss.xml?edition=uk"],
    categoryId: "gb-sports",
    id: "bbc-sport-uk",
    label: "BBC Sport - UK",
    source: "bbc.co.uk",
    url: "https://feeds.bbci.co.uk/sport/rss.xml",
  },
  {
    aliases: ["http://www.dailymail.co.uk/sport/index.rss"],
    categoryId: "gb-sports",
    id: "daily-mail-sport-gb",
    label: "Daily Mail - Sport",
    source: "dailymail.com",
    url: "https://www.dailymail.com/sport/index.rss",
  },
  {
    aliases: ["http://metro.co.uk/sport/feed/"],
    categoryId: "gb-sports",
    id: "metro-sport",
    label: "Metro - Sport",
    source: "metro.co.uk",
    url: "https://metro.co.uk/sport/feed/",
  },
]

const expectedGbTechFeedRecords = [
  {
    aliases: [],
    categoryId: "gb-tech",
    id: "gizmodo-uk",
    label: "Gizmodo UK",
    source: "gizmodo.com",
    url: "http://feeds.feedburner.com/uk/gizmodo",
  },
  {
    aliases: ["http://feeds.skynews.com/feeds/rss/technology.xml"],
    categoryId: "gb-tech",
    id: "sky-technology",
    label: "Sky News - Technology",
    source: "skynews.com",
    url: "https://feeds.skynews.com/feeds/rss/technology.xml",
  },
  {
    aliases: ["http://www.techrepublic.com/rssfeeds/blog/european-technology/"],
    categoryId: "gb-tech",
    id: "techrepublic-eu",
    label: "TechRepublic - EU",
    source: "techrepublic.com",
    url: "https://www.techrepublic.com/rssfeeds/topic/eu/",
  },
  {
    aliases: ["http://feeds.theguardian.com/theguardian/technology/rss"],
    categoryId: "gb-tech",
    id: "guardian-technology-gb",
    label: "The Guardian - Technology",
    source: "theguardian.com",
    url: "https://www.theguardian.com/us/technology/rss",
  },
  {
    aliases: ["http://feeds.bbci.co.uk/news/technology/rss.xml#"],
    categoryId: "gb-tech",
    id: "bbc-technology-gb",
    label: "BBC News - Technology",
    source: "bbc.co.uk",
    url: "https://feeds.bbci.co.uk/news/technology/rss.xml",
  },
  {
    aliases: ["http://feeds.webservice.techradar.com/rss/new"],
    categoryId: "gb-tech",
    id: "techradar-uk",
    label: "TechRadar",
    source: "techradar.com",
    url: "https://www.techradar.com/feeds.xml",
  },
  {
    aliases: [],
    categoryId: "gb-tech",
    id: "the-register",
    label: "The Register",
    source: "theregister.com",
    url: "https://api.theregister.com/api/v1/article?orderBy=published&site_id=2&remapper=rss",
  },
  {
    aliases: [],
    categoryId: "gb-tech",
    id: "computerweekly-uk",
    label: "Computer Weekly",
    source: "computerweekly.com",
    url: "https://www.computerweekly.com/rss/All-Computer-Weekly-content.xml",
  },
  {
    aliases: [],
    categoryId: "gb-tech",
    id: "uktn",
    label: "UKTN",
    source: "uktech.news",
    url: "https://www.uktech.news/feed",
  },
  {
    aliases: [],
    categoryId: "gb-tech",
    id: "silicon-uk",
    label: "Silicon UK",
    source: "silicon.co.uk",
    url: "https://www.silicon.co.uk/feed",
  },
  {
    aliases: [],
    categoryId: "gb-tech",
    id: "tech-monitor",
    label: "Tech Monitor",
    source: "techmonitor.ai",
    url: "https://techmonitor.ai/feed",
  },
]

const expectedGbEntertainmentFeedRecords = [
  {
    aliases: ["http://www.express.co.uk/posts/rss/79/showbiznews"],
    categoryId: "gb-entertainment",
    id: "daily-express-showbiz",
    label: "Daily Express - Showbiz",
    source: "express.co.uk",
    url: "https://www.express.co.uk/posts/rss/79/showbiznews",
  },
  {
    aliases: ["http://metro.co.uk/entertainment/showbiz/feed/"],
    categoryId: "gb-entertainment",
    id: "metro-showbiz",
    label: "Metro - Showbiz",
    source: "metro.co.uk",
    url: "https://metro.co.uk/entertainment/showbiz/feed/",
  },
  {
    aliases: ["http://feeds.skynews.com/feeds/rss/entertainment.xml"],
    categoryId: "gb-entertainment",
    id: "sky-entertainment",
    label: "Sky News - Entertainment",
    source: "skynews.com",
    url: "https://feeds.skynews.com/feeds/rss/entertainment.xml",
  },
  {
    aliases: ["http://www.standard.co.uk/showbiz/rss"],
    categoryId: "gb-entertainment",
    id: "standard-showbiz",
    label: "The Standard - Showbiz",
    source: "standard.co.uk",
    url: "https://www.standard.co.uk/showbiz/rss",
  },
  {
    aliases: ["http://www.manchestereveningnews.co.uk/news/showbiz-news/rss.xml"],
    categoryId: "gb-entertainment",
    id: "men-showbiz",
    label: "Manchester Evening News - Showbiz",
    source: "manchestereveningnews.co.uk",
    url: "https://www.manchestereveningnews.co.uk/news/showbiz-news/?service=rss",
  },
  {
    aliases: ["http://www.theguardian.com/music/rss"],
    categoryId: "gb-entertainment",
    id: "guardian-music",
    label: "The Guardian - Music",
    source: "theguardian.com",
    url: "https://www.theguardian.com/music/rss",
  },
  {
    aliases: [],
    categoryId: "gb-entertainment",
    id: "fact-mag",
    label: "Fact Magazine",
    source: "factmag.com",
    url: "http://feeds.feedburner.com/factmag",
  },
  {
    aliases: ["http://www.theguardian.com/us/film/rss"],
    categoryId: "gb-entertainment",
    id: "guardian-film-gb",
    label: "The Guardian - Film",
    source: "theguardian.com",
    url: "https://www.theguardian.com/uk/film/rss",
  },
  {
    aliases: ["http://www.mirror.co.uk/tv/tv-news/rss.xml"],
    categoryId: "gb-entertainment",
    id: "mirror-tv",
    label: "Mirror - TV News",
    source: "mirror.co.uk",
    url: "https://www.mirror.co.uk/tv/tv-news/?service=rss",
  },
  {
    aliases: ["http://www.film-news.co.uk/rss/UK/news"],
    categoryId: "gb-entertainment",
    id: "film-news-uk",
    label: "Film News - UK",
    source: "film-news.co.uk",
    url: "https://www.film-news.co.uk/rss/UK/news",
  },
  {
    aliases: ["http://metro.co.uk/entertainment/tv/feed/"],
    categoryId: "gb-entertainment",
    id: "metro-tv",
    label: "Metro - TV",
    source: "metro.co.uk",
    url: "https://metro.co.uk/entertainment/tv/feed/",
  },
  {
    aliases: ["http://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml"],
    categoryId: "gb-entertainment",
    id: "bbc-entertainment-arts",
    label: "BBC News - Entertainment & Arts",
    source: "bbc.co.uk",
    url: "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml",
  },
  {
    aliases: ["http://www.independent.co.uk/arts-entertainment/tv/rss"],
    categoryId: "gb-entertainment",
    id: "independent-tv",
    label: "The Independent - TV & Radio",
    source: "the-independent.com",
    url: "https://www.the-independent.com/arts-entertainment/tv/rss",
  },
  {
    aliases: ["http://www.dailymail.co.uk/tvshowbiz/articles.rss"],
    categoryId: "gb-entertainment",
    id: "daily-mail-tv-showbiz",
    label: "Daily Mail - TV & Showbiz",
    source: "dailymail.com",
    url: "https://www.dailymail.com/tvshowbiz/articles.rss",
  },
  {
    aliases: ["http://www.hellomagazine.com/rss.xml"],
    categoryId: "gb-entertainment",
    id: "hello-magazine",
    label: "HELLO! Magazine",
    source: "hellomagazine.com",
    url: "https://www.hellomagazine.com/feeds/rss/any/any/any/12.xml",
  },
  {
    aliases: ["http://www.tntmagazine.com/entertainment/rss"],
    categoryId: "gb-entertainment",
    id: "tnt-entertainment",
    label: "TNT Magazine - Entertainment",
    source: "tntmagazine.com",
    url: "https://www.tntmagazine.com/leisure-entertainment/feed/",
  },
  {
    aliases: ["http://www.theguardian.com/tv-and-radio/entertainment/rss"],
    categoryId: "gb-entertainment",
    id: "guardian-tv-radio-entertainment",
    label: "The Guardian - TV & Radio",
    source: "theguardian.com",
    url: "https://www.theguardian.com/tv-and-radio/entertainment/rss",
  },
  {
    aliases: ["http://feeds2.feedburner.com/nmecom/rss/newsxml"],
    categoryId: "gb-entertainment",
    id: "nme-news",
    label: "NME - News",
    source: "nme.com",
    url: "https://www.nme.com/news/feed",
  },
  {
    aliases: ["http://www.clashmusic.com/rss.xml"],
    categoryId: "gb-entertainment",
    id: "clash-music",
    label: "Clash Magazine",
    source: "clashmusic.com",
    url: "https://www.clashmusic.com/feed/",
  },
  {
    aliases: ["http://www.uncut.co.uk/feed"],
    categoryId: "gb-entertainment",
    id: "uncut",
    label: "Uncut",
    source: "uncut.co.uk",
    url: "https://www.uncut.co.uk/feed/",
  },
  {
    aliases: [],
    categoryId: "gb-entertainment",
    id: "digital-spy",
    label: "Digital Spy",
    source: "digitalspy.com",
    url: "https://www.digitalspy.com/rss/all.xml/",
  },
]

const expectedGbGamingFeedRecords = [
  {
    aliases: ["http://www.eurogamer.net/?format=rss"],
    categoryId: "gb-gaming",
    id: "eurogamer-gb",
    label: "Eurogamer",
    source: "eurogamer.net",
    url: "https://www.eurogamer.net/feed",
  },
  {
    aliases: ["http://www.theguardian.com/technology/games/rss"],
    categoryId: "gb-gaming",
    id: "guardian-games-gb",
    label: "The Guardian - Games",
    source: "theguardian.com",
    url: "https://www.theguardian.com/games/rss",
  },
  {
    aliases: [],
    categoryId: "gb-gaming",
    id: "daily-star-gaming",
    label: "Daily Star - Gaming",
    source: "dailystar.co.uk",
    url: "http://feeds.feedburner.com/daily-star-Gaming",
  },
  {
    aliases: ["http://metro.co.uk/entertainment/gaming/feed/"],
    categoryId: "gb-gaming",
    id: "metro-gaming",
    label: "Metro - Gaming",
    source: "metro.co.uk",
    url: "https://metro.co.uk/entertainment/gaming/feed/",
  },
  {
    aliases: ["http://feeds.feedburner.com/RockPaperShotgun"],
    categoryId: "gb-gaming",
    id: "rock-paper-shotgun-gb",
    label: "Rock Paper Shotgun",
    source: "rockpapershotgun.com",
    url: "https://www.rockpapershotgun.com/feed",
  },
  {
    aliases: [],
    categoryId: "gb-gaming",
    id: "vg247",
    label: "VG247",
    source: "vg247.com",
    url: "https://www.vg247.com/feed",
  },
  {
    aliases: [],
    categoryId: "gb-gaming",
    id: "pcgamesn",
    label: "PCGamesN",
    source: "pcgamesn.com",
    url: "https://www.pcgamesn.com/mainrss.xml",
  },
  {
    aliases: ["http://www.gamesindustry.biz/rss/gamesindustry_news_feed.rss"],
    categoryId: "gb-gaming",
    id: "gamesindustry-gb",
    label: "GamesIndustry.biz",
    source: "gamesindustry.biz",
    url: "https://www.gamesindustry.biz/feed",
  },
]

const expectedAuGeneralFeedRecords = [
  {
    aliases: ["http://www.abc.net.au/news/feed/46182/rss.xml"],
    categoryId: "au-general",
    id: "abc-news-australia",
    label: "ABC News - Australia",
    source: "abc.net.au",
    url: "https://www.abc.net.au/news/feed/46182/rss.xml",
  },
  {
    aliases: ["http://www.theguardian.com/au/rss"],
    categoryId: "au-general",
    id: "guardian-australia",
    label: "The Guardian - Australia",
    source: "theguardian.com",
    url: "https://www.theguardian.com/au/rss",
  },
  {
    aliases: [],
    categoryId: "au-general",
    id: "sbs-news-australia",
    label: "SBS News - Australia",
    source: "sbs.com.au",
    url: "https://www.sbs.com.au/news/feed",
  },
  {
    aliases: [],
    categoryId: "au-general",
    id: "conversation-australia",
    label: "The Conversation - Australia",
    source: "theconversation.com",
    url: "https://theconversation.com/au/articles.atom",
  },
  {
    aliases: ["http://feeds.smh.com.au/rssheadlines/national.xml"],
    categoryId: "au-general",
    id: "smh-national-au",
    label: "Sydney Morning Herald - National",
    source: "smh.com.au",
    url: "https://www.smh.com.au/rss/national.xml",
  },
  {
    aliases: ["http://feeds.theage.com.au/rssheadlines/national.xml"],
    categoryId: "au-general",
    id: "the-age-national",
    label: "The Age - National",
    source: "theage.com.au",
    url: "https://www.theage.com.au/rss/national.xml",
  },
  {
    aliases: ["http://feeds.brisbanetimes.com.au/rssheadlines/national.xml"],
    categoryId: "au-general",
    id: "brisbane-times-national",
    label: "Brisbane Times - National",
    source: "brisbanetimes.com.au",
    url: "https://www.brisbanetimes.com.au/rss/national.xml",
  },
  {
    aliases: ["http://www.dailymail.co.uk/auhome/index.rss"],
    categoryId: "au-general",
    id: "daily-mail-australia",
    label: "Daily Mail - Australia",
    source: "dailymail.com",
    url: "https://www.dailymail.com/auhome/index.rss",
  },
]

const expectedAuPoliticsFeedRecords = [
  {
    aliases: ["http://www.abc.net.au/news/feed/1534/rss.xml"],
    categoryId: "au-politics",
    id: "abc-politics-au",
    label: "ABC News - Politics",
    source: "abc.net.au",
    url: "https://www.abc.net.au/news/feed/1534/rss.xml",
  },
  {
    aliases: ["http://www.rba.gov.au/rss/rss-cb-media-releases.xml"],
    categoryId: "au-politics",
    id: "rba-media-releases",
    label: "Reserve Bank of Australia - Media Releases",
    source: "rba.gov.au",
    url: "https://www.rba.gov.au/rss/rss-cb-media-releases.xml",
  },
  {
    aliases: ["http://www.crikey.com.au/politics/feed"],
    categoryId: "au-politics",
    id: "crikey-politics",
    label: "Crikey - Politics",
    source: "crikey.com.au",
    url: "https://www.crikey.com.au/politics/feed/",
  },
  {
    aliases: ["http://www.theguardian.com/world/australian-politics/rss"],
    categoryId: "au-politics",
    id: "guardian-australian-politics",
    label: "The Guardian - Australian Politics",
    source: "theguardian.com",
    url: "https://www.theguardian.com/australia-news/australian-politics/rss",
  },
  {
    aliases: [],
    categoryId: "au-politics",
    id: "smh-federal-politics",
    label: "Sydney Morning Herald - Federal Politics",
    source: "smh.com.au",
    url: "https://www.smh.com.au/rss/politics/federal.xml",
  },
  {
    aliases: [],
    categoryId: "au-politics",
    id: "the-age-federal-politics",
    label: "The Age - Federal Politics",
    source: "theage.com.au",
    url: "https://www.theage.com.au/rss/politics/federal.xml",
  },
  {
    aliases: [],
    categoryId: "au-politics",
    id: "conversation-politics-au",
    label: "The Conversation - Politics",
    source: "theconversation.com",
    url: "https://theconversation.com/au/politics/articles.atom",
  },
  {
    aliases: [],
    categoryId: "au-politics",
    id: "the-mandarin",
    label: "The Mandarin",
    source: "themandarin.com.au",
    url: "https://www.themandarin.com.au/feed/",
  },
  {
    aliases: [],
    categoryId: "au-politics",
    id: "michael-west-media",
    label: "Michael West Media",
    source: "michaelwest.com.au",
    url: "https://michaelwest.com.au/feed/",
  },
]

const expectedAuBusinessFeedRecords = [
  {
    aliases: ["http://www.dynamicbusiness.com.au/feed"],
    categoryId: "au-business",
    id: "dynamic-business",
    label: "Dynamic Business",
    source: "dynamicbusiness.com",
    url: "https://dynamicbusiness.com/feed.xml",
  },
  {
    aliases: ["http://www.abc.net.au/news/feed/51892/rss.xml"],
    categoryId: "au-business",
    id: "abc-business-au",
    label: "ABC News - Business",
    source: "abc.net.au",
    url: "https://www.abc.net.au/news/feed/51892/rss.xml",
  },
  {
    aliases: ["http://www.smh.com.au/rssheadlines/business.xml"],
    categoryId: "au-business",
    id: "smh-business-au",
    label: "Sydney Morning Herald - Business",
    source: "smh.com.au",
    url: "https://www.smh.com.au/rss/business.xml",
  },
  {
    aliases: [],
    categoryId: "au-business",
    id: "the-age-business",
    label: "The Age - Business",
    source: "theage.com.au",
    url: "https://www.theage.com.au/rss/business.xml",
  },
  {
    aliases: [],
    categoryId: "au-business",
    id: "smartcompany",
    label: "SmartCompany",
    source: "smartcompany.com.au",
    url: "https://www.smartcompany.com.au/feed/",
  },
  {
    aliases: [],
    categoryId: "au-business",
    id: "startup-daily",
    label: "Startup Daily",
    source: "startupdaily.net",
    url: "https://www.startupdaily.net/feed/",
  },
  {
    aliases: [],
    categoryId: "au-business",
    id: "prospa-small-business",
    label: "Prospa - Small Business Blog",
    source: "prospa.com",
    url: "https://www.prospa.com/blog/feed",
  },
  {
    aliases: [],
    categoryId: "au-business",
    id: "stockhead",
    label: "Stockhead",
    source: "stockhead.com.au",
    url: "https://stockhead.com.au/feed/",
  },
]

const expectedAuHealthFeedRecords = [
  {
    aliases: [],
    categoryId: "au-health",
    id: "conversation-health-au",
    label: "The Conversation - Health",
    source: "theconversation.com",
    url: "https://theconversation.com/au/health/articles.atom",
  },
  {
    aliases: [],
    categoryId: "au-health",
    id: "croakey-health",
    label: "Croakey Health Media",
    source: "croakey.org",
    url: "https://www.croakey.org/feed/",
  },
  {
    aliases: [],
    categoryId: "au-health",
    id: "australian-ageing-agenda",
    label: "Australian Ageing Agenda",
    source: "australianageingagenda.com.au",
    url: "https://www.australianageingagenda.com.au/feed/",
  },
  {
    aliases: ["http://www.wellbeing.com.au/blog/feed/"],
    categoryId: "au-health",
    id: "wellbeing-magazine",
    label: "WellBeing Magazine",
    source: "wellbeing.com.au",
    url: "https://www.wellbeing.com.au/feed",
  },
  {
    aliases: [],
    categoryId: "au-health",
    id: "medical-republic",
    label: "Medical Republic",
    source: "medicalrepublic.com.au",
    url: "https://www.medicalrepublic.com.au/feed",
  },
]

const expectedAuScienceFeedRecords = [
  {
    aliases: [],
    categoryId: "au-science",
    id: "conversation-science-tech-au",
    label: "The Conversation - Science & Tech",
    source: "theconversation.com",
    url: "https://theconversation.com/au/technology/articles.atom",
  },
  {
    aliases: [],
    categoryId: "au-science",
    id: "conversation-environment-au",
    label: "The Conversation - Environment & Energy",
    source: "theconversation.com",
    url: "https://theconversation.com/au/environment/articles.atom",
  },
  {
    aliases: [],
    categoryId: "au-science",
    id: "sciencealert",
    label: "ScienceAlert",
    source: "sciencealert.com",
    url: "https://www.sciencealert.com/feed",
  },
  {
    aliases: [],
    categoryId: "au-science",
    id: "australian-geographic",
    label: "Australian Geographic",
    source: "australiangeographic.com.au",
    url: "https://www.australiangeographic.com.au/feed/",
  },
  {
    aliases: ["http://www.theage.com.au/rssheadlines/technology-news/article/rss.xml"],
    categoryId: "au-science",
    id: "the-age-technology-science",
    label: "The Age - Technology",
    source: "theage.com.au",
    url: "https://www.theage.com.au/rss/technology.xml",
  },
  {
    aliases: ["http://www.watoday.com.au/rssheadlines/technology-news/article/rss.xml"],
    categoryId: "au-science",
    id: "wa-today-technology-science",
    label: "WA Today - Technology",
    source: "watoday.com.au",
    url: "https://www.watoday.com.au/rss/technology.xml",
  },
]

const expectedAuSportsFeedRecords = [
  {
    aliases: ["http://feeds.news.com.au/public/rss/2.0/fs_breaking_news_13.xml"],
    categoryId: "au-sports",
    id: "fox-sports-australia",
    label: "Fox Sports Australia",
    source: "foxsports.com.au",
    url: "https://www.foxsports.com.au/content-feeds/breaking-news/",
  },
  {
    aliases: ["http://www.abc.net.au/news/feed/45924/rss.xml"],
    categoryId: "au-sports",
    id: "abc-sport-au",
    label: "ABC News - Sport",
    source: "abc.net.au",
    url: "https://www.abc.net.au/news/feed/45924/rss.xml",
  },
  {
    aliases: ["http://feeds.smh.com.au/rssheadlines/sport.xml"],
    categoryId: "au-sports",
    id: "smh-sport-au",
    label: "Sydney Morning Herald - Sport",
    source: "smh.com.au",
    url: "https://www.smh.com.au/rss/sport.xml",
  },
  {
    aliases: ["http://feeds.theage.com.au/rssheadlines/sport.xml"],
    categoryId: "au-sports",
    id: "the-age-sport",
    label: "The Age - Sport",
    source: "theage.com.au",
    url: "https://www.theage.com.au/rss/sport.xml",
  },
  {
    aliases: [],
    categoryId: "au-sports",
    id: "espn-australia",
    label: "ESPN Australia",
    source: "espn.com.au",
    url: "https://www.espn.com.au/espn/rss/news",
  },
  {
    aliases: [],
    categoryId: "au-sports",
    id: "sporting-news-australia",
    label: "Sporting News Australia",
    source: "sportingnews.com",
    url: "https://www.sportingnews.com/au/rss",
  },
]

const expectedAuTechFeedRecords = [
  {
    aliases: ["http://www.smh.com.au/rssheadlines/technology-news/article/rss.xml"],
    categoryId: "au-tech",
    id: "smh-technology-au",
    label: "Sydney Morning Herald - Technology",
    source: "smh.com.au",
    url: "https://www.smh.com.au/rss/technology.xml",
  },
  {
    aliases: ["http://techau.com.au/feed/"],
    categoryId: "au-tech",
    id: "techau",
    label: "techAU",
    source: "techau.com.au",
    url: "https://techau.com.au/feed/",
  },
  {
    aliases: ["http://www.techrepublic.com/rssfeeds/blog/australian-technology/"],
    categoryId: "au-tech",
    id: "techrepublic-australia",
    label: "TechRepublic - Australia",
    source: "techrepublic.com",
    url: "https://www.techrepublic.com/rssfeeds/topic/australia/",
  },
  {
    aliases: [],
    categoryId: "au-tech",
    id: "kotaku-australia",
    label: "Kotaku Australia",
    source: "kotaku.com.au",
    url: "https://kotaku.com.au/feed/",
  },
  {
    aliases: [],
    categoryId: "au-tech",
    id: "tech-guide-au",
    label: "Tech Guide",
    source: "techguide.com.au",
    url: "https://www.techguide.com.au/feed/",
  },
  {
    aliases: [],
    categoryId: "au-tech",
    id: "eftm",
    label: "EFTM",
    source: "eftm.com",
    url: "https://eftm.com/feed",
  },
  {
    aliases: [],
    categoryId: "au-tech",
    id: "pickr",
    label: "Pickr",
    source: "pickr.com.au",
    url: "https://www.pickr.com.au/feed/",
  },
  {
    aliases: [],
    categoryId: "au-tech",
    id: "itnews-australia",
    label: "iTnews",
    source: "itnews.com.au",
    url: "https://www.itnews.com.au/RSS/rss.ashx",
  },
]

const expectedAuEntertainmentFeedRecords = [
  {
    aliases: ["http://feeds.smh.com.au/rssheadlines/entertainment.xml"],
    categoryId: "au-entertainment",
    id: "smh-culture-au",
    label: "Sydney Morning Herald - Culture",
    source: "smh.com.au",
    url: "https://www.smh.com.au/rss/culture.xml",
  },
  {
    aliases: [],
    categoryId: "au-entertainment",
    id: "guardian-australia-culture",
    label: "The Guardian - Australia Culture",
    source: "theguardian.com",
    url: "https://www.theguardian.com/au/culture/rss",
  },
  {
    aliases: [],
    categoryId: "au-entertainment",
    id: "abc-arts-au",
    label: "ABC News - Arts",
    source: "abc.net.au",
    url: "https://www.abc.net.au/news/feed/1044/rss.xml",
  },
  {
    aliases: [],
    categoryId: "au-entertainment",
    id: "pedestrian-tv",
    label: "PEDESTRIAN.TV",
    source: "pedestrian.tv",
    url: "https://www.pedestrian.tv/feed/",
  },
  {
    aliases: [],
    categoryId: "au-entertainment",
    id: "concrete-playground-sydney",
    label: "Concrete Playground - Sydney",
    source: "concreteplayground.com",
    url: "https://concreteplayground.com/sydney/feed",
  },
  {
    aliases: [],
    categoryId: "au-entertainment",
    id: "music-feeds-au",
    label: "Music Feeds",
    source: "musicfeeds.com.au",
    url: "https://musicfeeds.com.au/feed/",
  },
  {
    aliases: ["http://www.spotlightreport.net/feed"],
    categoryId: "au-entertainment",
    id: "spotlight-report",
    label: "Spotlight Report",
    source: "spotlightreport.net",
    url: "https://spotlightreport.net/feed",
  },
]

const expectedBdGeneralFeedRecords = [
  {
    aliases: ["https://www.thedailystar.net/frontpage/rss.xml"],
    categoryId: "bd-general",
    id: "daily-star-bangladesh",
    label: "The Daily Star",
    source: "thedailystar.net",
    url: "https://www.thedailystar.net/taxonomy/term/107/rss.xml",
  },
  {
    aliases: ["https://www.bd24live.com/feed"],
    categoryId: "bd-general",
    id: "bd24live",
    label: "BD24Live.com",
    source: "bd24live.com",
    url: "https://www.bd24live.com/feed/",
  },
  {
    aliases: [],
    categoryId: "bd-general",
    id: "banglanews24",
    label: "BanglaNews24",
    source: "banglanews24.com",
    url: "https://www.banglanews24.com/rss.xml",
  },
  {
    aliases: [],
    categoryId: "bd-general",
    id: "jagonews24",
    label: "Jago News 24",
    source: "jagonews24.com",
    url: "https://www.jagonews24.com/rss/rss.xml",
  },
  {
    aliases: ["https://www.prothomalo.com/feed/"],
    categoryId: "bd-general",
    id: "prothom-alo",
    label: "Prothom Alo",
    source: "prothomalo.com",
    url: "https://www.prothomalo.com/stories.rss",
  },
]

const expectedAiFeedRecords = [
  {
    aliases: [],
    categoryId: "ai",
    id: "openai-news",
    label: "OpenAI News",
    source: "openai.com",
    url: "https://openai.com/news/rss.xml",
  },
  {
    aliases: [],
    categoryId: "ai",
    id: "google-deepmind-news",
    label: "Google DeepMind News",
    source: "deepmind.google",
    url: "https://deepmind.google/blog/rss.xml",
  },
  {
    aliases: [],
    categoryId: "ai",
    id: "google-ai-blog",
    label: "Google AI",
    source: "blog.google",
    url: "https://blog.google/innovation-and-ai/technology/ai/rss/",
  },
  {
    aliases: [],
    categoryId: "ai",
    id: "google-research-blog",
    label: "Google Research Blog",
    source: "research.google",
    url: "https://research.google/blog/rss/",
  },
  {
    aliases: [],
    categoryId: "ai",
    id: "mit-news-ai",
    label: "MIT News - Artificial Intelligence",
    source: "news.mit.edu",
    url: "https://news.mit.edu/rss/topic/artificial-intelligence2",
  },
  {
    aliases: [],
    categoryId: "ai",
    id: "mit-technology-review-ai",
    label: "MIT Technology Review - AI",
    source: "technologyreview.com",
    url: "https://www.technologyreview.com/topic/artificial-intelligence/feed/",
  },
  {
    aliases: [],
    categoryId: "ai",
    id: "venturebeat-ai",
    label: "VentureBeat - AI",
    source: "venturebeat.com",
    url: "https://venturebeat.com/category/ai/feed/",
  },
  {
    aliases: [],
    categoryId: "ai",
    id: "techcrunch-ai",
    label: "TechCrunch - AI",
    source: "techcrunch.com",
    url: "https://techcrunch.com/category/artificial-intelligence/feed/",
  },
  {
    aliases: [],
    categoryId: "ai",
    id: "wired-ai",
    label: "WIRED - AI",
    source: "wired.com",
    url: "https://www.wired.com/feed/tag/ai/latest/rss",
  },
  {
    aliases: [],
    categoryId: "ai",
    id: "the-verge-ai",
    label: "The Verge - AI",
    source: "theverge.com",
    url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
  },
  {
    aliases: [],
    categoryId: "ai",
    id: "ars-technica-ai",
    label: "Ars Technica - AI",
    source: "arstechnica.com",
    url: "https://arstechnica.com/ai/feed/",
  },
  {
    aliases: [],
    categoryId: "ai",
    id: "hugging-face-blog",
    label: "Hugging Face Blog",
    source: "huggingface.co",
    url: "https://huggingface.co/blog/feed.xml",
  },
  {
    aliases: [],
    categoryId: "ai",
    id: "the-gradient",
    label: "The Gradient",
    source: "thegradient.pub",
    url: "https://thegradient.pub/rss/",
  },
  {
    aliases: [],
    categoryId: "ai",
    id: "bair-blog",
    label: "BAIR Blog",
    source: "bair.berkeley.edu",
    url: "https://bair.berkeley.edu/blog/feed.xml",
  },
  {
    aliases: [],
    categoryId: "ai",
    id: "arxiv-artificial-intelligence",
    label: "arXiv - Artificial Intelligence",
    source: "arxiv.org",
    url: "https://rss.arxiv.org/rss/cs.AI",
  },
  {
    aliases: [],
    categoryId: "ai",
    id: "arxiv-machine-learning",
    label: "arXiv - Machine Learning",
    source: "arxiv.org",
    url: "https://rss.arxiv.org/rss/cs.LG",
  },
  {
    aliases: [],
    categoryId: "ai",
    id: "aws-machine-learning-blog",
    label: "AWS Machine Learning Blog",
    source: "aws.amazon.com",
    url: "https://aws.amazon.com/blogs/machine-learning/feed/",
  },
  {
    aliases: [],
    categoryId: "ai",
    id: "nvidia-deep-learning",
    label: "NVIDIA - Deep Learning",
    source: "nvidia.com",
    url: "https://blogs.nvidia.com/blog/category/deep-learning/feed/",
  },
]

const expectedMarketingFeedRecords = [
  {
    aliases: [],
    categoryId: "marketing",
    id: "hubspot-marketing-blog",
    label: "HubSpot Marketing Blog",
    source: "blog.hubspot.com",
    url: "https://blog.hubspot.com/marketing/rss.xml",
  },
  {
    aliases: [],
    categoryId: "marketing",
    id: "ahrefs-blog",
    label: "Ahrefs Blog",
    source: "ahrefs.com",
    url: "https://ahrefs.com/blog/feed/",
  },
  {
    aliases: [],
    categoryId: "marketing",
    id: "search-engine-journal",
    label: "Search Engine Journal",
    source: "searchenginejournal.com",
    url: "https://www.searchenginejournal.com/feed/",
  },
  {
    aliases: [],
    categoryId: "marketing",
    id: "search-engine-land",
    label: "Search Engine Land",
    source: "searchengineland.com",
    url: "https://searchengineland.com/feed",
  },
  {
    aliases: [],
    categoryId: "marketing",
    id: "social-media-examiner",
    label: "Social Media Examiner",
    source: "socialmediaexaminer.com",
    url: "https://www.socialmediaexaminer.com/feed/",
  },
  {
    aliases: [],
    categoryId: "marketing",
    id: "seth-godin",
    label: "Seth Godin",
    source: "seths.blog",
    url: "https://feeds.feedblitz.com/SethsBlog",
  },
  {
    aliases: [],
    categoryId: "marketing",
    id: "neil-patel",
    label: "Neil Patel",
    source: "neilpatel.com",
    url: "https://neilpatel.com/feed/",
  },
  {
    aliases: [],
    categoryId: "marketing",
    id: "buffer-blog",
    label: "Buffer Blog",
    source: "buffer.com",
    url: "https://buffer.com/resources/rss/",
  },
  {
    aliases: [],
    categoryId: "marketing",
    id: "sprout-social-insights",
    label: "Sprout Social Insights",
    source: "sproutsocial.com",
    url: "https://sproutsocial.com/insights/feed/",
  },
]

const expectedCuratedBusinessFeedRecords = [
  {
    aliases: [],
    categoryId: "business",
    id: "business-insider-all",
    label: "Business Insider",
    source: "businessinsider.com",
    url: "https://feeds.businessinsider.com/custom/all",
  },
  {
    aliases: [],
    categoryId: "business",
    id: "cnbc-business",
    label: "CNBC Business",
    source: "cnbc.com",
    url: "https://www.cnbc.com/id/10001147/device/rss/rss.html",
  },
  {
    aliases: [],
    categoryId: "business",
    id: "fast-company",
    label: "Fast Company",
    source: "fastcompany.com",
    url: "https://www.fastcompany.com/rss.xml",
  },
  {
    aliases: [],
    categoryId: "business",
    id: "fortune",
    label: "Fortune",
    source: "fortune.com",
    url: "https://fortune.com/feed/",
  },
  {
    aliases: [],
    categoryId: "business",
    id: "inc",
    label: "Inc.",
    source: "inc.com",
    url: "https://www.inc.com/rss/",
  },
  {
    aliases: [],
    categoryId: "business",
    id: "bloomberg-business",
    label: "Bloomberg Business",
    source: "bloomberg.com",
    url: "https://feeds.bloomberg.com/business/news.rss",
  },
  {
    aliases: [],
    categoryId: "business",
    id: "bloomberg-markets",
    label: "Bloomberg Markets",
    source: "bloomberg.com",
    url: "https://feeds.bloomberg.com/markets/news.rss",
  },
  {
    aliases: [],
    categoryId: "business",
    id: "forbes-business",
    label: "Forbes Business",
    source: "forbes.com",
    url: "https://www.forbes.com/business/feed/",
  },
  {
    aliases: [],
    categoryId: "business",
    id: "npr-business",
    label: "NPR Business",
    source: "npr.org",
    url: "https://feeds.npr.org/1006/rss.xml",
  },
]

const expectedComicsFeedRecords = [
  {
    aliases: [],
    categoryId: "comics",
    id: "xkcd",
    label: "xkcd",
    source: "xkcd.com",
    url: "https://xkcd.com/rss.xml",
  },
  {
    aliases: [],
    categoryId: "comics",
    id: "smbc",
    label: "Saturday Morning Breakfast Cereal",
    source: "smbc-comics.com",
    url: "https://www.smbc-comics.com/comic/rss",
  },
  {
    aliases: [],
    categoryId: "comics",
    id: "the-oatmeal",
    label: "The Oatmeal",
    source: "theoatmeal.com",
    url: "https://theoatmeal.com/feed/rss",
  },
  {
    aliases: [],
    categoryId: "comics",
    id: "penny-arcade",
    label: "Penny Arcade",
    source: "penny-arcade.com",
    url: "https://www.penny-arcade.com/feed",
  },
  {
    aliases: [],
    categoryId: "comics",
    id: "dinosaur-comics",
    label: "Dinosaur Comics",
    source: "qwantz.com",
    url: "https://qwantz.com/rssfeed.php",
  },
  {
    aliases: [],
    categoryId: "comics",
    id: "comics-beat",
    label: "Comics Beat",
    source: "comicsbeat.com",
    url: "https://www.comicsbeat.com/feed/",
  },
  {
    aliases: [],
    categoryId: "comics",
    id: "aipt-comics",
    label: "AIPT Comics",
    source: "aiptcomics.com",
    url: "https://aiptcomics.com/feed/",
  },
]

const expectedFoodFeedRecords = [
  {
    aliases: [],
    categoryId: "food",
    id: "smitten-kitchen",
    label: "Smitten Kitchen",
    source: "smittenkitchen.com",
    url: "https://smittenkitchen.com/feed/atom/",
  },
  {
    aliases: [],
    categoryId: "food",
    id: "bon-appetit",
    label: "Bon Appetit",
    source: "bonappetit.com",
    url: "https://www.bonappetit.com/feed/rss",
  },
  {
    aliases: [],
    categoryId: "food",
    id: "epicurious",
    label: "Epicurious",
    source: "epicurious.com",
    url: "https://www.epicurious.com/feed/rss",
  },
  {
    aliases: [],
    categoryId: "food",
    id: "budget-bytes",
    label: "Budget Bytes",
    source: "budgetbytes.com",
    url: "https://www.budgetbytes.com/feed/",
  },
  {
    aliases: [],
    categoryId: "food",
    id: "cookie-and-kate",
    label: "Cookie and Kate",
    source: "cookieandkate.com",
    url: "https://cookieandkate.com/feed/",
  },
  {
    aliases: [],
    categoryId: "food",
    id: "eater",
    label: "Eater",
    source: "eater.com",
    url: "https://www.eater.com/rss/index.xml",
  },
  {
    aliases: [],
    categoryId: "food",
    id: "minimalist-baker",
    label: "Minimalist Baker",
    source: "minimalistbaker.com",
    url: "https://minimalistbaker.com/feed/",
  },
  {
    aliases: [],
    categoryId: "food",
    id: "pinch-of-yum",
    label: "Pinch of Yum",
    source: "pinchofyum.com",
    url: "https://pinchofyum.com/feed",
  },
  {
    aliases: [],
    categoryId: "food",
    id: "the-kitchn",
    label: "The Kitchn",
    source: "thekitchn.com",
    url: "https://www.thekitchn.com/main.rss",
  },
  {
    aliases: [],
    categoryId: "food",
    id: "love-and-lemons",
    label: "Love and Lemons",
    source: "loveandlemons.com",
    url: "https://www.loveandlemons.com/feed/",
  },
]

const expectedDesignFeedRecords = [
  {
    aliases: [],
    categoryId: "design",
    id: "smashing-magazine",
    label: "Smashing Magazine",
    source: "smashingmagazine.com",
    url: "https://www.smashingmagazine.com/feed/",
  },
  {
    aliases: [],
    categoryId: "design",
    id: "a-list-apart",
    label: "A List Apart",
    source: "alistapart.com",
    url: "https://alistapart.com/main/feed/",
  },
  {
    aliases: [],
    categoryId: "design",
    id: "ux-collective",
    label: "UX Collective",
    source: "uxdesign.cc",
    url: "https://uxdesign.cc/feed",
  },
  {
    aliases: [],
    categoryId: "design",
    id: "nielsen-norman-group",
    label: "Nielsen Norman Group",
    source: "nngroup.com",
    url: "https://www.nngroup.com/feed/rss/",
  },
  {
    aliases: [],
    categoryId: "design",
    id: "creative-bloq",
    label: "Creative Bloq",
    source: "creativebloq.com",
    url: "https://www.creativebloq.com/feeds.xml",
  },
  {
    aliases: [],
    categoryId: "design",
    id: "design-milk",
    label: "Design Milk",
    source: "design-milk.com",
    url: "https://design-milk.com/feed/",
  },
  {
    aliases: [],
    categoryId: "design",
    id: "dezeen",
    label: "Dezeen",
    source: "dezeen.com",
    url: "https://www.dezeen.com/feed/",
  },
  {
    aliases: [],
    categoryId: "design",
    id: "codrops",
    label: "Codrops",
    source: "tympanus.net",
    url: "https://tympanus.net/codrops/feed/",
  },
]

const expectedCuratedEntertainmentFeedRecords = [
  {
    aliases: [],
    categoryId: "entertainment",
    id: "indiewire",
    label: "IndieWire",
    source: "indiewire.com",
    url: "https://www.indiewire.com/feed/",
  },
  {
    aliases: [],
    categoryId: "entertainment",
    id: "av-club",
    label: "The A.V. Club",
    source: "avclub.com",
    url: "https://www.avclub.com/rss",
  },
  {
    aliases: [],
    categoryId: "entertainment",
    id: "pitchfork-news",
    label: "Pitchfork News",
    source: "pitchfork.com",
    url: "https://pitchfork.com/rss/news/",
  },
  {
    aliases: [],
    categoryId: "entertainment",
    id: "consequence",
    label: "Consequence",
    source: "consequence.net",
    url: "https://consequence.net/feed/",
  },
  {
    aliases: [],
    categoryId: "entertainment",
    id: "collider",
    label: "Collider",
    source: "collider.com",
    url: "https://collider.com/feed/",
  },
  {
    aliases: [],
    categoryId: "entertainment",
    id: "screen-rant",
    label: "Screen Rant",
    source: "screenrant.com",
    url: "https://screenrant.com/feed/",
  },
  {
    aliases: [],
    categoryId: "entertainment",
    id: "slashfilm",
    label: "Slashfilm",
    source: "slashfilm.com",
    url: "https://www.slashfilm.com/feed/",
  },
  {
    aliases: [],
    categoryId: "entertainment",
    id: "stereogum",
    label: "Stereogum",
    source: "stereogum.com",
    url: "https://www.stereogum.com/feed/",
  },
]

const expectedTorrentingFeedRecords = [
  {
    aliases: [],
    categoryId: "torrenting",
    id: "torrentfreak",
    label: "TorrentFreak",
    source: "torrentfreak.com",
    url: "https://torrentfreak.com/feed/",
  },
  {
    aliases: [],
    categoryId: "torrenting",
    id: "qbittorrent-news",
    label: "qBittorrent News",
    source: "qbittorrent.github.io",
    url: "https://qbittorrent.github.io/qBittorrent-website/news_feed.atom",
  },
  {
    aliases: [],
    categoryId: "torrenting",
    id: "qbittorrent-releases",
    label: "qBittorrent Releases",
    source: "github.com",
    url: "https://github.com/qbittorrent/qBittorrent/releases.atom",
  },
  {
    aliases: [],
    categoryId: "torrenting",
    id: "transmission-releases",
    label: "Transmission Releases",
    source: "github.com",
    url: "https://github.com/transmission/transmission/releases.atom",
  },
  {
    aliases: [],
    categoryId: "torrenting",
    id: "deluge-releases",
    label: "Deluge Releases",
    source: "github.com",
    url: "https://github.com/deluge-torrent/deluge/releases.atom",
  },
  {
    aliases: [],
    categoryId: "torrenting",
    id: "webtorrent-releases",
    label: "WebTorrent Releases",
    source: "github.com",
    url: "https://github.com/webtorrent/webtorrent/releases.atom",
  },
  {
    aliases: [],
    categoryId: "torrenting",
    id: "libtorrent-releases",
    label: "libtorrent Releases",
    source: "github.com",
    url: "https://github.com/arvidn/libtorrent/releases.atom",
  },
  {
    aliases: [],
    categoryId: "torrenting",
    id: "aria2-releases",
    label: "aria2 Releases",
    source: "github.com",
    url: "https://github.com/aria2/aria2/releases.atom",
  },
  {
    aliases: [],
    categoryId: "torrenting",
    id: "distrowatch",
    label: "DistroWatch",
    source: "distrowatch.com",
    url: "https://distrowatch.com/news/dwd.xml",
  },
  {
    aliases: [],
    categoryId: "torrenting",
    id: "internet-archive-blog",
    label: "Internet Archive Blog",
    source: "blog.archive.org",
    url: "https://blog.archive.org/feed/",
  },
]

const expectedAdvertisingFeedRecords = [
  {
    aliases: [],
    categoryId: "advertising",
    id: "adweek",
    label: "Adweek",
    source: "adweek.com",
    url: "https://www.adweek.com/feed/",
  },
  {
    aliases: [],
    categoryId: "advertising",
    id: "marketing-dive",
    label: "Marketing Dive",
    source: "marketingdive.com",
    url: "https://www.marketingdive.com/feeds/news/",
  },
  {
    aliases: [],
    categoryId: "advertising",
    id: "digiday",
    label: "Digiday",
    source: "digiday.com",
    url: "https://digiday.com/feed/",
  },
  {
    aliases: [],
    categoryId: "advertising",
    id: "adexchanger",
    label: "AdExchanger",
    source: "adexchanger.com",
    url: "https://www.adexchanger.com/feed/",
  },
  {
    aliases: [],
    categoryId: "advertising",
    id: "admonsters",
    label: "AdMonsters",
    source: "admonsters.com",
    url: "https://www.admonsters.com/feed/",
  },
  {
    aliases: [],
    categoryId: "advertising",
    id: "mobile-marketing-magazine",
    label: "Mobile Marketing Magazine",
    source: "mobilemarketingmagazine.com",
    url: "https://mobilemarketingmagazine.com/feed/",
  },
  {
    aliases: [],
    categoryId: "advertising",
    id: "martech",
    label: "MarTech",
    source: "martech.org",
    url: "https://martech.org/feed/",
  },
]

const expectedBiopharmaFeedRecords = [
  {
    aliases: [],
    categoryId: "biopharma",
    id: "biopharma-dive",
    label: "BioPharma Dive",
    source: "biopharmadive.com",
    url: "https://www.biopharmadive.com/feeds/news/",
  },
  {
    aliases: [],
    categoryId: "biopharma",
    id: "fierce-biotech",
    label: "Fierce Biotech",
    source: "fiercebiotech.com",
    url: "https://www.fiercebiotech.com/rss/xml",
  },
  {
    aliases: [],
    categoryId: "biopharma",
    id: "fierce-pharma",
    label: "Fierce Pharma",
    source: "fiercepharma.com",
    url: "https://www.fiercepharma.com/rss/xml",
  },
  {
    aliases: [],
    categoryId: "biopharma",
    id: "endpoints-news",
    label: "Endpoints News",
    source: "endpoints.news",
    url: "https://endpoints.news/feed/",
  },
  {
    aliases: [],
    categoryId: "biopharma",
    id: "gen",
    label: "GEN",
    source: "genengnews.com",
    url: "https://www.genengnews.com/feed/",
  },
  {
    aliases: [],
    categoryId: "biopharma",
    id: "nature-biotechnology",
    label: "Nature Biotechnology",
    source: "nature.com",
    url: "https://www.nature.com/nbt.rss",
  },
  {
    aliases: [],
    categoryId: "biopharma",
    id: "stat-pharmalot",
    label: "STAT Pharmalot",
    source: "statnews.com",
    url: "https://www.statnews.com/category/pharmalot/feed/",
  },
]

const expectedCybersecurityFeedRecords = [
  {
    aliases: [],
    categoryId: "cybersecurity",
    id: "bleepingcomputer",
    label: "BleepingComputer",
    source: "bleepingcomputer.com",
    url: "https://www.bleepingcomputer.com/feed/",
  },
  {
    aliases: [],
    categoryId: "cybersecurity",
    id: "cisa-advisories",
    label: "CISA Advisories",
    source: "cisa.gov",
    url: "https://www.cisa.gov/cybersecurity-advisories/all.xml",
  },
  {
    aliases: [],
    categoryId: "cybersecurity",
    id: "dark-reading",
    label: "Dark Reading",
    source: "darkreading.com",
    url: "https://www.darkreading.com/rss.xml",
  },
  {
    aliases: [],
    categoryId: "cybersecurity",
    id: "schneier-on-security",
    label: "Schneier on Security",
    source: "schneier.com",
    url: "https://www.schneier.com/feed/atom/",
  },
  {
    aliases: [],
    categoryId: "cybersecurity",
    id: "securityweek",
    label: "SecurityWeek",
    source: "securityweek.com",
    url: "https://www.securityweek.com/feed/",
  },
  {
    aliases: [],
    categoryId: "cybersecurity",
    id: "the-hacker-news",
    label: "The Hacker News",
    source: "thehackernews.com",
    url: "https://feeds.feedburner.com/TheHackersNews",
  },
]

const expectedEnergyFeedRecords = [
  {
    aliases: [],
    categoryId: "energy",
    id: "eia-today-in-energy",
    label: "EIA Today in Energy",
    source: "eia.gov",
    url: "https://www.eia.gov/rss/todayinenergy.xml",
  },
  {
    aliases: [],
    categoryId: "energy",
    id: "energy-gov-news",
    label: "Energy.gov News",
    source: "energy.gov",
    url: "https://www.energy.gov/rss.xml",
  },
  {
    aliases: [],
    categoryId: "energy",
    id: "utility-dive",
    label: "Utility Dive",
    source: "utilitydive.com",
    url: "https://www.utilitydive.com/feeds/news/",
  },
  {
    aliases: [],
    categoryId: "energy",
    id: "pv-magazine",
    label: "PV Magazine",
    source: "pv-magazine.com",
    url: "https://www.pv-magazine.com/feed/",
  },
  {
    aliases: [],
    categoryId: "energy",
    id: "renewable-energy-world",
    label: "Renewable Energy World",
    source: "renewableenergyworld.com",
    url: "https://www.renewableenergyworld.com/feed/",
  },
  {
    aliases: [],
    categoryId: "energy",
    id: "canary-media",
    label: "Canary Media",
    source: "canarymedia.com",
    url: "https://www.canarymedia.com/rss",
  },
]

const expectedHealthcareFeedRecords = [
  {
    aliases: [],
    categoryId: "healthcare",
    id: "healthcare-dive",
    label: "Healthcare Dive",
    source: "healthcaredive.com",
    url: "https://www.healthcaredive.com/feeds/news/",
  },
  {
    aliases: [],
    categoryId: "healthcare",
    id: "fierce-healthcare",
    label: "Fierce Healthcare",
    source: "fiercehealthcare.com",
    url: "https://www.fiercehealthcare.com/rss/xml",
  },
  {
    aliases: [],
    categoryId: "healthcare",
    id: "medcity-news",
    label: "MedCity News",
    source: "medcitynews.com",
    url: "https://medcitynews.com/feed/",
  },
  {
    aliases: [],
    categoryId: "healthcare",
    id: "kff-health-news-healthcare",
    label: "KFF Health News",
    source: "kffhealthnews.org",
    url: "https://kffhealthnews.org/feed/",
  },
  {
    aliases: [],
    categoryId: "healthcare",
    id: "managed-healthcare-executive",
    label: "Managed Healthcare Executive",
    source: "managedhealthcareexecutive.com",
    url: "https://www.managedhealthcareexecutive.com/rss.xml",
  },
]

const expectedRealEstateFeedRecords = [
  {
    aliases: [],
    categoryId: "real-estate",
    id: "housingwire",
    label: "HousingWire",
    source: "housingwire.com",
    url: "https://www.housingwire.com/feed/",
  },
  {
    aliases: [],
    categoryId: "real-estate",
    id: "biggerpockets-blog",
    label: "BiggerPockets Blog",
    source: "biggerpockets.com",
    url: "https://www.biggerpockets.com/blog/feed",
  },
  {
    aliases: [],
    categoryId: "real-estate",
    id: "rismedia",
    label: "RISMedia",
    source: "rismedia.com",
    url: "https://www.rismedia.com/feed/",
  },
  {
    aliases: [],
    categoryId: "real-estate",
    id: "realtor-com-news",
    label: "Realtor.com News",
    source: "realtor.com",
    url: "https://www.realtor.com/news/feed/",
  },
  {
    aliases: [],
    categoryId: "real-estate",
    id: "redfin-news",
    label: "Redfin News",
    source: "redfin.com",
    url: "https://www.redfin.com/news/feed/",
  },
  {
    aliases: [],
    categoryId: "real-estate",
    id: "curbed",
    label: "Curbed",
    source: "curbed.com",
    url: "https://www.curbed.com/rss/index.xml",
  },
  {
    aliases: [],
    categoryId: "real-estate",
    id: "realtrends",
    label: "RealTrends",
    source: "realtrends.com",
    url: "https://www.realtrends.com/feed/",
  },
]

const expectedRetailFeedRecords = [
  {
    aliases: [],
    categoryId: "retail",
    id: "retail-dive",
    label: "Retail Dive",
    source: "retaildive.com",
    url: "https://www.retaildive.com/feeds/news/",
  },
  {
    aliases: [],
    categoryId: "retail",
    id: "grocery-dive",
    label: "Grocery Dive",
    source: "grocerydive.com",
    url: "https://www.grocerydive.com/feeds/news/",
  },
  {
    aliases: [],
    categoryId: "retail",
    id: "modern-retail",
    label: "Modern Retail",
    source: "modernretail.co",
    url: "https://www.modernretail.co/feed/",
  },
  {
    aliases: [],
    categoryId: "retail",
    id: "retailwire",
    label: "RetailWire",
    source: "retailwire.com",
    url: "https://retailwire.com/feed/",
  },
  {
    aliases: [],
    categoryId: "retail",
    id: "retail-customer-experience",
    label: "Retail Customer Experience",
    source: "retailcustomerexperience.com",
    url: "https://www.retailcustomerexperience.com/rss/",
  },
  {
    aliases: [],
    categoryId: "retail",
    id: "practical-ecommerce",
    label: "Practical Ecommerce",
    source: "practicalecommerce.com",
    url: "https://www.practicalecommerce.com/feed",
  },
  {
    aliases: [],
    categoryId: "retail",
    id: "digital-commerce-360",
    label: "Digital Commerce 360",
    source: "digitalcommerce360.com",
    url: "https://www.digitalcommerce360.com/feed/",
  },
]

const expectedTravelHospitalityFeedRecords = [
  {
    aliases: [],
    categoryId: "travel-hospitality",
    id: "skift",
    label: "Skift",
    source: "skift.com",
    url: "https://skift.com/feed/",
  },
  {
    aliases: [],
    categoryId: "travel-hospitality",
    id: "hotel-dive",
    label: "Hotel Dive",
    source: "hoteldive.com",
    url: "https://www.hoteldive.com/feeds/news/",
  },
  {
    aliases: [],
    categoryId: "travel-hospitality",
    id: "the-points-guy",
    label: "The Points Guy",
    source: "thepointsguy.com",
    url: "https://thepointsguy.com/feed/",
  },
  {
    aliases: [],
    categoryId: "travel-hospitality",
    id: "hospitality-design",
    label: "Hospitality Design",
    source: "hospitalitydesign.com",
    url: "https://hospitalitydesign.com/feed/",
  },
  {
    aliases: [],
    categoryId: "travel-hospitality",
    id: "lodging-magazine",
    label: "Lodging Magazine",
    source: "lodgingmagazine.com",
    url: "https://lodgingmagazine.com/feed/",
  },
  {
    aliases: [],
    categoryId: "travel-hospitality",
    id: "open-jaw",
    label: "Open Jaw",
    source: "openjaw.com",
    url: "https://openjaw.com/feed/",
  },
]

const expectedEntrepreneurshipFeedRecords = [
  {
    aliases: [],
    categoryId: "entrepreneurship",
    id: "entrepreneur-latest",
    label: "Entrepreneur - Latest",
    source: "entrepreneur.com",
    url: "https://www.entrepreneur.com/rss-feed/latest",
  },
  {
    aliases: [],
    categoryId: "entrepreneurship",
    id: "foundr",
    label: "Foundr",
    source: "foundr.com",
    url: "https://foundr.com/feed",
  },
  {
    aliases: [],
    categoryId: "entrepreneurship",
    id: "y-combinator-blog",
    label: "Y Combinator Blog",
    source: "ycombinator.com",
    url: "https://www.ycombinator.com/blog/rss",
  },
  {
    aliases: [],
    categoryId: "entrepreneurship",
    id: "saastr",
    label: "SaaStr",
    source: "saastr.com",
    url: "https://www.saastr.com/feed/",
  },
  {
    aliases: [],
    categoryId: "entrepreneurship",
    id: "small-business-trends",
    label: "Small Business Trends",
    source: "smallbiztrends.com",
    url: "https://smallbiztrends.com/feed/",
  },
]

const expectedLeadershipFeedRecords = [
  {
    aliases: [],
    categoryId: "leadership",
    id: "leadership-freak",
    label: "Leadership Freak",
    source: "leadershipfreak.blog",
    url: "https://leadershipfreak.blog/feed/",
  },
  {
    aliases: [],
    categoryId: "leadership",
    id: "lets-grow-leaders",
    label: "Let's Grow Leaders",
    source: "letsgrowleaders.com",
    url: "https://letsgrowleaders.com/feed/",
  },
  {
    aliases: [],
    categoryId: "leadership",
    id: "skip-prichard",
    label: "Skip Prichard",
    source: "skipprichard.com",
    url: "https://skipprichard.com/feed/",
  },
  {
    aliases: [],
    categoryId: "leadership",
    id: "leadership-now",
    label: "LeadershipNow",
    source: "leadershipnow.com",
    url: "https://www.leadershipnow.com/leadingblog/index.xml",
  },
  {
    aliases: [],
    categoryId: "leadership",
    id: "tanveer-naseer",
    label: "Tanveer Naseer",
    source: "tanveernaseer.com",
    url: "https://tanveernaseer.com/feed/",
  },
  {
    aliases: [],
    categoryId: "leadership",
    id: "great-leadership-by-dan",
    label: "Great Leadership by Dan",
    source: "greatleadershipbydan.com",
    url: "https://www.greatleadershipbydan.com/feed",
  },
]

const expectedEconomicsFeedRecords = [
  {
    aliases: [],
    categoryId: "economics",
    id: "marginal-revolution",
    label: "Marginal Revolution",
    source: "marginalrevolution.com",
    url: "https://feeds.feedblitz.com/marginalrevolution",
  },
  {
    aliases: [],
    categoryId: "economics",
    id: "econlib",
    label: "Econlib",
    source: "econlib.org",
    url: "https://www.econlib.org/feed/",
  },
  {
    aliases: [],
    categoryId: "economics",
    id: "conversable-economist",
    label: "Conversable Economist",
    source: "conversableeconomist.com",
    url: "https://conversableeconomist.com/feed/",
  },
  {
    aliases: [],
    categoryId: "economics",
    id: "federal-reserve-press",
    label: "Federal Reserve - Press Releases",
    source: "federalreserve.gov",
    url: "https://www.federalreserve.gov/feeds/press_all.xml",
  },
  {
    aliases: [],
    categoryId: "economics",
    id: "nber-new-this-week",
    label: "NBER - New This Week",
    source: "nber.org",
    url: "https://back.nber.org/rss/new.xml",
  },
  {
    aliases: [],
    categoryId: "economics",
    id: "economics-observatory",
    label: "Economics Observatory",
    source: "economicsobservatory.com",
    url: "https://www.economicsobservatory.com/feed",
  },
]

const expectedSeoFeedRecords = [
  {
    aliases: [],
    categoryId: "seo",
    id: "seo-search-engine-land",
    label: "Search Engine Land",
    source: "searchengineland.com",
    url: "https://searchengineland.com/feed",
  },
  {
    aliases: [],
    categoryId: "seo",
    id: "seo-search-engine-journal",
    label: "Search Engine Journal",
    source: "searchenginejournal.com",
    url: "https://www.searchenginejournal.com/feed/",
  },
  {
    aliases: [],
    categoryId: "seo",
    id: "seo-ahrefs-blog",
    label: "Ahrefs Blog",
    source: "ahrefs.com",
    url: "https://ahrefs.com/blog/feed/",
  },
  {
    aliases: [],
    categoryId: "seo",
    id: "semrush-blog",
    label: "Semrush Blog",
    source: "semrush.com",
    url: "https://www.semrush.com/blog/feed/",
  },
  {
    aliases: [],
    categoryId: "seo",
    id: "yoast-seo-blog",
    label: "Yoast SEO Blog",
    source: "yoast.com",
    url: "https://yoast.com/seo-blog/feed/",
  },
  {
    aliases: [],
    categoryId: "seo",
    id: "google-search-central-blog",
    label: "Google Search Central Blog",
    source: "developers.google.com",
    url: "https://feeds.feedburner.com/blogspot/amDG",
  },
]

const expectedManagementFeedRecords = [
  {
    aliases: [],
    categoryId: "management",
    id: "mit-sloan-management-review",
    label: "MIT Sloan Management Review",
    source: "sloanreview.mit.edu",
    url: "https://sloanreview.mit.edu/feed/",
  },
  {
    aliases: [],
    categoryId: "management",
    id: "harvard-business-review-management",
    label: "Harvard Business Review",
    source: "hbr.org",
    url: "http://feeds.harvardbusiness.org/harvardbusiness?format=xml",
  },
  {
    aliases: [],
    categoryId: "management",
    id: "chief-executive",
    label: "Chief Executive",
    source: "chiefexecutive.net",
    url: "https://chiefexecutive.net/feed/",
  },
  {
    aliases: [],
    categoryId: "management",
    id: "ask-a-manager",
    label: "Ask a Manager",
    source: "askamanager.org",
    url: "https://www.askamanager.org/feed",
  },
  {
    aliases: [],
    categoryId: "management",
    id: "ivey-business-journal",
    label: "Ivey Business Journal",
    source: "iveybusinessjournal.com",
    url: "https://iveybusinessjournal.com/feed/",
  },
  {
    aliases: [],
    categoryId: "management",
    id: "fs-blog",
    label: "Farnam Street",
    source: "fs.blog",
    url: "https://fs.blog/feed/",
  },
]

const expectedPhotographyFeedRecords = [
  {
    aliases: [],
    categoryId: "photography",
    id: "petapixel",
    label: "PetaPixel",
    source: "petapixel.com",
    url: "https://petapixel.com/feed/",
  },
  {
    aliases: [],
    categoryId: "photography",
    id: "fstoppers",
    label: "Fstoppers",
    source: "fstoppers.com",
    url: "https://fstoppers.com/feed",
  },
  {
    aliases: [],
    categoryId: "photography",
    id: "dpreview-news",
    label: "DPReview News",
    source: "dpreview.com",
    url: "https://www.dpreview.com/feeds/news.xml",
  },
  {
    aliases: [],
    categoryId: "photography",
    id: "digital-photography-school",
    label: "Digital Photography School",
    source: "digital-photography-school.com",
    url: "https://digital-photography-school.com/feed/",
  },
  {
    aliases: [],
    categoryId: "photography",
    id: "photography-life",
    label: "Photography Life",
    source: "photographylife.com",
    url: "https://photographylife.com/feed",
  },
  {
    aliases: [],
    categoryId: "photography",
    id: "the-phoblographer",
    label: "The Phoblographer",
    source: "thephoblographer.com",
    url: "https://www.thephoblographer.com/feed/",
  },
  {
    aliases: [],
    categoryId: "photography",
    id: "shotkit",
    label: "Shotkit",
    source: "shotkit.com",
    url: "https://shotkit.com/feed/",
  },
]

const expectedDataScienceFeedRecords = [
  {
    aliases: [],
    categoryId: "data-science",
    id: "kdnuggets",
    label: "KDnuggets",
    source: "kdnuggets.com",
    url: "https://www.kdnuggets.com/feed",
  },
  {
    aliases: [],
    categoryId: "data-science",
    id: "towards-data-science",
    label: "Towards Data Science",
    source: "towardsdatascience.com",
    url: "https://towardsdatascience.com/feed/",
  },
  {
    aliases: [],
    categoryId: "data-science",
    id: "machine-learning-mastery",
    label: "Machine Learning Mastery",
    source: "machinelearningmastery.com",
    url: "https://machinelearningmastery.com/blog/feed/",
  },
  {
    aliases: [],
    categoryId: "data-science",
    id: "google-research-data-science",
    label: "Google Research Blog",
    source: "research.google",
    url: "https://research.google/blog/rss/",
  },
  {
    aliases: [],
    categoryId: "data-science",
    id: "berkeley-ai-research",
    label: "Berkeley AI Research",
    source: "bair.berkeley.edu",
    url: "https://bair.berkeley.edu/blog/feed.xml",
  },
  {
    aliases: [],
    categoryId: "data-science",
    id: "r-bloggers",
    label: "R-bloggers",
    source: "r-bloggers.com",
    url: "https://www.r-bloggers.com/feed/",
  },
]

const expectedWritingFeedRecords = [
  {
    aliases: [],
    categoryId: "writing",
    id: "jane-friedman",
    label: "Jane Friedman",
    source: "janefriedman.com",
    url: "https://janefriedman.com/feed/",
  },
  {
    aliases: [],
    categoryId: "writing",
    id: "literary-hub",
    label: "Literary Hub",
    source: "lithub.com",
    url: "https://lithub.com/feed/",
  },
  {
    aliases: [],
    categoryId: "writing",
    id: "electric-literature",
    label: "Electric Literature",
    source: "electricliterature.com",
    url: "https://electricliterature.com/feed/",
  },
  {
    aliases: [],
    categoryId: "writing",
    id: "grammarly-blog",
    label: "Grammarly Blog",
    source: "grammarly.com",
    url: "https://www.grammarly.com/blog/feed/",
  },
  {
    aliases: [],
    categoryId: "writing",
    id: "jerry-jenkins",
    label: "Jerry Jenkins",
    source: "jerryjenkins.com",
    url: "https://jerryjenkins.com/feed/",
  },
]

const expectedCreativityFeedRecords = [
  {
    aliases: [],
    categoryId: "creativity",
    id: "the-marginalian",
    label: "The Marginalian",
    source: "themarginalian.org",
    url: "https://www.themarginalian.org/feed/",
  },
  {
    aliases: [],
    categoryId: "creativity",
    id: "creative-boom",
    label: "Creative Boom",
    source: "creativeboom.com",
    url: "https://www.creativeboom.com/feed/",
  },
  {
    aliases: [],
    categoryId: "creativity",
    id: "colossal",
    label: "Colossal",
    source: "thisiscolossal.com",
    url: "https://www.thisiscolossal.com/feed/",
  },
  {
    aliases: [],
    categoryId: "creativity",
    id: "booooooom",
    label: "Booooooom",
    source: "booooooom.com",
    url: "https://www.booooooom.com/feed/",
  },
  {
    aliases: [],
    categoryId: "creativity",
    id: "austin-kleon",
    label: "Austin Kleon",
    source: "austinkleon.com",
    url: "https://austinkleon.com/feed/",
  },
  {
    aliases: [],
    categoryId: "creativity",
    id: "creative-review",
    label: "Creative Review",
    source: "creativereview.co.uk",
    url: "https://www.creativereview.co.uk/feed/",
  },
  {
    aliases: [],
    categoryId: "creativity",
    id: "fast-company-creativity",
    label: "Fast Company - Creativity",
    source: "fastcompany.com",
    url: "https://www.fastcompany.com/section/creativity/rss",
  },
]

const expectedContentMarketingFeedRecords = [
  {
    aliases: [],
    categoryId: "content-marketing",
    id: "copyblogger",
    label: "Copyblogger",
    source: "copyblogger.com",
    url: "https://copyblogger.com/feed/",
  },
  {
    aliases: [],
    categoryId: "content-marketing",
    id: "hubspot-marketing",
    label: "HubSpot Marketing",
    source: "blog.hubspot.com",
    url: "https://blog.hubspot.com/marketing/rss.xml",
  },
  {
    aliases: [],
    categoryId: "content-marketing",
    id: "convince-and-convert",
    label: "Convince & Convert",
    source: "convinceandconvert.com",
    url: "https://www.convinceandconvert.com/feed/",
  },
  {
    aliases: [],
    categoryId: "content-marketing",
    id: "neil-patel-content-marketing",
    label: "Neil Patel",
    source: "neilpatel.com",
    url: "https://neilpatel.com/feed/",
  },
  {
    aliases: [],
    categoryId: "content-marketing",
    id: "coschedule",
    label: "CoSchedule",
    source: "coschedule.com",
    url: "https://coschedule.com/feed",
  },
  {
    aliases: [],
    categoryId: "content-marketing",
    id: "marketing-insider-group",
    label: "Marketing Insider Group",
    source: "marketinginsidergroup.com",
    url: "https://marketinginsidergroup.com/feed/",
  },
  {
    aliases: [],
    categoryId: "content-marketing",
    id: "contently",
    label: "Contently",
    source: "contently.com",
    url: "https://contently.com/feed/",
  },
  {
    aliases: [],
    categoryId: "content-marketing",
    id: "siege-media",
    label: "Siege Media",
    source: "siegemedia.com",
    url: "https://www.siegemedia.com/feed",
  },
]

const expectedCultureFeedRecords = [
  {
    aliases: [],
    categoryId: "culture",
    id: "atlantic-culture",
    label: "The Atlantic - Culture",
    source: "theatlantic.com",
    url: "https://www.theatlantic.com/feed/channel/culture/",
  },
  {
    aliases: [],
    categoryId: "culture",
    id: "guardian-culture",
    label: "The Guardian - Culture",
    source: "theguardian.com",
    url: "https://www.theguardian.com/us/culture/rss",
  },
  {
    aliases: [],
    categoryId: "culture",
    id: "aeon",
    label: "Aeon",
    source: "aeon.co",
    url: "https://aeon.co/feed.rss",
  },
  {
    aliases: [],
    categoryId: "culture",
    id: "npr-arts-culture",
    label: "NPR Arts & Culture",
    source: "npr.org",
    url: "https://feeds.npr.org/1008/rss.xml",
  },
  {
    aliases: [],
    categoryId: "culture",
    id: "open-culture",
    label: "Open Culture",
    source: "openculture.com",
    url: "https://www.openculture.com/feed",
  },
  {
    aliases: [],
    categoryId: "culture",
    id: "hyperallergic",
    label: "Hyperallergic",
    source: "hyperallergic.com",
    url: "https://hyperallergic.com/rss/",
  },
  {
    aliases: [],
    categoryId: "culture",
    id: "smithsonian-arts-culture",
    label: "Smithsonian - Arts & Culture",
    source: "smithsonianmag.com",
    url: "https://www.smithsonianmag.com/rss/arts-culture/",
  },
]

const expectedCraftsFeedRecords = [
  {
    aliases: [],
    categoryId: "crafts",
    id: "craftgossip",
    label: "CraftGossip",
    source: "craftgossip.com",
    url: "https://craftgossip.com/feed/",
  },
  {
    aliases: [],
    categoryId: "crafts",
    id: "makezine",
    label: "Make",
    source: "makezine.com",
    url: "https://makezine.com/feed/",
  },
  {
    aliases: [],
    categoryId: "crafts",
    id: "diy-candy",
    label: "DIY Candy",
    source: "diycandy.com",
    url: "https://diycandy.com/feed/",
  },
  {
    aliases: [],
    categoryId: "crafts",
    id: "a-beautiful-mess",
    label: "A Beautiful Mess",
    source: "abeautifulmess.com",
    url: "https://abeautifulmess.com/feed/",
  },
  {
    aliases: [],
    categoryId: "crafts",
    id: "lovely-indeed",
    label: "Lovely Indeed",
    source: "lovelyindeed.com",
    url: "https://lovelyindeed.com/feed/",
  },
  {
    aliases: [],
    categoryId: "crafts",
    id: "lia-griffith",
    label: "Lia Griffith",
    source: "liagriffith.com",
    url: "https://liagriffith.com/feed/",
  },
  {
    aliases: [],
    categoryId: "crafts",
    id: "one-dog-woof",
    label: "One Dog Woof",
    source: "1dogwoof.com",
    url: "https://www.1dogwoof.com/feed/",
  },
]

const expectedParanormalFeedRecords = [
  {
    aliases: [],
    categoryId: "paranormal",
    id: "daily-grail",
    label: "The Daily Grail",
    source: "dailygrail.com",
    url: "https://www.dailygrail.com/feed/",
  },
  {
    aliases: [],
    categoryId: "paranormal",
    id: "skeptical-inquirer",
    label: "Skeptical Inquirer",
    source: "skepticalinquirer.org",
    url: "https://skepticalinquirer.org/feed/",
  },
  {
    aliases: [],
    categoryId: "paranormal",
    id: "cryptomundo",
    label: "Cryptomundo",
    source: "cryptomundo.com",
    url: "https://cryptomundo.com/feed/",
  },
  {
    aliases: [],
    categoryId: "paranormal",
    id: "paranormal-daily-news",
    label: "Paranormal Daily News",
    source: "paranormaldailynews.com",
    url: "https://paranormaldailynews.com/feed/",
  },
  {
    aliases: [],
    categoryId: "paranormal",
    id: "theresas-haunted-history",
    label: "Theresa's Haunted History",
    source: "theresashauntedhistoryofthetri-state.blogspot.com",
    url: "https://theresashauntedhistoryofthetri-state.blogspot.com/feeds/posts/default?alt=rss",
  },
  {
    aliases: [],
    categoryId: "paranormal",
    id: "ghost-hunting-theories",
    label: "Ghost Hunting Theories",
    source: "ghosthuntingtheories.com",
    url: "https://www.ghosthuntingtheories.com/feeds/posts/default?alt=rss",
  },
  {
    aliases: [],
    categoryId: "paranormal",
    id: "ghost-theory",
    label: "Ghost Theory",
    source: "ghosttheory.com",
    url: "https://www.ghosttheory.com/feed",
  },
  {
    aliases: [],
    categoryId: "paranormal",
    id: "spooky-isles",
    label: "Spooky Isles",
    source: "spookyisles.com",
    url: "https://www.spookyisles.com/feed/",
  },
  {
    aliases: [],
    categoryId: "paranormal",
    id: "fortean-times",
    label: "Fortean Times",
    source: "forteantimes.com",
    url: "https://subscribe.forteantimes.com/feed/",
  },
]

const expectedAliensFeedRecords = [
  {
    aliases: [],
    categoryId: "aliens",
    id: "the-debrief-uap",
    label: "The Debrief - UAP",
    source: "thedebrief.org",
    url: "https://thedebrief.org/category/uap/feed/",
  },
  {
    aliases: [],
    categoryId: "aliens",
    id: "open-minds",
    label: "Open Minds",
    source: "openminds.tv",
    url: "https://openminds.tv/feed/",
  },
  {
    aliases: [],
    categoryId: "aliens",
    id: "ufo-sightings-daily",
    label: "UFO Sightings Daily",
    source: "ufosightingsdaily.com",
    url: "https://www.ufosightingsdaily.com/feeds/posts/default?alt=rss",
  },
  {
    aliases: [],
    categoryId: "aliens",
    id: "alien-ufo-blog",
    label: "Alien UFO Blog",
    source: "alienufoblog.com",
    url: "https://alienufoblog.com/feed/",
  },
  {
    aliases: [],
    categoryId: "aliens",
    id: "latest-ufo-sightings",
    label: "Latest UFO Sightings",
    source: "latest-ufo-sightings.net",
    url: "https://www.latest-ufo-sightings.net/feed",
  },
  {
    aliases: [],
    categoryId: "aliens",
    id: "earthsky-space",
    label: "EarthSky - Space",
    source: "earthsky.org",
    url: "https://earthsky.org/space/feed/",
  },
  {
    aliases: [],
    categoryId: "aliens",
    id: "universe-today",
    label: "Universe Today",
    source: "universetoday.com",
    url: "https://www.universetoday.com/rss.xml",
  },
]

const expectedArchaeologyFeedRecords = [
  {
    aliases: [],
    categoryId: "archaeology",
    id: "archaeology-magazine",
    label: "Archaeology Magazine",
    source: "archaeology.org",
    url: "https://www.archaeology.org/feed",
  },
  {
    aliases: [],
    categoryId: "archaeology",
    id: "ancient-origins",
    label: "Ancient Origins",
    source: "ancient-origins.net",
    url: "https://www.ancient-origins.net/rss.xml",
  },
  {
    aliases: [],
    categoryId: "archaeology",
    id: "phys-org-archaeology-fossils",
    label: "Phys.org - Archaeology & Fossils",
    source: "phys.org",
    url: "https://phys.org/rss-feed/science-news/archaeology-fossils/",
  },
  {
    aliases: [],
    categoryId: "archaeology",
    id: "science-daily-archaeology",
    label: "ScienceDaily - Archaeology",
    source: "sciencedaily.com",
    url: "https://www.sciencedaily.com/rss/fossils_ruins/archaeology.xml",
  },
  {
    aliases: [],
    categoryId: "archaeology",
    id: "guardian-archaeology",
    label: "The Guardian - Archaeology",
    source: "theguardian.com",
    url: "https://www.theguardian.com/science/archaeology/rss",
  },
  {
    aliases: [],
    categoryId: "archaeology",
    id: "archaeology-southwest",
    label: "Archaeology Southwest",
    source: "archaeologysouthwest.org",
    url: "https://www.archaeologysouthwest.org/feed/",
  },
  {
    aliases: [],
    categoryId: "archaeology",
    id: "society-for-historical-archaeology",
    label: "Society for Historical Archaeology",
    source: "sha.org",
    url: "https://sha.org/feed/",
  },
]

const expectedGeologyFeedRecords = [
  {
    aliases: [],
    categoryId: "geology",
    id: "geology-page",
    label: "Geology Page",
    source: "geologypage.com",
    url: "https://www.geologypage.com/feed",
  },
  {
    aliases: [],
    categoryId: "geology",
    id: "eos",
    label: "Eos",
    source: "eos.org",
    url: "https://eos.org/feed",
  },
  {
    aliases: [],
    categoryId: "geology",
    id: "usgs-news-releases",
    label: "USGS News Releases",
    source: "usgs.gov",
    url: "https://www.usgs.gov/news/news-releases/feed",
  },
  {
    aliases: [],
    categoryId: "geology",
    id: "nature-geology",
    label: "Nature - Geology",
    source: "nature.com",
    url: "https://www.nature.com/subjects/geology.rss",
  },
  {
    aliases: [],
    categoryId: "geology",
    id: "mit-news-geology",
    label: "MIT News - Geology",
    source: "news.mit.edu",
    url: "https://news.mit.edu/rss/topic/geology",
  },
  {
    aliases: [],
    categoryId: "geology",
    id: "science-daily-geology",
    label: "ScienceDaily - Geology",
    source: "sciencedaily.com",
    url: "https://www.sciencedaily.com/rss/earth_climate/geology.xml",
  },
  {
    aliases: [],
    categoryId: "geology",
    id: "phys-org-earth-sciences",
    label: "Phys.org - Earth Sciences",
    source: "phys.org",
    url: "https://phys.org/rss-feed/earth-news/earth-sciences/",
  },
]

const expectedMmaFeedRecords = [
  {
    aliases: [],
    categoryId: "mma",
    id: "mma-fighting",
    label: "MMA Fighting",
    source: "mmafighting.com",
    url: "https://www.mmafighting.com/rss/current.xml",
  },
  {
    aliases: [],
    categoryId: "mma",
    id: "sherdog-news",
    label: "Sherdog News",
    source: "sherdog.com",
    url: "https://www.sherdog.com/rss/news.xml",
  },
  {
    aliases: [],
    categoryId: "mma",
    id: "ufc-news",
    label: "UFC News",
    source: "ufc.com",
    url: "https://www.ufc.com/rss/news",
  },
  {
    aliases: [],
    categoryId: "mma",
    id: "bloody-elbow",
    label: "Bloody Elbow",
    source: "bloodyelbow.com",
    url: "https://bloodyelbow.com/feed/",
  },
  {
    aliases: [],
    categoryId: "mma",
    id: "lowkick-mma",
    label: "LowKick MMA",
    source: "lowkickmma.com",
    url: "https://www.lowkickmma.com/feed/",
  },
]

const expectedBoxingFeedRecords = [
  {
    aliases: [],
    categoryId: "boxing",
    id: "boxing-news-24",
    label: "Boxing News 24",
    source: "boxingnews24.com",
    url: "https://www.boxingnews24.com/feed/",
  },
  {
    aliases: [],
    categoryId: "boxing",
    id: "fightnews",
    label: "Fightnews",
    source: "fightnews.com",
    url: "https://fightnews.com/feed",
  },
  {
    aliases: [],
    categoryId: "boxing",
    id: "pro-boxing-fans",
    label: "Pro Boxing Fans",
    source: "proboxing-fans.com",
    url: "https://proboxing-fans.com/feed/",
  },
  {
    aliases: [],
    categoryId: "boxing",
    id: "boxing-news-online",
    label: "Boxing News Online",
    source: "boxingnewsonline.net",
    url: "https://www.boxingnewsonline.net/feed/",
  },
  {
    aliases: [],
    categoryId: "boxing",
    id: "world-boxing-news",
    label: "World Boxing News",
    source: "worldboxingnews.net",
    url: "https://www.worldboxingnews.net/feed/",
  },
  {
    aliases: [],
    categoryId: "boxing",
    id: "seconds-out",
    label: "Seconds Out",
    source: "secondsout.com",
    url: "https://www.secondsout.com/feed/",
  },
]

const expectedAmericanFootballFeedRecords = [
  {
    aliases: [],
    categoryId: "american-football",
    id: "espn-nfl",
    label: "ESPN - NFL",
    source: "espn.com",
    url: "https://www.espn.com/espn/rss/nfl/news",
  },
  {
    aliases: [],
    categoryId: "american-football",
    id: "cbs-sports-nfl",
    label: "CBS Sports - NFL",
    source: "cbssports.com",
    url: "https://www.cbssports.com/rss/headlines/nfl/",
  },
  {
    aliases: [],
    categoryId: "american-football",
    id: "profootballtalk",
    label: "ProFootballTalk",
    source: "nbcsports.com",
    url: "https://www.nbcsports.com/nfl/profootballtalk.rss",
  },
  {
    aliases: [],
    categoryId: "american-football",
    id: "nfl-trade-rumors",
    label: "NFL Trade Rumors",
    source: "nfltraderumors.co",
    url: "https://nfltraderumors.co/feed/",
  },
  {
    aliases: [],
    categoryId: "american-football",
    id: "pro-football-rumors",
    label: "Pro Football Rumors",
    source: "profootballrumors.com",
    url: "https://www.profootballrumors.com/feed",
  },
]

const expectedBasketballFeedRecords = [
  {
    aliases: [],
    categoryId: "basketball",
    id: "espn-nba",
    label: "ESPN - NBA",
    source: "espn.com",
    url: "https://www.espn.com/espn/rss/nba/news",
  },
  {
    aliases: [],
    categoryId: "basketball",
    id: "cbs-sports-nba",
    label: "CBS Sports - NBA",
    source: "cbssports.com",
    url: "https://www.cbssports.com/rss/headlines/nba/",
  },
  {
    aliases: [],
    categoryId: "basketball",
    id: "hoops-rumors",
    label: "Hoops Rumors",
    source: "hoopsrumors.com",
    url: "https://www.hoopsrumors.com/feed",
  },
  {
    aliases: [],
    categoryId: "basketball",
    id: "basketball-insiders",
    label: "Basketball Insiders",
    source: "basketballinsiders.com",
    url: "https://www.basketballinsiders.com/feed/",
  },
  {
    aliases: [],
    categoryId: "basketball",
    id: "clutchpoints-nba",
    label: "ClutchPoints - NBA",
    source: "clutchpoints.com",
    url: "https://www.clutchpoints.com/nba/feed",
  },
]

const expectedBaseballFeedRecords = [
  {
    aliases: [],
    categoryId: "baseball",
    id: "espn-mlb",
    label: "ESPN - MLB",
    source: "espn.com",
    url: "https://www.espn.com/espn/rss/mlb/news",
  },
  {
    aliases: [],
    categoryId: "baseball",
    id: "cbs-sports-mlb",
    label: "CBS Sports - MLB",
    source: "cbssports.com",
    url: "https://www.cbssports.com/rss/headlines/mlb/",
  },
  {
    aliases: [],
    categoryId: "baseball",
    id: "mlb-news",
    label: "MLB News",
    source: "mlb.com",
    url: "https://www.mlb.com/feeds/news/rss.xml",
  },
  {
    aliases: [],
    categoryId: "baseball",
    id: "mlb-trade-rumors",
    label: "MLB Trade Rumors",
    source: "mlbtraderumors.com",
    url: "https://www.mlbtraderumors.com/feed",
  },
  {
    aliases: [],
    categoryId: "baseball",
    id: "fangraphs",
    label: "FanGraphs",
    source: "fangraphs.com",
    url: "https://blogs.fangraphs.com/feed/",
  },
  {
    aliases: [],
    categoryId: "baseball",
    id: "baseball-america",
    label: "Baseball America",
    source: "baseballamerica.com",
    url: "https://www.baseballamerica.com/feed/",
  },
]

const expectedHockeyFeedRecords = [
  {
    aliases: [],
    categoryId: "hockey",
    id: "espn-nhl",
    label: "ESPN - NHL",
    source: "espn.com",
    url: "https://www.espn.com/espn/rss/nhl/news",
  },
  {
    aliases: [],
    categoryId: "hockey",
    id: "cbs-sports-nhl",
    label: "CBS Sports - NHL",
    source: "cbssports.com",
    url: "https://www.cbssports.com/rss/headlines/nhl/",
  },
  {
    aliases: [],
    categoryId: "hockey",
    id: "pro-hockey-rumors",
    label: "Pro Hockey Rumors",
    source: "prohockeyrumors.com",
    url: "https://www.prohockeyrumors.com/feed",
  },
  {
    aliases: [],
    categoryId: "hockey",
    id: "the-hockey-news",
    label: "The Hockey News",
    source: "thehockeynews.com",
    url: "https://thehockeynews.com/.rss/full/",
  },
  {
    aliases: [],
    categoryId: "hockey",
    id: "nhl-trade-rumors",
    label: "NHL Trade Rumors",
    source: "nhltraderumors.me",
    url: "https://www.nhltraderumors.me/feeds/posts/default?alt=rss",
  },
  {
    aliases: [],
    categoryId: "hockey",
    id: "sportsnet-nhl",
    label: "Sportsnet - NHL",
    source: "sportsnet.ca",
    url: "https://www.sportsnet.ca/hockey/nhl/feed/",
  },
]

const expectedGolfFeedRecords = [
  {
    aliases: [],
    categoryId: "golf",
    id: "espn-golf",
    label: "ESPN - Golf",
    source: "espn.com",
    url: "https://www.espn.com/espn/rss/golf/news",
  },
  {
    aliases: [],
    categoryId: "golf",
    id: "golf-com",
    label: "GOLF.com",
    source: "golf.com",
    url: "https://golf.com/feed/",
  },
  {
    aliases: [],
    categoryId: "golf",
    id: "national-club-golfer",
    label: "National Club Golfer",
    source: "nationalclubgolfer.com",
    url: "https://www.nationalclubgolfer.com/feed/",
  },
  {
    aliases: [],
    categoryId: "golf",
    id: "golfwrx",
    label: "GolfWRX",
    source: "golfwrx.com",
    url: "https://www.golfwrx.com/feed/",
  },
  {
    aliases: [],
    categoryId: "golf",
    id: "golf-monthly",
    label: "Golf Monthly",
    source: "golfmonthly.com",
    url: "https://www.golfmonthly.com/feeds.xml",
  },
]

const expectedFeedRecords = [
  ...expectedUsGeneralFeedRecords,
  ...expectedUsPoliticsFeedRecords,
  ...expectedUsBusinessFeedRecords,
  ...expectedUsHealthFeedRecords,
  ...expectedUsScienceFeedRecords,
  ...expectedUsSportsFeedRecords,
  ...expectedUsTechFeedRecords,
  ...expectedUsEntertainmentFeedRecords,
  ...expectedUsGamingFeedRecords,
  ...expectedCaGeneralFeedRecords,
  ...expectedCaPoliticsFeedRecords,
  ...expectedCaBusinessFeedRecords,
  ...expectedCaGamingFeedRecords,
  ...expectedCaHealthFeedRecords,
  ...expectedCaScienceFeedRecords,
  ...expectedCaSportsFeedRecords,
  ...expectedCaTechFeedRecords,
  ...expectedCaEntertainmentFeedRecords,
  ...expectedInGeneralFeedRecords,
  ...expectedInPoliticsFeedRecords,
  ...expectedInBusinessFeedRecords,
  ...expectedInHealthFeedRecords,
  ...expectedInScienceFeedRecords,
  ...expectedInSportsFeedRecords,
  ...expectedInTechFeedRecords,
  ...expectedInEntertainmentFeedRecords,
  ...expectedInGamingFeedRecords,
  ...expectedGbGeneralFeedRecords,
  ...expectedGbPoliticsFeedRecords,
  ...expectedGbBusinessFeedRecords,
  ...expectedGbHealthFeedRecords,
  ...expectedGbScienceFeedRecords,
  ...expectedGbSportsFeedRecords,
  ...expectedGbTechFeedRecords,
  ...expectedGbEntertainmentFeedRecords,
  ...expectedGbGamingFeedRecords,
  ...expectedAuGeneralFeedRecords,
  ...expectedAuPoliticsFeedRecords,
  ...expectedAuBusinessFeedRecords,
  ...expectedAuHealthFeedRecords,
  ...expectedAuScienceFeedRecords,
  ...expectedAuSportsFeedRecords,
  ...expectedAuTechFeedRecords,
  ...expectedAuEntertainmentFeedRecords,
  ...expectedBdGeneralFeedRecords,
  ...expectedAiFeedRecords,
  ...expectedMarketingFeedRecords,
  ...expectedCuratedBusinessFeedRecords,
  ...expectedComicsFeedRecords,
  ...expectedFoodFeedRecords,
  ...expectedDesignFeedRecords,
  ...expectedCuratedEntertainmentFeedRecords,
  ...expectedTorrentingFeedRecords,
  ...expectedAdvertisingFeedRecords,
  ...expectedBiopharmaFeedRecords,
  ...expectedCybersecurityFeedRecords,
  ...expectedEnergyFeedRecords,
  ...expectedHealthcareFeedRecords,
  ...expectedRealEstateFeedRecords,
  ...expectedRetailFeedRecords,
  ...expectedTravelHospitalityFeedRecords,
  ...expectedEntrepreneurshipFeedRecords,
  ...expectedLeadershipFeedRecords,
  ...expectedEconomicsFeedRecords,
  ...expectedSeoFeedRecords,
  ...expectedManagementFeedRecords,
  ...expectedPhotographyFeedRecords,
  ...expectedDataScienceFeedRecords,
  ...expectedWritingFeedRecords,
  ...expectedCreativityFeedRecords,
  ...expectedContentMarketingFeedRecords,
  ...expectedCultureFeedRecords,
  ...expectedCraftsFeedRecords,
  ...expectedParanormalFeedRecords,
  ...expectedAliensFeedRecords,
  ...expectedArchaeologyFeedRecords,
  ...expectedGeologyFeedRecords,
  ...expectedMmaFeedRecords,
  ...expectedBoxingFeedRecords,
  ...expectedAmericanFootballFeedRecords,
  ...expectedBasketballFeedRecords,
  ...expectedBaseballFeedRecords,
  ...expectedHockeyFeedRecords,
  ...expectedGolfFeedRecords,
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
const expectedUsSportsFeedIds = expectedUsSportsFeedRecords.map(
  (feed) => feed.id
)
const expectedUsTechFeedIds = expectedUsTechFeedRecords.map((feed) => feed.id)
const expectedUsEntertainmentFeedIds = expectedUsEntertainmentFeedRecords.map(
  (feed) => feed.id
)
const expectedUsGamingFeedIds = expectedUsGamingFeedRecords.map(
  (feed) => feed.id
)
const expectedCaGeneralFeedIds = expectedCaGeneralFeedRecords.map(
  (feed) => feed.id
)
const expectedCaPoliticsFeedIds = expectedCaPoliticsFeedRecords.map(
  (feed) => feed.id
)
const expectedCaBusinessFeedIds = expectedCaBusinessFeedRecords.map(
  (feed) => feed.id
)
const expectedCaGamingFeedIds = expectedCaGamingFeedRecords.map(
  (feed) => feed.id
)
const expectedCaHealthFeedIds = expectedCaHealthFeedRecords.map(
  (feed) => feed.id
)
const expectedCaScienceFeedIds = expectedCaScienceFeedRecords.map(
  (feed) => feed.id
)
const expectedCaSportsFeedIds = expectedCaSportsFeedRecords.map(
  (feed) => feed.id
)
const expectedCaTechFeedIds = expectedCaTechFeedRecords.map((feed) => feed.id)
const expectedCaEntertainmentFeedIds = expectedCaEntertainmentFeedRecords.map(
  (feed) => feed.id
)
const expectedInGeneralFeedIds = expectedInGeneralFeedRecords.map(
  (feed) => feed.id
)
const expectedInPoliticsFeedIds = expectedInPoliticsFeedRecords.map(
  (feed) => feed.id
)
const expectedInBusinessFeedIds = expectedInBusinessFeedRecords.map(
  (feed) => feed.id
)
const expectedInHealthFeedIds = expectedInHealthFeedRecords.map(
  (feed) => feed.id
)
const expectedInScienceFeedIds = expectedInScienceFeedRecords.map(
  (feed) => feed.id
)
const expectedInSportsFeedIds = expectedInSportsFeedRecords.map(
  (feed) => feed.id
)
const expectedInTechFeedIds = expectedInTechFeedRecords.map((feed) => feed.id)
const expectedInEntertainmentFeedIds = expectedInEntertainmentFeedRecords.map(
  (feed) => feed.id
)
const expectedInGamingFeedIds = expectedInGamingFeedRecords.map(
  (feed) => feed.id
)
const expectedGbGeneralFeedIds = expectedGbGeneralFeedRecords.map(
  (feed) => feed.id
)
const expectedGbPoliticsFeedIds = expectedGbPoliticsFeedRecords.map(
  (feed) => feed.id
)
const expectedGbBusinessFeedIds = expectedGbBusinessFeedRecords.map(
  (feed) => feed.id
)
const expectedGbHealthFeedIds = expectedGbHealthFeedRecords.map(
  (feed) => feed.id
)
const expectedGbScienceFeedIds = expectedGbScienceFeedRecords.map(
  (feed) => feed.id
)
const expectedGbSportsFeedIds = expectedGbSportsFeedRecords.map(
  (feed) => feed.id
)
const expectedGbTechFeedIds = expectedGbTechFeedRecords.map((feed) => feed.id)
const expectedGbEntertainmentFeedIds = expectedGbEntertainmentFeedRecords.map(
  (feed) => feed.id
)
const expectedGbGamingFeedIds = expectedGbGamingFeedRecords.map(
  (feed) => feed.id
)
const expectedAuGeneralFeedIds = expectedAuGeneralFeedRecords.map(
  (feed) => feed.id
)
const expectedAuPoliticsFeedIds = expectedAuPoliticsFeedRecords.map(
  (feed) => feed.id
)
const expectedAuBusinessFeedIds = expectedAuBusinessFeedRecords.map(
  (feed) => feed.id
)
const expectedAuHealthFeedIds = expectedAuHealthFeedRecords.map(
  (feed) => feed.id
)
const expectedAuScienceFeedIds = expectedAuScienceFeedRecords.map(
  (feed) => feed.id
)
const expectedAuSportsFeedIds = expectedAuSportsFeedRecords.map(
  (feed) => feed.id
)
const expectedAuTechFeedIds = expectedAuTechFeedRecords.map((feed) => feed.id)
const expectedAuEntertainmentFeedIds = expectedAuEntertainmentFeedRecords.map(
  (feed) => feed.id
)
const expectedBdGeneralFeedIds = expectedBdGeneralFeedRecords.map(
  (feed) => feed.id
)
const expectedAiFeedIds = expectedAiFeedRecords.map((feed) => feed.id)
const expectedMarketingFeedIds = expectedMarketingFeedRecords.map(
  (feed) => feed.id
)
const expectedCuratedBusinessFeedIds =
  expectedCuratedBusinessFeedRecords.map((feed) => feed.id)
const expectedComicsFeedIds = expectedComicsFeedRecords.map((feed) => feed.id)
const expectedFoodFeedIds = expectedFoodFeedRecords.map((feed) => feed.id)
const expectedDesignFeedIds = expectedDesignFeedRecords.map((feed) => feed.id)
const expectedCuratedEntertainmentFeedIds =
  expectedCuratedEntertainmentFeedRecords.map((feed) => feed.id)
const expectedTorrentingFeedIds = expectedTorrentingFeedRecords.map(
  (feed) => feed.id
)
const expectedAdvertisingFeedIds = expectedAdvertisingFeedRecords.map(
  (feed) => feed.id
)
const expectedBiopharmaFeedIds = expectedBiopharmaFeedRecords.map(
  (feed) => feed.id
)
const expectedCybersecurityFeedIds = expectedCybersecurityFeedRecords.map(
  (feed) => feed.id
)
const expectedEnergyFeedIds = expectedEnergyFeedRecords.map((feed) => feed.id)
const expectedHealthcareFeedIds = expectedHealthcareFeedRecords.map(
  (feed) => feed.id
)
const expectedRealEstateFeedIds = expectedRealEstateFeedRecords.map(
  (feed) => feed.id
)
const expectedRetailFeedIds = expectedRetailFeedRecords.map((feed) => feed.id)
const expectedTravelHospitalityFeedIds =
  expectedTravelHospitalityFeedRecords.map((feed) => feed.id)
const expectedEntrepreneurshipFeedIds = expectedEntrepreneurshipFeedRecords.map(
  (feed) => feed.id
)
const expectedLeadershipFeedIds = expectedLeadershipFeedRecords.map(
  (feed) => feed.id
)
const expectedEconomicsFeedIds = expectedEconomicsFeedRecords.map(
  (feed) => feed.id
)
const expectedSeoFeedIds = expectedSeoFeedRecords.map((feed) => feed.id)
const expectedManagementFeedIds = expectedManagementFeedRecords.map(
  (feed) => feed.id
)
const expectedPhotographyFeedIds = expectedPhotographyFeedRecords.map(
  (feed) => feed.id
)
const expectedDataScienceFeedIds = expectedDataScienceFeedRecords.map(
  (feed) => feed.id
)
const expectedWritingFeedIds = expectedWritingFeedRecords.map((feed) => feed.id)
const expectedCreativityFeedIds = expectedCreativityFeedRecords.map(
  (feed) => feed.id
)
const expectedContentMarketingFeedIds = expectedContentMarketingFeedRecords.map(
  (feed) => feed.id
)
const expectedCultureFeedIds = expectedCultureFeedRecords.map((feed) => feed.id)
const expectedCraftsFeedIds = expectedCraftsFeedRecords.map((feed) => feed.id)
const expectedParanormalFeedIds = expectedParanormalFeedRecords.map(
  (feed) => feed.id
)
const expectedAliensFeedIds = expectedAliensFeedRecords.map((feed) => feed.id)
const expectedArchaeologyFeedIds = expectedArchaeologyFeedRecords.map(
  (feed) => feed.id
)
const expectedGeologyFeedIds = expectedGeologyFeedRecords.map(
  (feed) => feed.id
)
const expectedMmaFeedIds = expectedMmaFeedRecords.map((feed) => feed.id)
const expectedBoxingFeedIds = expectedBoxingFeedRecords.map((feed) => feed.id)
const expectedAmericanFootballFeedIds =
  expectedAmericanFootballFeedRecords.map((feed) => feed.id)
const expectedBasketballFeedIds = expectedBasketballFeedRecords.map(
  (feed) => feed.id
)
const expectedBaseballFeedIds = expectedBaseballFeedRecords.map(
  (feed) => feed.id
)
const expectedHockeyFeedIds = expectedHockeyFeedRecords.map((feed) => feed.id)
const expectedGolfFeedIds = expectedGolfFeedRecords.map((feed) => feed.id)

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
      {
        description:
          "Sports headlines, analysis, scores, and commentary from national outlets and sports publications.",
        id: "us-sports",
        label: "US Sports",
      },
      {
        description:
          "Technology news, startups, gadgets, platforms, security, and digital culture from tech outlets.",
        id: "us-tech",
        label: "US Tech",
      },
      {
        description:
          "Entertainment news, TV, movies, music, celebrity coverage, and culture from major outlets.",
        id: "us-entertainment",
        label: "US Entertainment",
      },
      {
        description:
          "Video game news, reviews, deals, industry coverage, and gaming culture from major outlets.",
        id: "us-gaming",
        label: "US Gaming",
      },
      {
        description:
          "Canadian national, regional, and world reporting from Canadian outlets.",
        id: "ca-general",
        label: "CA General",
      },
      {
        description:
          "Canadian federal politics, policy, Parliament, and public affairs coverage.",
        id: "ca-politics",
        label: "CA Politics",
      },
      {
        description:
          "Canadian markets, economy, companies, startups, and personal finance.",
        id: "ca-business",
        label: "CA Business",
      },
      {
        description:
          "Canadian gaming news, reviews, accessibility, and games culture coverage.",
        id: "ca-gaming",
        label: "CA Gaming",
      },
      {
        description:
          "Canadian health news, medicine, wellness, and public-health reporting.",
        id: "ca-health",
        label: "CA Health",
      },
      {
        description:
          "Canadian science, research, environment, and discovery coverage.",
        id: "ca-science",
        label: "CA Science",
      },
      {
        description:
          "Canadian sports headlines, analysis, teams, competitions, and scores.",
        id: "ca-sports",
        label: "CA Sports",
      },
      {
        description:
          "Canadian technology news, startups, telecom, gadgets, and digital culture.",
        id: "ca-tech",
        label: "CA Tech",
      },
      {
        description:
          "Canadian arts, culture, entertainment, music, celebrity, and media coverage.",
        id: "ca-entertainment",
        label: "CA Entertainment",
      },
      {
        description:
          "Indian national, regional, and world reporting from Indian and international outlets.",
        id: "in-general",
        label: "IN General",
      },
      {
        description:
          "Indian elections, Parliament, policy, and public affairs coverage.",
        id: "in-politics",
        label: "IN Politics",
      },
      {
        description:
          "Indian markets, companies, economy, startups, and personal finance.",
        id: "in-business",
        label: "IN Business",
      },
      {
        description:
          "Indian health news, medicine, wellness, and healthcare industry coverage.",
        id: "in-health",
        label: "IN Health",
      },
      {
        description:
          "Indian science, research, environment, space, and discovery coverage.",
        id: "in-science",
        label: "IN Science",
      },
      {
        description:
          "Indian sports headlines, cricket coverage, teams, competitions, and scores.",
        id: "in-sports",
        label: "IN Sports",
      },
      {
        description:
          "Indian technology news, startups, gadgets, platforms, and digital policy.",
        id: "in-tech",
        label: "IN Tech",
      },
      {
        description:
          "Indian film, television, celebrity, music, and culture coverage.",
        id: "in-entertainment",
        label: "IN Entertainment",
      },
      {
        description:
          "Indian video game news, esports, mobile games, reviews, and gaming culture.",
        id: "in-gaming",
        label: "IN Gaming",
      },
      {
        description:
          "British national, regional, and world reporting from UK outlets.",
        id: "gb-general",
        label: "GB General",
      },
      {
        description:
          "British Parliament, policy, elections, and public affairs coverage.",
        id: "gb-politics",
        label: "GB Politics",
      },
      {
        description:
          "British markets, companies, economy, retail, and personal finance.",
        id: "gb-business",
        label: "GB Business",
      },
      {
        description:
          "British health news, public-health guidance, medicine, and NHS coverage.",
        id: "gb-health",
        label: "GB Health",
      },
      {
        description:
          "British science, environment, research, and discovery coverage.",
        id: "gb-science",
        label: "GB Science",
      },
      {
        description:
          "British sports headlines, football, competitions, and scores.",
        id: "gb-sports",
        label: "GB Sports",
      },
      {
        description:
          "British technology news, gadgets, startups, enterprise, and digital culture.",
        id: "gb-tech",
        label: "GB Tech",
      },
      {
        description:
          "British film, television, music, celebrity, and culture coverage.",
        id: "gb-entertainment",
        label: "GB Entertainment",
      },
      {
        description:
          "British video game news, reviews, industry coverage, and gaming culture.",
        id: "gb-gaming",
        label: "GB Gaming",
      },
      {
        description:
          "Australian national, regional, and world reporting from Australian outlets.",
        id: "au-general",
        label: "AU General",
      },
      {
        description:
          "Australian federal politics, policy, public affairs, and institutions coverage.",
        id: "au-politics",
        label: "AU Politics",
      },
      {
        description:
          "Australian markets, companies, startups, small business, and finance coverage.",
        id: "au-business",
        label: "AU Business",
      },
      {
        description:
          "Australian health news, public-health reporting, wellness, and healthcare coverage.",
        id: "au-health",
        label: "AU Health",
      },
      {
        description:
          "Australian science, environment, technology, research, and discovery coverage.",
        id: "au-science",
        label: "AU Science",
      },
      {
        description:
          "Australian sports headlines, teams, competitions, and scores.",
        id: "au-sports",
        label: "AU Sports",
      },
      {
        description:
          "Australian technology news, gadgets, startups, enterprise, and digital culture.",
        id: "au-tech",
        label: "AU Tech",
      },
      {
        description:
          "Australian film, television, music, celebrity, arts, and culture coverage.",
        id: "au-entertainment",
        label: "AU Entertainment",
      },
      {
        description:
          "Bangladeshi national and general news from verified Bangladesh outlets.",
        id: "bd-general",
        label: "BD General",
      },
      {
        description:
          "Artificial intelligence news, research, product updates, policy, and machine-learning coverage.",
        id: "ai",
        label: "AI",
      },
      {
        description:
          "Marketing strategy, SEO, social media, content, and growth coverage.",
        id: "marketing",
        label: "Marketing",
      },
      {
        description:
          "Business news, markets, entrepreneurship, economy, and workplace coverage.",
        id: "business",
        label: "Business",
      },
      {
        description:
          "Webcomics, comic culture, industry news, and graphic storytelling.",
        id: "comics",
        label: "Comics",
      },
      {
        description: "Recipes, cooking, restaurants, baking, and food culture.",
        id: "food",
        label: "Food",
      },
      {
        description:
          "Product design, UX, visual design, architecture, and creative culture.",
        id: "design",
        label: "Design",
      },
      {
        description:
          "Film, television, music, celebrity, and culture coverage.",
        id: "entertainment",
        label: "Entertainment",
      },
      {
        description:
          "BitTorrent news, open-source client releases, and legal open-download sources.",
        id: "torrenting",
        label: "Torrenting",
      },
      {
        description:
          "Advertising, media buying, creative campaigns, ad tech, and brand marketing coverage.",
        id: "advertising",
        label: "Advertising",
      },
      {
        description:
          "Biotech, pharmaceutical research, drug development, and life-sciences industry coverage.",
        id: "biopharma",
        label: "Biopharma",
      },
      {
        description:
          "Threat intelligence, breaches, vulnerabilities, security research, and defensive practice.",
        id: "cybersecurity",
        label: "Cybersecurity",
      },
      {
        description:
          "Power, renewables, utilities, oil and gas, climate tech, and energy markets.",
        id: "energy",
        label: "Energy",
      },
      {
        description:
          "Healthcare business, hospitals, policy, digital health, and care delivery.",
        id: "healthcare",
        label: "Healthcare",
      },
      {
        description:
          "Housing markets, property technology, mortgage, commercial, and residential real estate.",
        id: "real-estate",
        label: "Real Estate",
      },
      {
        description:
          "Retail operations, ecommerce, grocery, merchandising, and consumer commerce.",
        id: "retail",
        label: "Retail",
      },
      {
        description:
          "Travel, hotels, airlines, tourism, hospitality operations, and guest experience.",
        id: "travel-hospitality",
        label: "Travel & Hospitality",
      },
      {
        description:
          "Founder stories, startup advice, small business tactics, and entrepreneurship coverage.",
        id: "entrepreneurship",
        label: "Entrepreneurship",
      },
      {
        description:
          "Leadership practice, executive coaching, teams, culture, and organizational decision-making.",
        id: "leadership",
        label: "Leadership",
      },
      {
        description:
          "Economics research, policy, macro trends, markets, labor, and public institutions.",
        id: "economics",
        label: "Economics",
      },
      {
        description:
          "Search engine optimization tactics, search product updates, analytics, and organic growth.",
        id: "seo",
        label: "SEO",
      },
      {
        description:
          "Management practice, operations, workplace advice, strategy, and team effectiveness.",
        id: "management",
        label: "Management",
      },
      {
        description:
          "Photography news, camera gear, editing, technique, and visual storytelling.",
        id: "photography",
        label: "Photography",
      },
      {
        description:
          "Data science, machine learning, analytics, statistics, and applied research.",
        id: "data-science",
        label: "Data Science",
      },
      {
        description:
          "Writing craft, publishing, books, literary culture, editing, and author advice.",
        id: "writing",
        label: "Writing",
      },
      {
        description:
          "Creative work, inspiration, visual culture, artists, ideas, and creative practice.",
        id: "creativity",
        label: "Creativity",
      },
      {
        description:
          "Content strategy, editorial marketing, copywriting, audience growth, and brand publishing.",
        id: "content-marketing",
        label: "Content Marketing",
      },
      {
        description:
          "Arts, media, books, ideas, criticism, cultural reporting, and public life.",
        id: "culture",
        label: "Culture",
      },
      {
        description:
          "Craft projects, DIY making, paper goods, sewing, crochet, home projects, and handmade ideas.",
        id: "crafts",
        label: "Crafts",
      },
      {
        description:
          "Ghosts, hauntings, cryptids, folklore, unexplained phenomena, and skeptical investigation.",
        id: "paranormal",
        label: "Paranormal",
      },
      {
        description:
          "UFOs, UAP, extraterrestrial life, astrobiology, space signals, and alien-culture coverage.",
        id: "aliens",
        label: "Aliens",
      },
      {
        description:
          "Archaeology news, digs, artifacts, ancient history, cultural heritage, and discoveries.",
        id: "archaeology",
        label: "Archaeology",
      },
      {
        description:
          "Geology, earth science, geoscience research, earthquakes, volcanoes, minerals, and climate.",
        id: "geology",
        label: "Geology",
      },
      {
        description:
          "Mixed martial arts news, UFC coverage, fight analysis, rankings, and combat-sports commentary.",
        id: "mma",
        label: "MMA",
      },
      {
        description: "Boxing news, fight previews, results, rankings, and analysis.",
        id: "boxing",
        label: "Boxing",
      },
      {
        description:
          "NFL and American football coverage, trades, analysis, teams, and league news.",
        id: "american-football",
        label: "American Football",
      },
      {
        description:
          "Basketball news, NBA coverage, trades, analysis, and league reporting.",
        id: "basketball",
        label: "Basketball",
      },
      {
        description:
          "Baseball news, MLB coverage, analytics, trades, prospects, and analysis.",
        id: "baseball",
        label: "Baseball",
      },
      {
        description:
          "Hockey news, NHL coverage, trades, analysis, prospects, and league reporting.",
        id: "hockey",
        label: "Hockey",
      },
      {
        description: "Golf news, tours, equipment, instruction, majors, and player coverage.",
        id: "golf",
        label: "Golf",
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
    expect(getFeedDirectoryCategory("us-sports")).toBe(
      feedDirectoryCategories[5]
    )
    expect(getFeedDirectoryCategory("us-tech")).toBe(
      feedDirectoryCategories[6]
    )
    expect(getFeedDirectoryCategory("us-entertainment")).toBe(
      feedDirectoryCategories[7]
    )
    expect(getFeedDirectoryCategory("us-gaming")).toBe(
      feedDirectoryCategories[8]
    )
    expect(getFeedDirectoryCategory("ca-general")).toBe(
      feedDirectoryCategories[9]
    )
    expect(getFeedDirectoryCategory("ca-politics")).toBe(
      feedDirectoryCategories[10]
    )
    expect(getFeedDirectoryCategory("ca-business")).toBe(
      feedDirectoryCategories[11]
    )
    expect(getFeedDirectoryCategory("ca-gaming")).toBe(
      feedDirectoryCategories[12]
    )
    expect(getFeedDirectoryCategory("ca-health")).toBe(
      feedDirectoryCategories[13]
    )
    expect(getFeedDirectoryCategory("ca-science")).toBe(
      feedDirectoryCategories[14]
    )
    expect(getFeedDirectoryCategory("ca-sports")).toBe(
      feedDirectoryCategories[15]
    )
    expect(getFeedDirectoryCategory("ca-tech")).toBe(
      feedDirectoryCategories[16]
    )
    expect(getFeedDirectoryCategory("ca-entertainment")).toBe(
      feedDirectoryCategories[17]
    )
    expect(getFeedDirectoryCategory("in-general")).toBe(
      feedDirectoryCategories[18]
    )
    expect(getFeedDirectoryCategory("in-politics")).toBe(
      feedDirectoryCategories[19]
    )
    expect(getFeedDirectoryCategory("in-business")).toBe(
      feedDirectoryCategories[20]
    )
    expect(getFeedDirectoryCategory("in-health")).toBe(
      feedDirectoryCategories[21]
    )
    expect(getFeedDirectoryCategory("in-science")).toBe(
      feedDirectoryCategories[22]
    )
    expect(getFeedDirectoryCategory("in-sports")).toBe(
      feedDirectoryCategories[23]
    )
    expect(getFeedDirectoryCategory("in-tech")).toBe(
      feedDirectoryCategories[24]
    )
    expect(getFeedDirectoryCategory("in-entertainment")).toBe(
      feedDirectoryCategories[25]
    )
    expect(getFeedDirectoryCategory("in-gaming")).toBe(
      feedDirectoryCategories[26]
    )
    expect(getFeedDirectoryCategory("gb-general")).toBe(
      feedDirectoryCategories[27]
    )
    expect(getFeedDirectoryCategory("gb-politics")).toBe(
      feedDirectoryCategories[28]
    )
    expect(getFeedDirectoryCategory("gb-business")).toBe(
      feedDirectoryCategories[29]
    )
    expect(getFeedDirectoryCategory("gb-health")).toBe(
      feedDirectoryCategories[30]
    )
    expect(getFeedDirectoryCategory("gb-science")).toBe(
      feedDirectoryCategories[31]
    )
    expect(getFeedDirectoryCategory("gb-sports")).toBe(
      feedDirectoryCategories[32]
    )
    expect(getFeedDirectoryCategory("gb-tech")).toBe(
      feedDirectoryCategories[33]
    )
    expect(getFeedDirectoryCategory("gb-entertainment")).toBe(
      feedDirectoryCategories[34]
    )
    expect(getFeedDirectoryCategory("gb-gaming")).toBe(
      feedDirectoryCategories[35]
    )
    expect(getFeedDirectoryCategory("au-general")).toBe(
      feedDirectoryCategories[36]
    )
    expect(getFeedDirectoryCategory("au-politics")).toBe(
      feedDirectoryCategories[37]
    )
    expect(getFeedDirectoryCategory("au-business")).toBe(
      feedDirectoryCategories[38]
    )
    expect(getFeedDirectoryCategory("au-health")).toBe(
      feedDirectoryCategories[39]
    )
    expect(getFeedDirectoryCategory("au-science")).toBe(
      feedDirectoryCategories[40]
    )
    expect(getFeedDirectoryCategory("au-sports")).toBe(
      feedDirectoryCategories[41]
    )
    expect(getFeedDirectoryCategory("au-tech")).toBe(
      feedDirectoryCategories[42]
    )
    expect(getFeedDirectoryCategory("au-entertainment")).toBe(
      feedDirectoryCategories[43]
    )
    expect(getFeedDirectoryCategory("bd-general")).toBe(
      feedDirectoryCategories[44]
    )
    expect(getFeedDirectoryCategory("ai")).toBe(feedDirectoryCategories[45])
    expect(getFeedDirectoryCategory("marketing")).toBe(
      feedDirectoryCategories[46]
    )
    expect(getFeedDirectoryCategory("business")).toBe(
      feedDirectoryCategories[47]
    )
    expect(getFeedDirectoryCategory("comics")).toBe(feedDirectoryCategories[48])
    expect(getFeedDirectoryCategory("food")).toBe(feedDirectoryCategories[49])
    expect(getFeedDirectoryCategory("design")).toBe(
      feedDirectoryCategories[50]
    )
    expect(getFeedDirectoryCategory("entertainment")).toBe(
      feedDirectoryCategories[51]
    )
    expect(getFeedDirectoryCategory("torrenting")).toBe(
      feedDirectoryCategories[52]
    )
    expect(getFeedDirectoryCategory("advertising")).toBe(
      feedDirectoryCategories[53]
    )
    expect(getFeedDirectoryCategory("biopharma")).toBe(
      feedDirectoryCategories[54]
    )
    expect(getFeedDirectoryCategory("cybersecurity")).toBe(
      feedDirectoryCategories[55]
    )
    expect(getFeedDirectoryCategory("energy")).toBe(feedDirectoryCategories[56])
    expect(getFeedDirectoryCategory("healthcare")).toBe(
      feedDirectoryCategories[57]
    )
    expect(getFeedDirectoryCategory("real-estate")).toBe(
      feedDirectoryCategories[58]
    )
    expect(getFeedDirectoryCategory("retail")).toBe(feedDirectoryCategories[59])
    expect(getFeedDirectoryCategory("travel-hospitality")).toBe(
      feedDirectoryCategories[60]
    )
    expect(getFeedDirectoryCategory("entrepreneurship")).toBe(
      feedDirectoryCategories[61]
    )
    expect(getFeedDirectoryCategory("leadership")).toBe(
      feedDirectoryCategories[62]
    )
    expect(getFeedDirectoryCategory("economics")).toBe(
      feedDirectoryCategories[63]
    )
    expect(getFeedDirectoryCategory("seo")).toBe(feedDirectoryCategories[64])
    expect(getFeedDirectoryCategory("management")).toBe(
      feedDirectoryCategories[65]
    )
    expect(getFeedDirectoryCategory("photography")).toBe(
      feedDirectoryCategories[66]
    )
    expect(getFeedDirectoryCategory("data-science")).toBe(
      feedDirectoryCategories[67]
    )
    expect(getFeedDirectoryCategory("writing")).toBe(
      feedDirectoryCategories[68]
    )
    expect(getFeedDirectoryCategory("creativity")).toBe(
      feedDirectoryCategories[69]
    )
    expect(getFeedDirectoryCategory("content-marketing")).toBe(
      feedDirectoryCategories[70]
    )
    expect(getFeedDirectoryCategory("culture")).toBe(
      feedDirectoryCategories[71]
    )
    expect(getFeedDirectoryCategory("crafts")).toBe(feedDirectoryCategories[72])
    expect(getFeedDirectoryCategory("paranormal")).toBe(
      feedDirectoryCategories[73]
    )
    expect(getFeedDirectoryCategory("aliens")).toBe(feedDirectoryCategories[74])
    expect(getFeedDirectoryCategory("archaeology")).toBe(
      feedDirectoryCategories[75]
    )
    expect(getFeedDirectoryCategory("geology")).toBe(
      feedDirectoryCategories[76]
    )
    expect(getFeedDirectoryCategory("mma")).toBe(feedDirectoryCategories[77])
    expect(getFeedDirectoryCategory("boxing")).toBe(feedDirectoryCategories[78])
    expect(getFeedDirectoryCategory("american-football")).toBe(
      feedDirectoryCategories[79]
    )
    expect(getFeedDirectoryCategory("basketball")).toBe(
      feedDirectoryCategories[80]
    )
    expect(getFeedDirectoryCategory("baseball")).toBe(
      feedDirectoryCategories[81]
    )
    expect(getFeedDirectoryCategory("hockey")).toBe(feedDirectoryCategories[82])
    expect(getFeedDirectoryCategory("golf")).toBe(feedDirectoryCategories[83])
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
    expect(getFeedDirectoryFeed("sports-illustrated")?.url).toBe(
      "https://www.si.com/feed"
    )
    expect(getFeedDirectoryFeed("techcrunch")?.url).toBe(
      "https://techcrunch.com/feed/"
    )
    expect(getFeedDirectoryFeed("deadline")?.url).toBe(
      "https://deadline.com/feed/"
    )
    expect(getFeedDirectoryFeed("kotaku")?.url).toBe("https://kotaku.com/feed")
    expect(getFeedDirectoryFeed("cbc-canada")?.url).toBe(
      "https://www.cbc.ca/webfeed/rss/rss-canada"
    )
    expect(getFeedDirectoryFeed("financial-post")?.url).toBe(
      "https://financialpost.com/feed"
    )
    expect(getFeedDirectoryFeed("cogconnected")?.url).toBe(
      "http://cogconnected.com/feed/"
    )
    expect(getFeedDirectoryFeed("global-science-ca")?.url).toBe(
      "https://globalnews.ca/science/feed/"
    )
    expect(getFeedDirectoryFeed("lainey-gossip")?.url).toBe(
      "https://www.laineygossip.com/rss/"
    )
    expect(getFeedDirectoryFeed("hindustan-times-india")?.url).toBe(
      "https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml"
    )
    expect(getFeedDirectoryFeed("ft-india")?.url).toBe(
      "https://www.ft.com/india?format=rss"
    )
    expect(getFeedDirectoryFeed("ndtv-profit")?.url).toBe(
      "https://www.ndtvprofit.com/rss"
    )
    expect(getFeedDirectoryFeed("india-bioscience")?.url).toBe(
      "https://indiabioscience.org/feed"
    )
    expect(getFeedDirectoryFeed("ign-india")?.url).toBe(
      "https://in.ign.com/feed.xml"
    )
    expect(getFeedDirectoryFeed("hindustan-times-entertainment-in")?.url).toBe(
      "https://www.hindustantimes.com/feeds/rss/entertainment/rssfeed.xml"
    )
    expect(getFeedDirectoryFeed("sky-news-uk")?.url).toBe(
      "https://feeds.skynews.com/feeds/rss/uk.xml"
    )
    expect(getFeedDirectoryFeed("bbc-politics-gb")?.url).toBe(
      "https://feeds.bbci.co.uk/news/politics/rss.xml"
    )
    expect(getFeedDirectoryFeed("city-am")?.url).toBe(
      "https://www.cityam.com/feed/"
    )
    expect(getFeedDirectoryFeed("nhs-england")?.url).toBe(
      "https://www.england.nhs.uk/feed/"
    )
    expect(getFeedDirectoryFeed("new-scientist-gb")?.url).toBe(
      "https://www.newscientist.com/feed/home/"
    )
    expect(getFeedDirectoryFeed("bbc-sport-uk")?.url).toBe(
      "https://feeds.bbci.co.uk/sport/rss.xml"
    )
    expect(getFeedDirectoryFeed("techradar-uk")?.url).toBe(
      "https://www.techradar.com/feeds.xml"
    )
    expect(getFeedDirectoryFeed("digital-spy")?.url).toBe(
      "https://www.digitalspy.com/rss/all.xml/"
    )
    expect(getFeedDirectoryFeed("eurogamer-gb")?.url).toBe(
      "https://www.eurogamer.net/feed"
    )
    expect(getFeedDirectoryFeed("abc-news-australia")?.url).toBe(
      "https://www.abc.net.au/news/feed/46182/rss.xml"
    )
    expect(getFeedDirectoryFeed("guardian-australian-politics")?.url).toBe(
      "https://www.theguardian.com/australia-news/australian-politics/rss"
    )
    expect(getFeedDirectoryFeed("dynamic-business")?.url).toBe(
      "https://dynamicbusiness.com/feed.xml"
    )
    expect(getFeedDirectoryFeed("medical-republic")?.url).toBe(
      "https://www.medicalrepublic.com.au/feed"
    )
    expect(getFeedDirectoryFeed("sciencealert")?.url).toBe(
      "https://www.sciencealert.com/feed"
    )
    expect(getFeedDirectoryFeed("fox-sports-australia")?.url).toBe(
      "https://www.foxsports.com.au/content-feeds/breaking-news/"
    )
    expect(getFeedDirectoryFeed("techau")?.url).toBe(
      "https://techau.com.au/feed/"
    )
    expect(getFeedDirectoryFeed("pedestrian-tv")?.url).toBe(
      "https://www.pedestrian.tv/feed/"
    )
    expect(getFeedDirectoryFeed("daily-star-bangladesh")?.url).toBe(
      "https://www.thedailystar.net/taxonomy/term/107/rss.xml"
    )
    expect(getFeedDirectoryFeed("banglanews24")?.url).toBe(
      "https://www.banglanews24.com/rss.xml"
    )
    expect(getFeedDirectoryFeed("prothom-alo")?.url).toBe(
      "https://www.prothomalo.com/stories.rss"
    )
    expect(getFeedDirectoryFeed("hubspot-marketing-blog")?.url).toBe(
      "https://blog.hubspot.com/marketing/rss.xml"
    )
    expect(getFeedDirectoryFeed("bloomberg-business")?.url).toBe(
      "https://feeds.bloomberg.com/business/news.rss"
    )
    expect(getFeedDirectoryFeed("xkcd")?.url).toBe(
      "https://xkcd.com/rss.xml"
    )
    expect(getFeedDirectoryFeed("smitten-kitchen")?.url).toBe(
      "https://smittenkitchen.com/feed/atom/"
    )
    expect(getFeedDirectoryFeed("smashing-magazine")?.url).toBe(
      "https://www.smashingmagazine.com/feed/"
    )
    expect(getFeedDirectoryFeed("indiewire")?.url).toBe(
      "https://www.indiewire.com/feed/"
    )
    expect(getFeedDirectoryFeed("torrentfreak")?.url).toBe(
      "https://torrentfreak.com/feed/"
    )
    expect(getFeedDirectoryFeed("qbittorrent-news")?.url).toBe(
      "https://qbittorrent.github.io/qBittorrent-website/news_feed.atom"
    )
    expect(getFeedDirectoryFeed("adweek")?.url).toBe(
      "https://www.adweek.com/feed/"
    )
    expect(getFeedDirectoryFeed("biopharma-dive")?.url).toBe(
      "https://www.biopharmadive.com/feeds/news/"
    )
    expect(getFeedDirectoryFeed("cisa-advisories")?.url).toBe(
      "https://www.cisa.gov/cybersecurity-advisories/all.xml"
    )
    expect(getFeedDirectoryFeed("eia-today-in-energy")?.url).toBe(
      "https://www.eia.gov/rss/todayinenergy.xml"
    )
    expect(getFeedDirectoryFeed("healthcare-dive")?.url).toBe(
      "https://www.healthcaredive.com/feeds/news/"
    )
    expect(getFeedDirectoryFeed("housingwire")?.url).toBe(
      "https://www.housingwire.com/feed/"
    )
    expect(getFeedDirectoryFeed("retail-dive")?.url).toBe(
      "https://www.retaildive.com/feeds/news/"
    )
    expect(getFeedDirectoryFeed("skift")?.url).toBe("https://skift.com/feed/")
    expect(getFeedDirectoryFeed("archaeology-magazine")?.url).toBe(
      "https://www.archaeology.org/feed"
    )
    expect(getFeedDirectoryFeed("geology-page")?.url).toBe(
      "https://www.geologypage.com/feed"
    )
    expect(getFeedDirectoryFeed("mma-fighting")?.url).toBe(
      "https://www.mmafighting.com/rss/current.xml"
    )
    expect(getFeedDirectoryFeed("boxing-news-24")?.url).toBe(
      "https://www.boxingnews24.com/feed/"
    )
    expect(getFeedDirectoryFeed("espn-nfl")?.url).toBe(
      "https://www.espn.com/espn/rss/nfl/news"
    )
    expect(getFeedDirectoryFeed("espn-nba")?.url).toBe(
      "https://www.espn.com/espn/rss/nba/news"
    )
    expect(getFeedDirectoryFeed("espn-mlb")?.url).toBe(
      "https://www.espn.com/espn/rss/mlb/news"
    )
    expect(getFeedDirectoryFeed("espn-nhl")?.url).toBe(
      "https://www.espn.com/espn/rss/nhl/news"
    )
    expect(getFeedDirectoryFeed("espn-golf")?.url).toBe(
      "https://www.espn.com/espn/rss/golf/news"
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
    expect(listFeedDirectoryFeeds("us-sports").map((feed) => feed.id)).toEqual(
      expectedUsSportsFeedIds
    )
    expect(listFeedDirectoryFeeds("us-tech").map((feed) => feed.id)).toEqual(
      expectedUsTechFeedIds
    )
    expect(
      listFeedDirectoryFeeds("us-entertainment").map((feed) => feed.id)
    ).toEqual(expectedUsEntertainmentFeedIds)
    expect(listFeedDirectoryFeeds("us-gaming").map((feed) => feed.id)).toEqual(
      expectedUsGamingFeedIds
    )
    expect(listFeedDirectoryFeeds("ca-general").map((feed) => feed.id)).toEqual(
      expectedCaGeneralFeedIds
    )
    expect(
      listFeedDirectoryFeeds("ca-politics").map((feed) => feed.id)
    ).toEqual(expectedCaPoliticsFeedIds)
    expect(
      listFeedDirectoryFeeds("ca-business").map((feed) => feed.id)
    ).toEqual(expectedCaBusinessFeedIds)
    expect(listFeedDirectoryFeeds("ca-gaming").map((feed) => feed.id)).toEqual(
      expectedCaGamingFeedIds
    )
    expect(listFeedDirectoryFeeds("ca-health").map((feed) => feed.id)).toEqual(
      expectedCaHealthFeedIds
    )
    expect(listFeedDirectoryFeeds("ca-science").map((feed) => feed.id)).toEqual(
      expectedCaScienceFeedIds
    )
    expect(listFeedDirectoryFeeds("ca-sports").map((feed) => feed.id)).toEqual(
      expectedCaSportsFeedIds
    )
    expect(listFeedDirectoryFeeds("ca-tech").map((feed) => feed.id)).toEqual(
      expectedCaTechFeedIds
    )
    expect(
      listFeedDirectoryFeeds("ca-entertainment").map((feed) => feed.id)
    ).toEqual(expectedCaEntertainmentFeedIds)
    expect(listFeedDirectoryFeeds("in-general").map((feed) => feed.id)).toEqual(
      expectedInGeneralFeedIds
    )
    expect(
      listFeedDirectoryFeeds("in-politics").map((feed) => feed.id)
    ).toEqual(expectedInPoliticsFeedIds)
    expect(
      listFeedDirectoryFeeds("in-business").map((feed) => feed.id)
    ).toEqual(expectedInBusinessFeedIds)
    expect(listFeedDirectoryFeeds("in-health").map((feed) => feed.id)).toEqual(
      expectedInHealthFeedIds
    )
    expect(listFeedDirectoryFeeds("in-science").map((feed) => feed.id)).toEqual(
      expectedInScienceFeedIds
    )
    expect(listFeedDirectoryFeeds("in-sports").map((feed) => feed.id)).toEqual(
      expectedInSportsFeedIds
    )
    expect(listFeedDirectoryFeeds("in-tech").map((feed) => feed.id)).toEqual(
      expectedInTechFeedIds
    )
    expect(
      listFeedDirectoryFeeds("in-entertainment").map((feed) => feed.id)
    ).toEqual(expectedInEntertainmentFeedIds)
    expect(listFeedDirectoryFeeds("in-gaming").map((feed) => feed.id)).toEqual(
      expectedInGamingFeedIds
    )
    expect(listFeedDirectoryFeeds("gb-general").map((feed) => feed.id)).toEqual(
      expectedGbGeneralFeedIds
    )
    expect(
      listFeedDirectoryFeeds("gb-politics").map((feed) => feed.id)
    ).toEqual(expectedGbPoliticsFeedIds)
    expect(
      listFeedDirectoryFeeds("gb-business").map((feed) => feed.id)
    ).toEqual(expectedGbBusinessFeedIds)
    expect(listFeedDirectoryFeeds("gb-health").map((feed) => feed.id)).toEqual(
      expectedGbHealthFeedIds
    )
    expect(listFeedDirectoryFeeds("gb-science").map((feed) => feed.id)).toEqual(
      expectedGbScienceFeedIds
    )
    expect(listFeedDirectoryFeeds("gb-sports").map((feed) => feed.id)).toEqual(
      expectedGbSportsFeedIds
    )
    expect(listFeedDirectoryFeeds("gb-tech").map((feed) => feed.id)).toEqual(
      expectedGbTechFeedIds
    )
    expect(
      listFeedDirectoryFeeds("gb-entertainment").map((feed) => feed.id)
    ).toEqual(expectedGbEntertainmentFeedIds)
    expect(listFeedDirectoryFeeds("gb-gaming").map((feed) => feed.id)).toEqual(
      expectedGbGamingFeedIds
    )
    expect(listFeedDirectoryFeeds("au-general").map((feed) => feed.id)).toEqual(
      expectedAuGeneralFeedIds
    )
    expect(
      listFeedDirectoryFeeds("au-politics").map((feed) => feed.id)
    ).toEqual(expectedAuPoliticsFeedIds)
    expect(
      listFeedDirectoryFeeds("au-business").map((feed) => feed.id)
    ).toEqual(expectedAuBusinessFeedIds)
    expect(listFeedDirectoryFeeds("au-health").map((feed) => feed.id)).toEqual(
      expectedAuHealthFeedIds
    )
    expect(listFeedDirectoryFeeds("au-science").map((feed) => feed.id)).toEqual(
      expectedAuScienceFeedIds
    )
    expect(listFeedDirectoryFeeds("au-sports").map((feed) => feed.id)).toEqual(
      expectedAuSportsFeedIds
    )
    expect(listFeedDirectoryFeeds("au-tech").map((feed) => feed.id)).toEqual(
      expectedAuTechFeedIds
    )
    expect(
      listFeedDirectoryFeeds("au-entertainment").map((feed) => feed.id)
    ).toEqual(expectedAuEntertainmentFeedIds)
    expect(listFeedDirectoryFeeds("bd-general").map((feed) => feed.id)).toEqual(
      expectedBdGeneralFeedIds
    )
    expect(listFeedDirectoryFeeds("ai").map((feed) => feed.id)).toEqual(
      expectedAiFeedIds
    )
    expect(listFeedDirectoryFeeds("marketing").map((feed) => feed.id)).toEqual(
      expectedMarketingFeedIds
    )
    expect(listFeedDirectoryFeeds("business").map((feed) => feed.id)).toEqual(
      expectedCuratedBusinessFeedIds
    )
    expect(listFeedDirectoryFeeds("comics").map((feed) => feed.id)).toEqual(
      expectedComicsFeedIds
    )
    expect(listFeedDirectoryFeeds("food").map((feed) => feed.id)).toEqual(
      expectedFoodFeedIds
    )
    expect(listFeedDirectoryFeeds("design").map((feed) => feed.id)).toEqual(
      expectedDesignFeedIds
    )
    expect(
      listFeedDirectoryFeeds("entertainment").map((feed) => feed.id)
    ).toEqual(expectedCuratedEntertainmentFeedIds)
    expect(listFeedDirectoryFeeds("torrenting").map((feed) => feed.id)).toEqual(
      expectedTorrentingFeedIds
    )
    expect(listFeedDirectoryFeeds("advertising").map((feed) => feed.id)).toEqual(
      expectedAdvertisingFeedIds
    )
    expect(listFeedDirectoryFeeds("biopharma").map((feed) => feed.id)).toEqual(
      expectedBiopharmaFeedIds
    )
    expect(
      listFeedDirectoryFeeds("cybersecurity").map((feed) => feed.id)
    ).toEqual(expectedCybersecurityFeedIds)
    expect(listFeedDirectoryFeeds("energy").map((feed) => feed.id)).toEqual(
      expectedEnergyFeedIds
    )
    expect(listFeedDirectoryFeeds("healthcare").map((feed) => feed.id)).toEqual(
      expectedHealthcareFeedIds
    )
    expect(
      listFeedDirectoryFeeds("real-estate").map((feed) => feed.id)
    ).toEqual(expectedRealEstateFeedIds)
    expect(listFeedDirectoryFeeds("retail").map((feed) => feed.id)).toEqual(
      expectedRetailFeedIds
    )
    expect(
      listFeedDirectoryFeeds("travel-hospitality").map((feed) => feed.id)
    ).toEqual(expectedTravelHospitalityFeedIds)
    expect(
      listFeedDirectoryFeeds("entrepreneurship").map((feed) => feed.id)
    ).toEqual(expectedEntrepreneurshipFeedIds)
    expect(listFeedDirectoryFeeds("leadership").map((feed) => feed.id)).toEqual(
      expectedLeadershipFeedIds
    )
    expect(listFeedDirectoryFeeds("economics").map((feed) => feed.id)).toEqual(
      expectedEconomicsFeedIds
    )
    expect(listFeedDirectoryFeeds("seo").map((feed) => feed.id)).toEqual(
      expectedSeoFeedIds
    )
    expect(listFeedDirectoryFeeds("management").map((feed) => feed.id)).toEqual(
      expectedManagementFeedIds
    )
    expect(listFeedDirectoryFeeds("photography").map((feed) => feed.id)).toEqual(
      expectedPhotographyFeedIds
    )
    expect(
      listFeedDirectoryFeeds("data-science").map((feed) => feed.id)
    ).toEqual(expectedDataScienceFeedIds)
    expect(listFeedDirectoryFeeds("writing").map((feed) => feed.id)).toEqual(
      expectedWritingFeedIds
    )
    expect(listFeedDirectoryFeeds("creativity").map((feed) => feed.id)).toEqual(
      expectedCreativityFeedIds
    )
    expect(
      listFeedDirectoryFeeds("content-marketing").map((feed) => feed.id)
    ).toEqual(expectedContentMarketingFeedIds)
    expect(listFeedDirectoryFeeds("culture").map((feed) => feed.id)).toEqual(
      expectedCultureFeedIds
    )
    expect(listFeedDirectoryFeeds("crafts").map((feed) => feed.id)).toEqual(
      expectedCraftsFeedIds
    )
    expect(listFeedDirectoryFeeds("paranormal").map((feed) => feed.id)).toEqual(
      expectedParanormalFeedIds
    )
    expect(listFeedDirectoryFeeds("aliens").map((feed) => feed.id)).toEqual(
      expectedAliensFeedIds
    )
    expect(listFeedDirectoryFeeds("archaeology").map((feed) => feed.id)).toEqual(
      expectedArchaeologyFeedIds
    )
    expect(listFeedDirectoryFeeds("geology").map((feed) => feed.id)).toEqual(
      expectedGeologyFeedIds
    )
    expect(listFeedDirectoryFeeds("mma").map((feed) => feed.id)).toEqual(
      expectedMmaFeedIds
    )
    expect(listFeedDirectoryFeeds("boxing").map((feed) => feed.id)).toEqual(
      expectedBoxingFeedIds
    )
    expect(
      listFeedDirectoryFeeds("american-football").map((feed) => feed.id)
    ).toEqual(expectedAmericanFootballFeedIds)
    expect(listFeedDirectoryFeeds("basketball").map((feed) => feed.id)).toEqual(
      expectedBasketballFeedIds
    )
    expect(listFeedDirectoryFeeds("baseball").map((feed) => feed.id)).toEqual(
      expectedBaseballFeedIds
    )
    expect(listFeedDirectoryFeeds("hockey").map((feed) => feed.id)).toEqual(
      expectedHockeyFeedIds
    )
    expect(listFeedDirectoryFeeds("golf").map((feed) => feed.id)).toEqual(
      expectedGolfFeedIds
    )
    expect(listFeedDirectoryFeeds("missing")).toEqual([])
  })

  it("matches U.S., Canada, India, Great Britain, Australia, and Bangladesh legacy aliases across directory categories", () => {
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
    const espn = getFeedDirectoryFeed("espn-top-news")
    const cbsSports = getFeedDirectoryFeed("cbs-sports-headlines")
    const si = getFeedDirectoryFeed("sports-illustrated")
    const deadspin = getFeedDirectoryFeed("deadspin")
    const yahooSports = getFeedDirectoryFeed("yahoo-sports")
    const washingtonPostSports = getFeedDirectoryFeed(
      "washington-post-early-lead"
    )
    const huffpostTech = getFeedDirectoryFeed("huffpost-technology")
    const wsjTech = getFeedDirectoryFeed("wsj-technology")
    const recode = getFeedDirectoryFeed("the-verge-recode")
    const gizmodo = getFeedDirectoryFeed("gizmodo")
    const techrepublic = getFeedDirectoryFeed("techrepublic")
    const zdnet = getFeedDirectoryFeed("zdnet")
    const techInsider = getFeedDirectoryFeed("business-insider")
    const vergeTech = getFeedDirectoryFeed("the-verge-tech")
    const hollywoodReporter = getFeedDirectoryFeed("hollywood-reporter-live-feed")
    const rollingStone = getFeedDirectoryFeed("rolling-stone")
    const huffpostEntertainment = getFeedDirectoryFeed("huffpost-entertainment")
    const entertainmentTonight = getFeedDirectoryFeed("entertainment-tonight")
    const usWeekly = getFeedDirectoryFeed("us-weekly-entertainment")
    const washingtonPostEntertainment = getFeedDirectoryFeed(
      "washington-post-entertainment"
    )
    const ign = getFeedDirectoryFeed("ign")
    const kotaku = getFeedDirectoryFeed("kotaku")
    const gamesIndustry = getFeedDirectoryFeed("gamesindustry")
    const pcworldGaming = getFeedDirectoryFeed("pcworld-gaming")
    const gameDeveloper = getFeedDirectoryFeed("game-developer")
    const escapist = getFeedDirectoryFeed("escapist")
    const cheapAssGamer = getFeedDirectoryFeed("cheapassgamer")
    const gametrailers = getFeedDirectoryFeed("gametrailers")
    const pocketGamer = getFeedDirectoryFeed("pocket-gamer")
    const techcrunchGaming = getFeedDirectoryFeed("techcrunch-gaming-feed")
    const techradarGaming = getFeedDirectoryFeed("techradar-gaming")
    const radioCanadaInfo = getFeedDirectoryFeed("radio-canada-info")
    const cbcCanada = getFeedDirectoryFeed("cbc-canada")
    const torontoSun = getFeedDirectoryFeed("toronto-sun")
    const theTyee = getFeedDirectoryFeed("the-tyee")
    const cbcPoliticsCa = getFeedDirectoryFeed("cbc-politics-ca")
    const nytCanada = getFeedDirectoryFeed("nyt-canada")
    const financialPostTopStories = getFeedDirectoryFeed(
      "financial-post-top-stories"
    )
    const betakitBusiness = getFeedDirectoryFeed("betakit-business")
    const cbcHealthCa = getFeedDirectoryFeed("cbc-health-ca")
    const cbcScienceTechnology = getFeedDirectoryFeed(
      "cbc-science-technology"
    )
    const yahooCanadaSports = getFeedDirectoryFeed("yahoo-canada-sports")
    const cbcTechnologyCa = getFeedDirectoryFeed("cbc-technology-ca")
    const exclaim = getFeedDirectoryFeed("exclaim")
    const cbcArtsCa = getFeedDirectoryFeed("cbc-arts-ca")
    const hindustanTimesIndia = getFeedDirectoryFeed("hindustan-times-india")
    const hinduNationalPolitics = getFeedDirectoryFeed(
      "the-hindu-national-politics"
    )
    const economicTimesBusiness = getFeedDirectoryFeed(
      "economic-times-business"
    )
    const timesOfIndiaHealth = getFeedDirectoryFeed("times-of-india-health")
    const zeeScience = getFeedDirectoryFeed("zee-science-environment")
    const espncricinfoIndia = getFeedDirectoryFeed("espncricinfo-india")
    const gadgets360 = getFeedDirectoryFeed("gadgets-360")
    const bollywoodHungama = getFeedDirectoryFeed("bollywood-hungama")
    const indianVideoGamer = getFeedDirectoryFeed("indian-video-gamer")
    const skyNewsUk = getFeedDirectoryFeed("sky-news-uk")
    const bbcPoliticsGb = getFeedDirectoryFeed("bbc-politics-gb")
    const guardianBusinessGb = getFeedDirectoryFeed("guardian-business-gb")
    const independentHealthGb = getFeedDirectoryFeed("independent-health-gb")
    const registerScience = getFeedDirectoryFeed("register-science")
    const skySportsNewsGb = getFeedDirectoryFeed("sky-sports-news-gb")
    const bbcTechnologyGb = getFeedDirectoryFeed("bbc-technology-gb")
    const guardianFilmGb = getFeedDirectoryFeed("guardian-film-gb")
    const eurogamerGb = getFeedDirectoryFeed("eurogamer-gb")
    const abcNewsAustralia = getFeedDirectoryFeed("abc-news-australia")
    const guardianAustralianPolitics = getFeedDirectoryFeed(
      "guardian-australian-politics"
    )
    const dynamicBusiness = getFeedDirectoryFeed("dynamic-business")
    const wellbeingMagazine = getFeedDirectoryFeed("wellbeing-magazine")
    const theAgeTechnologyScience = getFeedDirectoryFeed(
      "the-age-technology-science"
    )
    const foxSportsAustralia = getFeedDirectoryFeed("fox-sports-australia")
    const techrepublicAustralia = getFeedDirectoryFeed("techrepublic-australia")
    const smhCultureAu = getFeedDirectoryFeed("smh-culture-au")
    const dailyStarBangladesh = getFeedDirectoryFeed("daily-star-bangladesh")
    const bd24live = getFeedDirectoryFeed("bd24live")
    const prothomAlo = getFeedDirectoryFeed("prothom-alo")

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
    expect(espn).toBeDefined()
    expect(cbsSports).toBeDefined()
    expect(si).toBeDefined()
    expect(deadspin).toBeDefined()
    expect(yahooSports).toBeDefined()
    expect(washingtonPostSports).toBeDefined()
    expect(huffpostTech).toBeDefined()
    expect(wsjTech).toBeDefined()
    expect(recode).toBeDefined()
    expect(gizmodo).toBeDefined()
    expect(techrepublic).toBeDefined()
    expect(zdnet).toBeDefined()
    expect(techInsider).toBeDefined()
    expect(vergeTech).toBeDefined()
    expect(hollywoodReporter).toBeDefined()
    expect(rollingStone).toBeDefined()
    expect(huffpostEntertainment).toBeDefined()
    expect(entertainmentTonight).toBeDefined()
    expect(usWeekly).toBeDefined()
    expect(washingtonPostEntertainment).toBeDefined()
    expect(ign).toBeDefined()
    expect(kotaku).toBeDefined()
    expect(gamesIndustry).toBeDefined()
    expect(pcworldGaming).toBeDefined()
    expect(gameDeveloper).toBeDefined()
    expect(escapist).toBeDefined()
    expect(cheapAssGamer).toBeDefined()
    expect(gametrailers).toBeDefined()
    expect(pocketGamer).toBeDefined()
    expect(techcrunchGaming).toBeDefined()
    expect(techradarGaming).toBeDefined()
    expect(radioCanadaInfo).toBeDefined()
    expect(cbcCanada).toBeDefined()
    expect(torontoSun).toBeDefined()
    expect(theTyee).toBeDefined()
    expect(cbcPoliticsCa).toBeDefined()
    expect(nytCanada).toBeDefined()
    expect(financialPostTopStories).toBeDefined()
    expect(betakitBusiness).toBeDefined()
    expect(cbcHealthCa).toBeDefined()
    expect(cbcScienceTechnology).toBeDefined()
    expect(yahooCanadaSports).toBeDefined()
    expect(cbcTechnologyCa).toBeDefined()
    expect(exclaim).toBeDefined()
    expect(cbcArtsCa).toBeDefined()
    expect(hindustanTimesIndia).toBeDefined()
    expect(hinduNationalPolitics).toBeDefined()
    expect(economicTimesBusiness).toBeDefined()
    expect(timesOfIndiaHealth).toBeDefined()
    expect(zeeScience).toBeDefined()
    expect(espncricinfoIndia).toBeDefined()
    expect(gadgets360).toBeDefined()
    expect(bollywoodHungama).toBeDefined()
    expect(indianVideoGamer).toBeDefined()
    expect(skyNewsUk).toBeDefined()
    expect(bbcPoliticsGb).toBeDefined()
    expect(guardianBusinessGb).toBeDefined()
    expect(independentHealthGb).toBeDefined()
    expect(registerScience).toBeDefined()
    expect(skySportsNewsGb).toBeDefined()
    expect(bbcTechnologyGb).toBeDefined()
    expect(guardianFilmGb).toBeDefined()
    expect(eurogamerGb).toBeDefined()
    expect(abcNewsAustralia).toBeDefined()
    expect(guardianAustralianPolitics).toBeDefined()
    expect(dynamicBusiness).toBeDefined()
    expect(wellbeingMagazine).toBeDefined()
    expect(theAgeTechnologyScience).toBeDefined()
    expect(foxSportsAustralia).toBeDefined()
    expect(techrepublicAustralia).toBeDefined()
    expect(smhCultureAu).toBeDefined()
    expect(dailyStarBangladesh).toBeDefined()
    expect(bd24live).toBeDefined()
    expect(prothomAlo).toBeDefined()
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
    expect(
      isDirectoryFeedSubscribed(espn!, [
        "http://sports.espn.go.com/espn/rss/news",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(cbsSports!, [
        "http://www.cbssports.com/partners/feeds/rss/home_news",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(si!, ["http://www.si.com/rss/si_topstories.rss"])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(deadspin!, [
        "http://feeds.gawker.com/deadspin/full",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(yahooSports!, [
        "https://sports.yahoo.com/top/rss.xml",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(washingtonPostSports!, [
        "http://feeds.washingtonpost.com/rss/rss_early-lead",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(huffpostTech!, [
        "http://www.huffingtonpost.com/feeds/verticals/technology/news.xml",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(wsjTech!, [
        "http://online.wsj.com/xml/rss/3_7455.xml",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(recode!, [
        "http://recode.net/category/security/feed/",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(gizmodo!, [
        "http://feeds.gawker.com/gizmodo/full",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(techrepublic!, [
        "http://techrepublic.com.feedsportal.com/c/35463/f/670841/index.rss",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(zdnet!, [
        "http://zdnet.com.feedsportal.com/c/35462/f/675634/index.rss",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(techInsider!, ["http://www.techinsider.io/rss"])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(vergeTech!, [
        "http://www.theverge.com/tech/rss/index.xml",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(hollywoodReporter!, [
        "http://www.hollywoodreporter.com/blogs/live-feed/rss",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(rollingStone!, [
        "http://www.rollingstone.com/news.rss",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(huffpostEntertainment!, [
        "http://www.huffingtonpost.com/feeds/verticals/entertainment/index.xml",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(entertainmentTonight!, [
        "http://feeds.feedburner.com/EtsBreakingNews",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(usWeekly!, [
        "http://www.usmagazine.com/feeds/movies_tv_music/atom",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(washingtonPostEntertainment!, [
        "http://www.washingtonpost.com/rss/entertainment",
      ])
    ).toBe(true)
    expect(isDirectoryFeedSubscribed(ign!, ["http://feeds.ign.com/ign/all"])).toBe(
      true
    )
    expect(
      isDirectoryFeedSubscribed(kotaku!, [
        "http://feeds.gawker.com/kotaku/full#_ga=1.111114893.94307673.1446233598",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(gamesIndustry!, [
        "http://www.gamesindustry.biz/rss/gamesindustry_news_feed.rss",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(pcworldGaming!, [
        "http://www.pcworld.com/column/game-on/index.rss",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(gameDeveloper!, [
        "http://www.gamasutra.com/static2/rssfeeds.html",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(escapist!, [
        "http://rss.escapistmagazine.com/tags/video-games.xml",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(cheapAssGamer!, [
        "https://www.cheapassgamer.com/rss/forums/1-cheap-ass-gamer-video-game-dealsforum/",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(gametrailers!, [
        "http://www.gametrailers.com/about/rss",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(pocketGamer!, [
        "http://www.pocketgamer.co.uk/rss.asp",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(techcrunchGaming!, [
        "http://feeds.feedburner.com/TechCrunch/gaming",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(techradarGaming!, [
        "http://feeds.webservice.techradar.com/us/rss/news/gaming",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(radioCanadaInfo!, [
        "http://rss.radio-canada.ca/fils/nouvelles/national.xml",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(cbcCanada!, [
        "http://www.cbc.ca/cmlink/rss-canada",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(torontoSun!, [
        "http://www.torontosun.com/home/rss.xml",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(theTyee!, [
        "http://feeds.feedblitz.com/thetyee",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(cbcPoliticsCa!, [
        "http://rss.cbc.ca/lineup/politics.xml",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(nytCanada!, [
        "http://topics.nytimes.com/top/news/international/countriesandterritories/canada/index.html?rss=1",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(financialPostTopStories!, [
        "http://feeds.feedburner.com/FP_TopStories?format=xml",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(betakitBusiness!, [
        "http://betakit.com/feed/",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(cbcHealthCa!, [
        "https://www.cbc.ca/webfeed/rss/rss-health",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(cbcScienceTechnology!, [
        "http://www.cbc.ca/cmlink/1.392",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(yahooCanadaSports!, [
        "https://ca.sports.yahoo.com/top/rss.xml",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(cbcTechnologyCa!, [
        "http://www.cbc.ca/cmlink/rss-technology",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(exclaim!, [
        "http://feeds.feedburner.com/ExclaimCaAllArticles",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(cbcArtsCa!, [
        "http://rss.cbc.ca/lineup/arts.xml",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(hindustanTimesIndia!, [
        "http://feeds.hindustantimes.com/HT-India",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(hinduNationalPolitics!, [
        "http://www.thehindu.com/news/national/?service=rss",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(economicTimesBusiness!, [
        "http://economictimes.indiatimes.com/rssfeedsdefault.cms",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(timesOfIndiaHealth!, [
        "http://timesofindia.indiatimes.com/rssfeeds/2886714.cms",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(zeeScience!, [
        "http://zeenews.india.com/rss/science-technology-news.xml",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(espncricinfoIndia!, [
        "http://www.espncricinfo.com/rss/content/story/feeds/6.xml",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(gadgets360!, [
        "http://feeds.feedburner.com/NDTV-Tech",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(bollywoodHungama!, [
        "http://www.bollywoodhungama.com/rss/news.xml",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(indianVideoGamer!, [
        "http://www.pcquest.com/rss-2-2/?cat_slug=games",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(skyNewsUk!, [
        "http://news.sky.com/feeds/rss/uk.xml",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(bbcPoliticsGb!, [
        "http://feeds.bbci.co.uk/news/politics/rss.xml",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(guardianBusinessGb!, [
        "http://feeds.theguardian.com/theguardian/uk/business/rss",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(independentHealthGb!, [
        "http://www.independent.co.uk/life-style/health-and-families/health-news/rss",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(registerScience!, [
        "http://www.theregister.co.uk/science/headlines.atom",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(skySportsNewsGb!, [
        "http://www.skysports.com/rss/0,20514,12040,00.xml",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(bbcTechnologyGb!, [
        "http://feeds.bbci.co.uk/news/technology/rss.xml#",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(guardianFilmGb!, [
        "http://www.theguardian.com/us/film/rss",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(eurogamerGb!, [
        "http://www.eurogamer.net/?format=rss",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(abcNewsAustralia!, [
        "http://www.abc.net.au/news/feed/46182/rss.xml",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(guardianAustralianPolitics!, [
        "http://www.theguardian.com/world/australian-politics/rss",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(dynamicBusiness!, [
        "http://www.dynamicbusiness.com.au/feed",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(wellbeingMagazine!, [
        "http://www.wellbeing.com.au/blog/feed/",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(theAgeTechnologyScience!, [
        "http://www.theage.com.au/rssheadlines/technology-news/article/rss.xml",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(foxSportsAustralia!, [
        "http://feeds.news.com.au/public/rss/2.0/fs_breaking_news_13.xml",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(techrepublicAustralia!, [
        "http://www.techrepublic.com/rssfeeds/blog/australian-technology/",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(smhCultureAu!, [
        "http://feeds.smh.com.au/rssheadlines/entertainment.xml",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(dailyStarBangladesh!, [
        "https://www.thedailystar.net/frontpage/rss.xml",
      ])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(bd24live!, ["https://www.bd24live.com/feed"])
    ).toBe(true)
    expect(
      isDirectoryFeedSubscribed(prothomAlo!, [
        "https://www.prothomalo.com/feed/",
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
    expect(directoryUrls).not.toContain(
      "http://content.usatoday.com/marketing/rss/rsstrans.aspx?feedId=sports1"
    )
    expect(directoryUrls).not.toContain(
      "http://hosted.ap.org/lineups/SPORTSHEADS.rss?SITE=AP&SECTION=HOME"
    )
    expect(directoryUrls).not.toContain("http://feeds.feedburner.com/TechCrunch/")
    expect(directoryUrls).not.toContain("http://mashable.com/category/rss/")
    expect(directoryUrls).not.toContain("http://www.cnet.com/rss/android-update/")
    expect(directoryUrls).not.toContain("http://feeds.venturebeat.com/smallbiz")
    expect(directoryUrls).not.toContain("http://feeds.gawker.com/valleywag/full")
    expect(directoryUrls).not.toContain("http://feeds.bizjournals.com/industry_7")
    expect(directoryUrls).not.toContain("http://www.geek.com/feed/")
    expect(directoryUrls).not.toContain(
      "http://feeds.reuters.com/reuters/technologyNews?format=xml"
    )
    expect(directoryUrls).not.toContain(
      "http://rss.feedsportal.com/c/270/f/3547/index.rss"
    )
    expect(directoryUrls).not.toContain(
      "http://rssfeeds.usatoday.com/usatoday-TechTopStories"
    )
    expect(directoryUrls).not.toContain("http://www.theinquirer.net/feeds/rss")
    expect(directoryUrls).not.toContain(
      "http://www.techtarget.com/html/pr/tt_pr.xml"
    )
    expect(directoryUrls).not.toContain(
      "http://feeds.feedburner.com/geekologie/iShm"
    )
    expect(directoryUrls).not.toContain("http://www.dailytech.com/rss.aspx")
    expect(directoryUrls).not.toContain(
      "http://feeds2.feedburner.com/bit-tech/all"
    )
    expect(directoryUrls).not.toContain(
      "http://hosted2.ap.org/atom/APDEFAULT/495d344a0d10421e9baa8ee77029cfbd"
    )
    expect(directoryUrls).not.toContain(
      "http://www.mtv.com/rss/news/news_full.jhtml"
    )
    expect(directoryUrls).not.toContain(
      "http://rss.ew.com/web/ew/rss/todayslatest/index.xml"
    )
    expect(directoryUrls).not.toContain(
      "http://grantland.com/hollywood-prospectus/feed/"
    )
    expect(directoryUrls).not.toContain(
      "http://rssfeeds.usatoday.com/usatoday-LifeTopStories"
    )
    expect(directoryUrls).not.toContain(
      "http://feeds.accesshollywood.com/AccessHollywood/LatestNews"
    )
    expect(directoryUrls).not.toContain("http://feeds.feedburner.com/fuse/latest")
    expect(directoryUrls).not.toContain(
      "http://feeds.feedburner.com/nydnrss/entertainment"
    )
    expect(directoryUrls).not.toContain("http://www.vice.com/music/rss")
    expect(directoryUrls).not.toContain("http://rss.cnn.com/rss/cnn_showbiz.rss")
    expect(directoryUrls).not.toContain("http://feeds.bet.com/AllBetcom")
    expect(directoryUrls).not.toContain("http://www.hitfix.com/headlines.rss")
    expect(directoryUrls).not.toContain(
      "http://rss.people.com/web/people/rss/topheadlines/index.xml"
    )
    expect(directoryUrls).not.toContain("http://news.yahoo.com/rss/entertainment")
    expect(directoryUrls).not.toContain(
      "http://feeds.reuters.com/reuters/entertainment"
    )
    expect(directoryUrls).not.toContain("http://toucharcade.com/feed/")
    expect(directoryUrls).not.toContain(
      "http://killscreendaily.com/articles/latest/"
    )
    expect(directoryUrls).not.toContain(
      "http://www.engadget.com/tag/@gaming/rss.xml"
    )
    expect(directoryUrls).not.toContain(
      "http://fulltextrssfeed.com/feed.php?url=www.joystiq.com%2Frss.xml"
    )
    expect(directoryUrls).not.toContain(
      "http://www.giantbomb.com/feeds/mashup/"
    )
    expect(directoryUrls).not.toContain("http://gamepolitics.com/feed/")
    expect(directoryUrls).not.toContain("http://www.tigsource.com/feed/")
    expect(directoryUrls).not.toContain(
      "http://www.wired.com/category/underwire/feed/"
    )
    expect(directoryUrls).not.toContain("http://www.cnet.com/rss/gaming/")
    expect(directoryUrls).not.toContain("http://rssfeeds.usatoday.com/topgaming")
    expect(
      directoryUrls.some((url) => url.startsWith("http://rss.canada.com/get/"))
    ).toBe(false)
    expect(directoryUrls).not.toContain(
      "http://www.huffingtonpost.ca/feeds/verticals/canada-politics/index.xml"
    )
    expect(directoryUrls).not.toContain(
      "http://www.huffingtonpost.ca/feeds/verticals/canada-business/index.xml"
    )
    expect(directoryUrls).not.toContain(
      "http://www.huffingtonpost.ca/feeds/verticals/canada-lifestyle/index.xml"
    )
    expect(directoryUrls).not.toContain(
      "http://www.huffingtonpost.ca/feeds/verticals/canada-sports/index.xml"
    )
    expect(directoryUrls).not.toContain(
      "http://www.huffingtonpost.ca/feeds/verticals/canada-music/index.xml"
    )
    expect(directoryUrls).not.toContain(
      "http://www.ctvnews.ca/rss/ctvnews-ca-canada-public-rss-1.822284"
    )
    expect(directoryUrls).not.toContain(
      "http://www.ctvnews.ca/rss/ctvnews-ca-politics-public-rss-1.822302"
    )
    expect(directoryUrls).not.toContain(
      "http://www.ctvnews.ca/rss/business/ctv-news-business-headlines-1.867648"
    )
    expect(directoryUrls).not.toContain("http://rss.canoe.com/Money/home.xml")
    expect(directoryUrls).not.toContain("http://rss.canoe.com/Slam/home.xml")
    expect(directoryUrls).not.toContain(
      "http://rss.canoe.com/Jam/Celebrities/home.xml"
    )
    expect(directoryUrls).not.toContain(
      "http://rss.canoe.com/Jam/Music/home.xml"
    )
    expect(directoryUrls).not.toContain(
      "http://feeds.feedburner.com/feedburner/g4tv_ca"
    )
    expect(directoryUrls).not.toContain("http://www.cvawards.ca/feed/")
    expect(directoryUrls).not.toContain("http://www.gamingpost.ca/feed/")
    expect(directoryUrls).not.toContain(
      "http://www.ellecanada.com/rss_feed/home.rss"
    )
    expect(directoryUrls).not.toContain(
      "http://www.thestar.com/feeds.articles.life.health_wellness.rss"
    )
    expect(directoryUrls).not.toContain(
      "http://www.thestar.com/feeds.articles.life.technology.rss"
    )
    expect(directoryUrls).not.toContain(
      "http://www.tsn.ca/datafiles/rss/Stories.xml"
    )
    expect(directoryUrls).not.toContain("http://www.sportsnet.ca/feed/")
    expect(directoryUrls).not.toContain(
      "http://www.pcauthority.com.au/RSS/rss.ashx?type=Category&ID=12"
    )
    expect(directoryUrls).not.toContain(
      "http://www.techvibes.com/feed/blog/xml/global/"
    )
    expect(directoryUrls).not.toContain(
      "http://syndication.eonline.com/syndication/feeds/rssfeeds/topstories.xml?edition=ca"
    )
    expect(directoryUrls).not.toContain("http://blogs.etcanada.com/feed/")
    expect(directoryUrls).not.toContain("http://www.hgtv.ca/rss.ashx")
    expect(directoryUrls).not.toContain("http://feeds.feedburner.com/thescenemag")
    expect(directoryUrls.some((url) => url.includes("telegraphindia.com/feeds/rss.jsp"))).toBe(false)
    expect(directoryUrls.some((url) => url.includes("sify.com/rss2/"))).toBe(false)
    expect(directoryUrls.some((url) => url.includes("indiatoday.feedsportal.com"))).toBe(false)
    expect(directoryUrls).not.toContain("http://www.livemint.com/rss/consumer")
    expect(directoryUrls).not.toContain(
      "http://www.femina.in/feeds/feeds-fitness.xml"
    )
    expect(directoryUrls).not.toContain(
      "http://www.femina.in/feeds/feeds-lifestyle.xml"
    )
    expect(directoryUrls).not.toContain(
      "http://www.thehindu.com/news/international/south-asia/?service=rss"
    )
    expect(directoryUrls).not.toContain(
      "http://zeenews.india.com/rss/india-national-news.xml"
    )
    expect(directoryUrls).not.toContain(
      "http://www.theguardian.com/observer/rss"
    )
    expect(directoryUrls).not.toContain(
      "http://rss.feedsportal.com/c/266/f/3503/index.rss"
    )
    expect(directoryUrls).not.toContain(
      "http://rss.feedsportal.com/c/266/f/3496/index.rss"
    )
    expect(directoryUrls).not.toContain(
      "http://rss.feedsportal.com/c/266/f/3510/index.rss"
    )
    expect(directoryUrls).not.toContain(
      "http://rss.feedsportal.com/c/266/f/3784/index.rss"
    )
    expect(directoryUrls).not.toContain(
      "http://www.economist.com/sections/business-finance/rss.xml"
    )
    expect(directoryUrls).not.toContain(
      "http://www.huffingtonpost.co.uk/news/british-national-party/feed/"
    )
    expect(directoryUrls).not.toContain(
      "http://www.huffingtonpost.co.uk/feeds/verticals/uk-sport/index.xml"
    )
    expect(directoryUrls).not.toContain(
      "http://celebrity.uk.msn.com/RSS-Celebrity-Gossip.aspx"
    )
    expect(directoryUrls).not.toContain(
      "http://tv.uk.msn.com/blog/editor-rss.aspx"
    )
    expect(directoryUrls).not.toContain(
      "https://uk.eurosport.yahoo.com/eurosport/tickerdb/sport/0.xml"
    )
    expect(directoryUrls).not.toContain(
      "http://feeds.feedburner.com/SportcoukNewsRssFeed"
    )
    expect(directoryUrls).not.toContain(
      "http://feeds.feedburner.com/TheAustralianTheNationNews"
    )
    expect(directoryUrls).not.toContain(
      "http://feeds.feedburner.com/TheAustralianPolitics"
    )
    expect(directoryUrls).not.toContain(
      "http://feeds.feedburner.com/TheAustralianBusNews?format=xml"
    )
    expect(directoryUrls).not.toContain(
      "http://feeds.news.com.au/public/rss/2.0/business_top_stories_346.xml"
    )
    expect(directoryUrls).not.toContain(
      "http://feeds.news.com.au/public/rss/2.0/news_lifestyle_3171.xml"
    )
    expect(directoryUrls).not.toContain(
      "http://feeds.news.com.au/public/rss/2.0/news_tech_506.xml"
    )
    expect(directoryUrls).not.toContain(
      "http://feeds.news.com.au/public/rss/2.0/news_sport_3168.xml"
    )
    expect(directoryUrls).not.toContain(
      "http://feeds.bbci.co.uk/sport/0/cricket/rss.xml?edition=uk"
    )
    expect(directoryUrls).not.toContain("http://www.telegraph.co.uk/health/rss")
    expect(directoryUrls).not.toContain(
      "http://www.dailyrecord.co.uk/lifestyle/health-fitness/rss.xml"
    )
    expect(directoryUrls).not.toContain(
      "http://feeds.feedburner.com/sunshinecoastdailyentertainmen"
    )
    expect(directoryUrls).not.toContain(
      "http://www.womenshealthandfitness.com.au/component/obrss/women-s-health-fitnesscombined-feed?format="
    )
    expect(directoryUrls).not.toContain(
      "https://bdnews24.com/?widgetName=rssfeed&widgetId=1150&getXmlFeed=true"
    )
    expect(directoryUrls).not.toContain(
      "https://www.banglanews24.com/rss/rss.xml"
    )
    expect(directoryUrls).not.toContain(
      "https://www.jugantor.com/feed/rss.xml"
    )
    expect(directoryUrls).not.toContain("https://www.kalerkantho.com/rss.xml")
  })
})

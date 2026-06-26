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
    expect(listFeedDirectoryFeeds("missing")).toEqual([])
  })

  it("matches U.S. and Canada legacy aliases across directory categories", () => {
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
  })
})

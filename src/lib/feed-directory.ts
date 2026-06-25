export type FeedDirectoryCategory = {
  readonly description: string
  readonly id: string
  readonly label: string
}

export type FeedDirectoryFeed = {
  readonly aliases?: readonly string[]
  readonly categoryId: string
  readonly id: string
  readonly label: string
  readonly source: string
  readonly url: string
}

export const feedDirectoryCategories: readonly FeedDirectoryCategory[] = [
  {
    description: "National and world reporting from established U.S. newsrooms.",
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
]

export const feedDirectoryFeeds: readonly FeedDirectoryFeed[] = [
  {
    aliases: ["http://feeds.abcnews.com/abcnews/usheadlines"],
    categoryId: "us-general",
    id: "abc-news-us",
    label: "ABC News - U.S.",
    source: "abcnews.com",
    url: "https://abcnews.com/abcnews/usheadlines",
  },
  {
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
    categoryId: "us-politics",
    id: "real-clear-politics",
    label: "RealClearPolitics",
    source: "realclearpolitics.com",
    url: "http://feeds.feedburner.com/realclearpolitics/qlMj",
  },
  {
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
  {
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

export function getFeedDirectoryCategory(categoryId?: string) {
  return (
    feedDirectoryCategories.find((category) => category.id === categoryId) ??
    feedDirectoryCategories[0]
  )
}

export function getFeedDirectoryFeed(feedId: string) {
  return feedDirectoryFeeds.find((feed) => feed.id === feedId)
}

export function listFeedDirectoryFeeds(categoryId: string) {
  return feedDirectoryFeeds.filter((feed) => feed.categoryId === categoryId)
}

export function isDirectoryFeedSubscribed(
  feed: FeedDirectoryFeed,
  subscriptionUrls: readonly string[]
) {
  const feedUrls = new Set(
    [feed.url, ...(feed.aliases ?? [])]
      .map(normalizeDirectoryUrl)
      .filter((url): url is string => url !== null)
  )

  return subscriptionUrls.some((url) => {
    const normalizedUrl = normalizeDirectoryUrl(url)
    return normalizedUrl !== null && feedUrls.has(normalizedUrl)
  })
}

export function validateFeedDirectoryCatalog() {
  const errors: string[] = []
  const categoryIds = new Set<string>()

  for (const category of feedDirectoryCategories) {
    if (!hasText(category.description) || !hasText(category.id) || !hasText(category.label)) {
      errors.push(`Incomplete category: ${category.id || "(missing id)"}`)
    }

    if (categoryIds.has(category.id)) {
      errors.push(`Duplicate category ID: ${category.id}`)
    }

    categoryIds.add(category.id)
  }

  const feedIds = new Set<string>()
  const urlOwners = new Map<
    string,
    Array<{ categoryId: string; feedId: string }>
  >()

  for (const feed of feedDirectoryFeeds) {
    if (
      !hasText(feed.categoryId) ||
      !hasText(feed.id) ||
      !hasText(feed.label) ||
      !hasText(feed.source) ||
      !hasText(feed.url)
    ) {
      errors.push(`Incomplete feed: ${feed.id || "(missing id)"}`)
    }

    if (feedIds.has(feed.id)) {
      errors.push(`Duplicate feed ID: ${feed.id}`)
    }

    feedIds.add(feed.id)

    if (!categoryIds.has(feed.categoryId)) {
      errors.push(`Unknown category "${feed.categoryId}" for feed "${feed.id}"`)
    }

    for (const url of [feed.url, ...(feed.aliases ?? [])]) {
      const normalizedUrl = normalizeDirectoryUrl(url)

      if (!normalizedUrl) {
        errors.push(`Invalid or unsupported URL for feed "${feed.id}": ${url}`)
        continue
      }

      const owners = urlOwners.get(normalizedUrl) ?? []
      const sameCategoryOwner = owners.find(
        (owner) =>
          owner.categoryId === feed.categoryId && owner.feedId !== feed.id
      )

      if (sameCategoryOwner) {
        errors.push(
          `Duplicate normalized URL "${normalizedUrl}" for feeds "${sameCategoryOwner.feedId}" and "${feed.id}"`
        )
      } else {
        urlOwners.set(normalizedUrl, [
          ...owners,
          {
            categoryId: feed.categoryId,
            feedId: feed.id,
          },
        ])
      }
    }
  }

  return errors
}

function hasText(value: string) {
  return typeof value === "string" && value.trim().length > 0
}

function normalizeDirectoryUrl(value: string) {
  try {
    const url = new URL(value)

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null
    }

    url.protocol = "https:"
    url.hostname = url.hostname.toLowerCase()
    url.port = ""
    url.hash = ""
    url.searchParams.sort()

    if (url.pathname !== "/") {
      url.pathname = url.pathname.replace(/\/+$/, "") || "/"
    }

    return url.href
  } catch {
    return null
  }
}

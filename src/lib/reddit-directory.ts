import type { FeedDirectoryCategory, FeedDirectoryFeed } from "./feed-directory"

export const REDDIT_DISCOVER_CATEGORY_ID = "reddit"
export const REDDIT_DISCOVER_CATEGORY_SORT_ORDER = 10_000

export const redditDirectoryCategory = {
  description:
    "Popular subreddit RSS feeds from Reddit's most visited communities.",
  id: REDDIT_DISCOVER_CATEGORY_ID,
  label: "Reddit",
} satisfies FeedDirectoryCategory

const topVisitedSubreddits = [
  "AskReddit",
  "whatisit",
  "SipsTea",
  "mildlyinfuriating",
  "interestingasfuck",
  "NoStupidQuestions",
  "PeterExplainsTheJoke",
  "sachintendulkar",
  "mildlyinteresting",
  "interesting",
  "movies",
  "Damnthatsinteresting",
  "todayilearned",
  "TikTokCringe",
  "worldnews",
  "popculturechat",
  "isthisAI",
  "funny",
  "news",
  "GirlDinnerDiaries",
  "technology",
  "pics",
  "okbuddycinephile",
  "Wellthatsucks",
  "nextfuckinglevel",
  "Weird",
  "explainlikeimfive",
  "politics",
  "pcmasterrace",
  "MadeMeSmile",
  "nba",
  "BeAmazed",
  "memes",
  "cats",
  "whoathatsinteresting",
  "whatdoIdo",
  "TheBoys",
  "wallstreetbets",
  "dashcams",
  "Cooking",
  "oddlysatisfying",
  "Piracy",
  "AmIOverreacting",
  "LivestreamFail",
  "geography",
  "gaming",
  "AmItheAsshole",
  "theydidthemath",
  "ExplainTheJoke",
  "meirl",
] as const

export const redditDirectoryFeeds: readonly FeedDirectoryFeed[] =
  topVisitedSubreddits.map((subreddit) => subredditDirectoryFeed(subreddit))

export function getRedditDirectoryFeed(feedId: string) {
  return redditDirectoryFeeds.find((feed) => feed.id === feedId)
}

export function getRedditDirectoryFeedBySubreddit(subredditName: string) {
  const subredditKey = subredditName.toLowerCase()

  return redditDirectoryFeeds.find(
    (feed) => subredditNameFromFeedId(feed.id) === subredditKey
  )
}

export function subredditDirectoryFeed(
  subredditName: string
): FeedDirectoryFeed {
  return {
    categoryId: REDDIT_DISCOVER_CATEGORY_ID,
    id: subredditFeedId(subredditName),
    label: subredditFeedLabel(subredditName),
    source: "reddit.com",
    url: subredditRssUrl(subredditName),
  }
}

export function subredditFeedId(subredditName: string) {
  return `reddit-${subredditName.toLowerCase().replace(/_/g, "-")}`
}

export function subredditFeedLabel(subredditName: string) {
  return `r/${subredditName}`
}

export function subredditRssUrl(subredditName: string) {
  return `https://www.reddit.com/r/${subredditName}/.rss`
}

function subredditNameFromFeedId(feedId: string) {
  return feedId.replace(/^reddit-/, "").replace(/-/g, "_").toLowerCase()
}

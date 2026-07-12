import { describe, expect, it } from "vitest"

import {
  REDDIT_DISCOVER_CATEGORY_ID,
  redditDirectoryCategory,
  redditDirectoryFeeds,
} from "./reddit-directory"

const expectedTopSubreddits = [
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

describe("reddit directory", () => {
  it("defines a Reddit topic with the current top 50 most visited communities", () => {
    expect(redditDirectoryCategory).toMatchObject({
      id: REDDIT_DISCOVER_CATEGORY_ID,
      label: "Reddit",
    })
    expect(redditDirectoryFeeds).toHaveLength(50)
    expect(redditDirectoryFeeds.map((feed) => feed.label)).toEqual(
      expectedTopSubreddits.map((subreddit) => `r/${subreddit}`)
    )
  })

  it("uses subreddit RSS feeds and stable unique ids", () => {
    const ids = new Set(redditDirectoryFeeds.map((feed) => feed.id))

    expect(ids.size).toBe(redditDirectoryFeeds.length)
    expect(redditDirectoryFeeds[0]).toEqual({
      categoryId: REDDIT_DISCOVER_CATEGORY_ID,
      id: "reddit-askreddit",
      label: "r/AskReddit",
      source: "reddit.com",
      url: "https://www.reddit.com/r/AskReddit/.rss",
    })
    expect(redditDirectoryFeeds[49]).toMatchObject({
      id: "reddit-meirl",
      label: "r/meirl",
      url: "https://www.reddit.com/r/meirl/.rss",
    })
    expect(
      redditDirectoryFeeds.every(
        (feed) =>
          feed.categoryId === REDDIT_DISCOVER_CATEGORY_ID &&
          feed.url.endsWith("/.rss")
      )
    ).toBe(true)
  })
})

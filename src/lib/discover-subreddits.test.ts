import { describe, expect, it, vi } from "vitest"

import {
  DiscoverSubredditError,
  addDiscoverSubredditToRedditTopic,
  normalizeSubredditName,
} from "./discover-subreddits"

function createStore() {
  return {
    adminAuditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
    discoverCategory: {
      upsert: vi.fn().mockResolvedValue({
        id: "category-reddit",
      }),
    },
    discoverFeed: {
      create: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue(null),
    },
  }
}

describe("discover subreddit admin tools", () => {
  it("normalizes subreddit names, URLs, and RSS URLs", () => {
    expect(normalizeSubredditName("  r/localhistory  ")).toBe("localhistory")
    expect(normalizeSubredditName("/r/AskHistorians/")).toBe("AskHistorians")
    expect(normalizeSubredditName("https://www.reddit.com/r/space/.rss")).toBe(
      "space"
    )
    expect(normalizeSubredditName("https://reddit.com/r/UI_Design/")).toBe(
      "UI_Design"
    )
  })

  it("adds a subreddit feed to the Reddit Discover topic", async () => {
    const store = createStore()
    const result = await addDiscoverSubredditToRedditTopic({
      adminUserId: "admin-1",
      store,
      subredditName: "r/localhistory",
    })

    expect(store.discoverCategory.upsert).toHaveBeenCalledWith({
      create: expect.objectContaining({
        countryCode: null,
        label: "Reddit",
        slug: "reddit",
      }),
      update: expect.objectContaining({
        countryCode: null,
        label: "Reddit",
      }),
      where: {
        slug: "reddit",
      },
    })
    expect(store.discoverFeed.create).toHaveBeenCalledWith({
      data: {
        aliases: [],
        categoryId: "category-reddit",
        label: "r/localhistory",
        slug: "reddit-localhistory",
        sortOrder: 10_000,
        source: "reddit.com",
        url: "https://www.reddit.com/r/localhistory/.rss",
      },
    })
    expect(store.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "DISCOVER_SUBREDDIT_ADD",
        adminUserId: "admin-1",
        targetId: "reddit-localhistory",
        targetType: "DiscoverFeed",
      }),
    })
    expect(result).toEqual({
      feedId: "reddit-localhistory",
      label: "r/localhistory",
      subredditName: "localhistory",
      url: "https://www.reddit.com/r/localhistory/.rss",
    })
  })

  it("rejects invalid and already seeded subreddits", async () => {
    await expect(
      addDiscoverSubredditToRedditTopic({
        adminUserId: "admin-1",
        store: createStore(),
        subredditName: "r/not valid",
      })
    ).rejects.toThrow(DiscoverSubredditError)

    await expect(
      addDiscoverSubredditToRedditTopic({
        adminUserId: "admin-1",
        store: createStore(),
        subredditName: "AskReddit",
      })
    ).rejects.toThrow("r/AskReddit is already in the Reddit topic.")
  })
})

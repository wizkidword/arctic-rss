import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  articleDeleteMany,
  articleStateDeleteMany,
  countUnreadArticlesForFeed,
  deleteMany,
  discoverFeedFromUrl,
  feedSubscriptionCreate,
  feedDelete,
  feedUpsert,
  findFirst,
  findMany,
  folderFindFirst,
  reactCache,
} = vi.hoisted(() => ({
  articleDeleteMany: vi.fn(),
  articleStateDeleteMany: vi.fn(),
  countUnreadArticlesForFeed: vi.fn(),
  deleteMany: vi.fn(),
  discoverFeedFromUrl: vi.fn(),
  feedSubscriptionCreate: vi.fn(),
  feedDelete: vi.fn(),
  feedUpsert: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  folderFindFirst: vi.fn(),
  reactCache: vi.fn((loader) => loader),
}))

vi.mock("react", () => ({
  cache: reactCache,
}))

vi.mock("./db", () => ({
  getPrisma: () => ({
    article: {
      deleteMany: articleDeleteMany,
    },
    articleState: {
      deleteMany: articleStateDeleteMany,
    },
    feed: {
      delete: feedDelete,
      upsert: feedUpsert,
    },
    feedSubscription: {
      create: feedSubscriptionCreate,
      deleteMany,
      findFirst,
      findMany,
    },
    folder: {
      findFirst: folderFindFirst,
    },
  }),
}))

vi.mock("./articles", () => ({
  countUnreadArticlesForFeed,
}))

vi.mock("./feed-discovery", () => ({
  discoverFeedFromUrl,
}))

import {
  FeedSubscriptionError,
  listUserFeedSubscriptions,
  subscribeToFeed,
  unsubscribeFromFeed,
} from "./feed-subscriptions"

describe("feed subscriptions", () => {
  beforeEach(() => {
    articleDeleteMany.mockReset()
    articleStateDeleteMany.mockReset()
    countUnreadArticlesForFeed.mockReset()
    deleteMany.mockReset()
    discoverFeedFromUrl.mockReset()
    feedSubscriptionCreate.mockReset()
    feedDelete.mockReset()
    feedUpsert.mockReset()
    findFirst.mockReset()
    findMany.mockReset()
    folderFindFirst.mockReset()
    countUnreadArticlesForFeed.mockResolvedValue(3)
  })

  it("creates the reader loader through React cache", () => {
    expect(reactCache).toHaveBeenCalledTimes(1)
    expect(reactCache).toHaveBeenCalledWith(expect.any(Function))
    expect(reactCache.mock.calls[0]?.[0].name).toBe(
      "listUserFeedSubscriptions"
    )
  })

  it("includes folder metadata for reader navigation", async () => {
    findMany.mockResolvedValue([
      {
        customTitle: null,
        feed: {
          faviconUrl: null,
          feedUrl: "https://example.com/feed.xml",
          lastError: null,
          siteUrl: "https://example.com",
          title: "Example Feed",
        },
        feedId: "feed-1",
        folder: {
          id: "folder-1",
          name: "Tech",
        },
        folderId: "folder-1",
        id: "subscription-1",
        isPaused: false,
      },
    ])

    const subscriptions = await listUserFeedSubscriptions("user-1")

    expect(findMany).toHaveBeenCalledWith({
      include: {
        feed: true,
        folder: true,
      },
      orderBy: [{ sortOrder: "asc" }, { subscribedAt: "desc" }],
      where: { userId: "user-1" },
    })
    expect(subscriptions).toEqual([
      {
        faviconUrl: null,
        feedId: "feed-1",
        feedUrl: "https://example.com/feed.xml",
        folderId: "folder-1",
        folderName: "Tech",
        id: "subscription-1",
        isPaused: false,
        lastError: null,
        siteUrl: "https://example.com",
        title: "Example Feed",
        unreadCount: 3,
      },
    ])
  })

  it("unsubscribes only the current user's subscription", async () => {
    findFirst.mockResolvedValue({
      customTitle: "My Example Feed",
      feed: {
        title: "Example Feed",
      },
      id: "subscription-1",
    })
    deleteMany.mockResolvedValue({ count: 1 })

    const result = await unsubscribeFromFeed({
      subscriptionId: "subscription-1",
      userId: "user-1",
    })

    expect(findFirst).toHaveBeenCalledWith({
      select: {
        customTitle: true,
        feed: {
          select: {
            title: true,
          },
        },
        id: true,
      },
      where: {
        id: "subscription-1",
        userId: "user-1",
      },
    })
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        id: "subscription-1",
        userId: "user-1",
      },
    })
    expect(result).toEqual({
      id: "subscription-1",
      title: "My Example Feed",
    })
    expect(feedDelete).not.toHaveBeenCalled()
    expect(articleDeleteMany).not.toHaveBeenCalled()
    expect(articleStateDeleteMany).not.toHaveBeenCalled()
  })

  it("falls back to the feed title when no custom title is set", async () => {
    findFirst.mockResolvedValue({
      customTitle: null,
      feed: {
        title: "Example Feed",
      },
      id: "subscription-1",
    })
    deleteMany.mockResolvedValue({ count: 1 })

    await expect(
      unsubscribeFromFeed({
        subscriptionId: "subscription-1",
        userId: "user-1",
      })
    ).resolves.toEqual({
      id: "subscription-1",
      title: "Example Feed",
    })
  })

  it("rejects missing or foreign subscriptions without deleting", async () => {
    findFirst.mockResolvedValue(null)

    await expect(
      unsubscribeFromFeed({
        subscriptionId: "subscription-1",
        userId: "user-1",
      })
    ).rejects.toEqual(
      new FeedSubscriptionError("That feed subscription was not found.")
    )

    expect(deleteMany).not.toHaveBeenCalled()
  })

  it("rejects a subscription that disappears before deletion", async () => {
    findFirst.mockResolvedValue({
      customTitle: null,
      feed: {
        title: "Example Feed",
      },
      id: "subscription-1",
    })
    deleteMany.mockResolvedValue({ count: 0 })

    await expect(
      unsubscribeFromFeed({
        subscriptionId: "subscription-1",
        userId: "user-1",
      })
    ).rejects.toEqual(
      new FeedSubscriptionError("That feed subscription was not found.")
    )

    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        id: "subscription-1",
        userId: "user-1",
      },
    })
  })

  it("rejects directory alias-equivalent duplicate subscriptions before upserting a feed", async () => {
    discoverFeedFromUrl.mockResolvedValue({
      description: "Latest reporting from The Daily Beast.",
      faviconUrl: "https://www.thedailybeast.com/favicon.ico",
      feedUrl: "http://feeds.feedburner.com/thedailybeast/articles",
      format: "rss",
      language: "en",
      siteUrl: "https://www.thedailybeast.com",
      title: "The Daily Beast",
    })
    findMany.mockResolvedValue([
      {
        feed: {
          feedUrl: "https://feeds.feedburner.com/thedailybeast/articles",
          title: "The Daily Beast - Latest",
        },
      },
    ])
    feedUpsert.mockResolvedValue({
      id: "daily-beast-http-feed",
      title: "The Daily Beast",
    })
    feedSubscriptionCreate.mockResolvedValue({
      feed: {
        title: "The Daily Beast",
      },
      id: "subscription-1",
    })

    await expect(
      subscribeToFeed({
        url: "http://feeds.feedburner.com/thedailybeast/articles",
        userId: "user-1",
      })
    ).rejects.toEqual(
      new FeedSubscriptionError(
        "You are already subscribed to The Daily Beast - Latest."
      )
    )

    expect(findMany).toHaveBeenCalledWith({
      select: {
        feed: {
          select: {
            feedUrl: true,
            title: true,
          },
        },
      },
      where: { userId: "user-1" },
    })
    expect(feedUpsert).not.toHaveBeenCalled()
    expect(feedSubscriptionCreate).not.toHaveBeenCalled()
  })

  it("persists directory alias discoveries under the canonical catalog feed URL", async () => {
    discoverFeedFromUrl.mockResolvedValue({
      description: "Latest reporting from The Daily Beast.",
      faviconUrl: "https://www.thedailybeast.com/favicon.ico",
      feedUrl: "http://feeds.feedburner.com/thedailybeast/articles",
      format: "rss",
      language: "en",
      siteUrl: "https://www.thedailybeast.com",
      title: "The Daily Beast",
    })
    findMany.mockResolvedValue([])
    feedUpsert.mockResolvedValue({
      id: "daily-beast-feed",
      title: "The Daily Beast",
    })
    feedSubscriptionCreate.mockResolvedValue({
      feed: {
        title: "The Daily Beast",
      },
      id: "subscription-1",
    })

    await subscribeToFeed({
      url: "http://feeds.feedburner.com/thedailybeast/articles",
      userId: "user-1",
    })

    expect(feedUpsert).toHaveBeenCalledWith({
      where: {
        feedUrl: "https://feeds.feedburner.com/thedailybeast/articles",
      },
      create: expect.objectContaining({
        description: "Latest reporting from The Daily Beast.",
        faviconUrl: "https://www.thedailybeast.com/favicon.ico",
        feedUrl: "https://feeds.feedburner.com/thedailybeast/articles",
        language: "en",
        siteUrl: "https://www.thedailybeast.com",
        title: "The Daily Beast",
      }),
      update: expect.objectContaining({
        description: "Latest reporting from The Daily Beast.",
        faviconUrl: "https://www.thedailybeast.com/favicon.ico",
        language: "en",
        siteUrl: "https://www.thedailybeast.com",
        title: "The Daily Beast",
      }),
    })
    expect(feedSubscriptionCreate).toHaveBeenCalledWith({
      data: {
        feedId: "daily-beast-feed",
        folderId: undefined,
        userId: "user-1",
      },
      include: {
        feed: true,
      },
    })
  })
})

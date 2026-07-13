import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  articleDeleteMany,
  articleCreateMany,
  articleFindMany,
  articleUpdate,
  articleStateDeleteMany,
  getUnreadArticleCountsByFeed,
  deleteMany,
  discoverFeedFromUrl,
  feedSubscriptionCreate,
  folderCreate,
  feedDelete,
  feedFindUnique,
  feedUpdate,
  feedUpsert,
  findFirst,
  findMany,
  folderFindFirst,
  reactCache,
  transaction,
  userFindUnique,
} = vi.hoisted(() => ({
  articleDeleteMany: vi.fn(),
  articleCreateMany: vi.fn(),
  articleFindMany: vi.fn(),
  articleUpdate: vi.fn(),
  articleStateDeleteMany: vi.fn(),
  getUnreadArticleCountsByFeed: vi.fn(),
  deleteMany: vi.fn(),
  discoverFeedFromUrl: vi.fn(),
  feedSubscriptionCreate: vi.fn(),
  folderCreate: vi.fn(),
  feedDelete: vi.fn(),
  feedFindUnique: vi.fn(),
  feedUpdate: vi.fn(),
  feedUpsert: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  folderFindFirst: vi.fn(),
  reactCache: vi.fn((loader) => loader),
  transaction: vi.fn(),
  userFindUnique: vi.fn(),
}))

vi.mock("react", () => ({
  cache: reactCache,
}))

vi.mock("./db", () => ({
  getPrisma: () => ({
    article: {
      createMany: articleCreateMany,
      deleteMany: articleDeleteMany,
      findMany: articleFindMany,
      update: articleUpdate,
    },
    articleState: {
      deleteMany: articleStateDeleteMany,
    },
    feed: {
      delete: feedDelete,
      findUnique: feedFindUnique,
      update: feedUpdate,
      upsert: feedUpsert,
    },
    feedSubscription: {
      create: feedSubscriptionCreate,
      deleteMany,
      findFirst,
      findMany,
    },
    folder: {
      create: folderCreate,
      findFirst: folderFindFirst,
    },
    user: {
      findUnique: userFindUnique,
    },
    $transaction: transaction,
  }),
}))

vi.mock("./articles", () => ({
  getUnreadArticleCountsByFeed,
}))

vi.mock("./feed-discovery", () => ({
  discoverFeedFromUrl,
}))

import {
  FeedSubscriptionError,
  hasUserFeedSubscriptions,
  listUserFeedSubscriptions,
  subscribeToFeed,
  unsubscribeFromFeed,
} from "./feed-subscriptions"

describe("feed subscriptions", () => {
  beforeEach(() => {
    articleDeleteMany.mockReset()
    articleCreateMany.mockReset()
    articleFindMany.mockReset()
    articleUpdate.mockReset()
    articleStateDeleteMany.mockReset()
    getUnreadArticleCountsByFeed.mockReset()
    deleteMany.mockReset()
    discoverFeedFromUrl.mockReset()
    feedSubscriptionCreate.mockReset()
    folderCreate.mockReset()
    feedDelete.mockReset()
    feedFindUnique.mockReset()
    feedUpdate.mockReset()
    feedUpsert.mockReset()
    findFirst.mockReset()
    findMany.mockReset()
    folderFindFirst.mockReset()
    transaction.mockReset()
    userFindUnique.mockReset()
    getUnreadArticleCountsByFeed.mockResolvedValue(new Map([["feed-1", 3]]))
    feedUpdate.mockResolvedValue({})
    articleCreateMany.mockResolvedValue({ count: 1 })
    articleFindMany.mockResolvedValue([])
    articleUpdate.mockResolvedValue({})
    userFindUnique.mockResolvedValue({
      _count: {
        podcastSubscriptions: 0,
        subscriptions: 0,
      },
      plan: "FREE",
    })
    transaction.mockImplementation(async (callback) =>
      callback({
        feed: {
          upsert: feedUpsert,
        },
        feedSubscription: {
          create: feedSubscriptionCreate,
        },
        folder: {
          create: folderCreate,
        },
      })
    )
  })

  it("creates the reader loader through React cache", () => {
    expect(reactCache).toHaveBeenCalledTimes(1)
    expect(reactCache).toHaveBeenCalledWith(expect.any(Function))
    expect(reactCache.mock.calls[0]?.[0].name).toBe(
      "listUserFeedSubscriptions"
    )
  })

  it("checks whether a reader has any subscriptions without loading nav rows", async () => {
    findFirst.mockResolvedValue({ id: "subscription-1" })

    await expect(hasUserFeedSubscriptions("user-1")).resolves.toBe(true)

    expect(findFirst).toHaveBeenCalledWith({
      select: { id: true },
      where: { userId: "user-1" },
    })
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
    expect(getUnreadArticleCountsByFeed).toHaveBeenCalledWith("user-1", [
      "feed-1",
    ])
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

  it("loads a large navigation with one grouped unread-count lookup", async () => {
    const subscriptions = Array.from({ length: 200 }, (_, index) => ({
      customTitle: null,
      feed: {
        faviconUrl: null,
        feedUrl: `https://example.com/feed-${index}.xml`,
        lastError: null,
        siteUrl: null,
        title: `Feed ${index}`,
      },
      feedId: `feed-${index}`,
      folder: null,
      folderId: null,
      id: `subscription-${index}`,
      isPaused: false,
    }))
    findMany.mockResolvedValue(subscriptions)
    getUnreadArticleCountsByFeed.mockResolvedValue(
      new Map(subscriptions.map((subscription) => [subscription.feedId, 1]))
    )

    const result = await listUserFeedSubscriptions("user-1")

    expect(result).toHaveLength(200)
    expect(result.every((subscription) => subscription.unreadCount === 1)).toBe(true)
    expect(getUnreadArticleCountsByFeed).toHaveBeenCalledTimes(1)
    expect(getUnreadArticleCountsByFeed).toHaveBeenCalledWith(
      "user-1",
      subscriptions.map((subscription) => subscription.feedId)
    )
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

  it("blocks free users from subscribing after 200 sources", async () => {
    discoverFeedFromUrl.mockResolvedValue({
      description: "Example feed.",
      faviconUrl: "https://example.com/favicon.ico",
      feedUrl: "https://example.com/feed.xml",
      format: "rss",
      language: "en",
      siteUrl: "https://example.com",
      title: "Example Feed",
    })
    findMany.mockResolvedValue([])
    userFindUnique.mockResolvedValue({
      _count: {
        podcastSubscriptions: 0,
        subscriptions: 200,
      },
      plan: "FREE",
    })

    await expect(
      subscribeToFeed({
        url: "https://example.com/feed.xml",
        userId: "user-1",
      })
    ).rejects.toThrow("Free accounts can subscribe to up to 200 sources.")

    expect(userFindUnique).toHaveBeenCalledWith({
      select: {
        _count: {
          select: {
            podcastSubscriptions: true,
            subscriptions: true,
          },
        },
        plan: true,
      },
      where: {
        id: "user-1",
      },
    })
    expect(folderCreate).not.toHaveBeenCalled()
    expect(feedUpsert).not.toHaveBeenCalled()
    expect(feedSubscriptionCreate).not.toHaveBeenCalled()
  })

  it("allows non-free users to subscribe beyond the free source cap", async () => {
    discoverFeedFromUrl.mockResolvedValue({
      description: "Example feed.",
      faviconUrl: "https://example.com/favicon.ico",
      feedUrl: "https://example.com/feed.xml",
      format: "rss",
      language: "en",
      siteUrl: "https://example.com",
      title: "Example Feed",
    })
    findMany.mockResolvedValue([])
    userFindUnique.mockResolvedValue({
      _count: {
        podcastSubscriptions: 0,
        subscriptions: 250,
      },
      plan: "PRO",
    })
    feedUpsert.mockResolvedValue({
      id: "feed-1",
      title: "Example Feed",
    })
    feedSubscriptionCreate.mockResolvedValue({
      feed: {
        title: "Example Feed",
      },
      id: "subscription-1",
    })

    await subscribeToFeed({
      url: "https://example.com/feed.xml",
      userId: "user-1",
    })

    expect(feedSubscriptionCreate).toHaveBeenCalledWith({
      data: {
        feedId: "feed-1",
        folderId: undefined,
        userId: "user-1",
      },
      include: {
        feed: true,
      },
    })
  })

  it("creates a named folder before subscribing when a new folder is requested", async () => {
    discoverFeedFromUrl.mockResolvedValue({
      description: "Example feed.",
      faviconUrl: "https://example.com/favicon.ico",
      feedUrl: "https://example.com/feed.xml",
      format: "rss",
      language: "en",
      siteUrl: "https://example.com",
      title: "Example Feed",
    })
    findMany.mockResolvedValue([])
    folderCreate.mockResolvedValue({
      id: "folder-new",
      name: "Tech Watch",
    })
    feedUpsert.mockResolvedValue({
      id: "feed-1",
      title: "Example Feed",
    })
    feedSubscriptionCreate.mockResolvedValue({
      feed: {
        title: "Example Feed",
      },
      id: "subscription-1",
    })

    await subscribeToFeed({
      folderName: "  Tech   Watch  ",
      url: "https://example.com/feed.xml",
      userId: "user-1",
    })

    expect(folderCreate).toHaveBeenCalledWith({
      data: {
        name: "Tech Watch",
        userId: "user-1",
      },
      select: {
        id: true,
        name: true,
      },
    })
    expect(feedSubscriptionCreate).toHaveBeenCalledWith({
      data: {
        feedId: "feed-1",
        folderId: "folder-new",
        userId: "user-1",
      },
      include: {
        feed: true,
      },
    })
  })

  it("rolls back a requested folder and feed when subscription creation fails", async () => {
    discoverFeedFromUrl.mockResolvedValue({
      description: "Example feed.",
      faviconUrl: "https://example.com/favicon.ico",
      feedUrl: "https://example.com/feed.xml",
      format: "rss",
      language: "en",
      siteUrl: "https://example.com",
      title: "Example Feed",
    })
    findMany.mockResolvedValue([])

    const committed = {
      feedUrls: [] as string[],
      folderNames: [] as string[],
    }
    const staged = {
      feedUrls: [] as string[],
      folderNames: [] as string[],
    }
    const transactionStore = {
      feed: {
        upsert: vi.fn(async () => {
          staged.feedUrls.push("https://example.com/feed.xml")
          return { id: "feed-1", title: "Example Feed" }
        }),
      },
      feedSubscription: {
        create: vi.fn(async () => {
          throw new Error("Injected subscription failure.")
        }),
      },
      folder: {
        create: vi.fn(async () => {
          staged.folderNames.push("Tech Watch")
          return { id: "folder-new", name: "Tech Watch" }
        }),
      },
    }

    folderCreate.mockImplementation(() => {
      throw new Error("Folder write escaped its transaction.")
    })
    feedUpsert.mockImplementation(() => {
      throw new Error("Feed write escaped its transaction.")
    })
    feedSubscriptionCreate.mockImplementation(() => {
      throw new Error("Subscription write escaped its transaction.")
    })
    transaction.mockImplementation(async (callback) => {
      const result = await callback(transactionStore)
      committed.feedUrls.push(...staged.feedUrls)
      committed.folderNames.push(...staged.folderNames)
      return result
    })

    await expect(
      subscribeToFeed({
        folderName: "Tech Watch",
        url: "https://example.com/feed.xml",
        userId: "user-1",
      })
    ).rejects.toThrow("Injected subscription failure.")

    expect(transaction).toHaveBeenCalledTimes(1)
    expect(transactionStore.folder.create).toHaveBeenCalledTimes(1)
    expect(transactionStore.feed.upsert).toHaveBeenCalledTimes(1)
    expect(transactionStore.feedSubscription.create).toHaveBeenCalledTimes(1)
    expect(committed).toEqual({ feedUrls: [], folderNames: [] })
  })

  it("imports articles from the feed XML fetched during discovery", async () => {
    discoverFeedFromUrl.mockResolvedValue({
      description: "Example feed.",
      faviconUrl: "https://example.com/favicon.ico",
      feedUrl: "https://example.com/feed.xml",
      feedXml: `<?xml version="1.0"?>
      <rss version="2.0">
        <channel>
          <title>Example Feed</title>
          <item>
            <guid>item-1</guid>
            <title>Already Fetched</title>
            <link>https://example.com/already-fetched</link>
            <description>Imported from the discovery response.</description>
          </item>
        </channel>
      </rss>`,
      format: "rss",
      language: "en",
      siteUrl: "https://example.com",
      title: "Example Feed",
    })
    findMany.mockResolvedValue([])
    feedUpsert.mockResolvedValue({
      id: "feed-1",
      title: "Example Feed",
    })
    feedFindUnique.mockResolvedValue({
      consecutiveFailures: 0,
      etag: null,
      feedUrl: "https://example.com/feed.xml",
      id: "feed-1",
      lastModified: null,
      refreshIntervalMinutes: 60,
    })
    feedSubscriptionCreate.mockResolvedValue({
      feed: {
        title: "Example Feed",
      },
      id: "subscription-1",
    })

    const subscription = await subscribeToFeed({
      url: "https://example.com/feed.xml",
      userId: "user-1",
    })

    expect(subscription).toMatchObject({
      id: "subscription-1",
      initialArticleCount: 1,
      sourceCountBeforeSubscribe: 0,
    })
    expect(articleCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          externalId: "item-1",
          feedId: "feed-1",
          title: "Already Fetched",
          url: "https://example.com/already-fetched",
        }),
      ],
      skipDuplicates: true,
    })
  })
})

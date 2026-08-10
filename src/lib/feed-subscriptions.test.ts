import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  articleDeleteMany,
  articleCreateMany,
  articleFindMany,
  articleUpdate,
  articleUpdateMany,
  articleStateDeleteMany,
  getUnreadArticleCountsByFeed,
  deleteMany,
  discoverFeedFromUrl,
  feedSubscriptionCreate,
  feedSubscriptionUpdateMany,
  folderCreate,
  feedDelete,
  feedFindUnique,
  feedUpdate,
  feedUpdateMany,
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
  articleUpdateMany: vi.fn(),
  articleStateDeleteMany: vi.fn(),
  getUnreadArticleCountsByFeed: vi.fn(),
  deleteMany: vi.fn(),
  discoverFeedFromUrl: vi.fn(),
  feedSubscriptionCreate: vi.fn(),
  feedSubscriptionUpdateMany: vi.fn(),
  folderCreate: vi.fn(),
  feedDelete: vi.fn(),
  feedFindUnique: vi.fn(),
  feedUpdate: vi.fn(),
  feedUpdateMany: vi.fn(),
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
      updateMany: articleUpdateMany,
    },
    articleState: {
      deleteMany: articleStateDeleteMany,
    },
    feed: {
      delete: feedDelete,
      findUnique: feedFindUnique,
      update: feedUpdate,
      updateMany: feedUpdateMany,
      upsert: feedUpsert,
    },
    feedSubscription: {
      create: feedSubscriptionCreate,
      deleteMany,
      findFirst,
      findMany,
      updateMany: feedSubscriptionUpdateMany,
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
  listUserFeedNavigation,
  listUserFeedSourceHygiene,
  listUserFeedSubscriptionUrls,
  markFeedSubscriptionAttentionReviewed,
  replaceFeedSubscription,
  setFeedSubscriptionPaused,
  subscribeToFeed,
  unsubscribeFromFeed,
} from "./feed-subscriptions"

describe("feed subscriptions", () => {
  beforeEach(() => {
    articleDeleteMany.mockReset()
    articleCreateMany.mockReset()
    articleFindMany.mockReset()
    articleUpdate.mockReset()
    articleUpdateMany.mockReset()
    articleStateDeleteMany.mockReset()
    getUnreadArticleCountsByFeed.mockReset()
    deleteMany.mockReset()
    discoverFeedFromUrl.mockReset()
    feedSubscriptionCreate.mockReset()
    feedSubscriptionUpdateMany.mockReset()
    folderCreate.mockReset()
    feedDelete.mockReset()
    feedFindUnique.mockReset()
    feedUpdate.mockReset()
    feedUpdateMany.mockReset()
    feedUpsert.mockReset()
    findFirst.mockReset()
    findMany.mockReset()
    folderFindFirst.mockReset()
    transaction.mockReset()
    userFindUnique.mockReset()
    getUnreadArticleCountsByFeed.mockResolvedValue(new Map([["feed-1", 3]]))
    feedUpdate.mockResolvedValue({})
    feedUpdateMany.mockImplementation(async ({ data }) => {
      const feed = await feedFindUnique({})
      if (!feed) {
        return { count: 0 }
      }

      const generation = data.refreshGeneration as { increment?: number } | undefined
      if (generation?.increment) {
        feed.refreshGeneration = (feed.refreshGeneration ?? 0) + generation.increment
      }
      if (data.refreshLeaseExpiresAt instanceof Date) {
        feed.refreshLeaseExpiresAt = data.refreshLeaseExpiresAt
      }
      if ("refreshOwner" in data) {
        feed.refreshOwner = data.refreshOwner
      }

      return { count: 1 }
    })
    articleCreateMany.mockResolvedValue({ count: 1 })
    articleFindMany.mockResolvedValue([])
    articleUpdate.mockResolvedValue({})
    articleUpdateMany.mockResolvedValue({ count: 1 })
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

  it("creates separate cached projections for navigation, source hygiene, and URLs", () => {
    expect(reactCache).toHaveBeenCalledTimes(3)
    expect(reactCache.mock.calls.map(([loader]) => loader.name)).toEqual([
      "listUserFeedSourceHygiene",
      "listUserFeedNavigation",
      "listUserFeedSubscriptionUrls",
    ])
  })

  it("checks whether a reader has any subscriptions without loading nav rows", async () => {
    findFirst.mockResolvedValue({ id: "subscription-1" })

    await expect(hasUserFeedSubscriptions("user-1")).resolves.toBe(true)

    expect(findFirst).toHaveBeenCalledWith({
      select: { id: true },
      where: { userId: "user-1" },
    })
  })

  it("loads rich source observations only for Source Hygiene", async () => {
    findMany.mockResolvedValue([
      {
        customTitle: null,
        feed: {
          faviconUrl: null,
          feedUrl: "https://example.com/feed.xml",
          lastFeedSelfUrl: null,
          lastError: null,
          lastPermanentRedirectUrl: null,
          lastRecoveredAt: null,
          lastResolvedFeedUrl: null,
          lastSuccessfulFetchAt: null,
          lastSourceUrlObservedAt: null,
          previousFeedSelfUrl: null,
          previousResolvedFeedUrl: null,
          siteUrl: "https://example.com",
          title: "Example Feed",
          _count: { subscriptions: 2 },
        },
        feedId: "feed-1",
        folder: {
          id: "folder-1",
          name: "Tech",
        },
        folderId: "folder-1",
        id: "subscription-1",
        isPaused: false,
        lastSourceAttentionReviewedAt: null,
        previousFeedUrl: null,
      },
    ])

    const subscriptions = await listUserFeedSourceHygiene("user-1")

    expect(findMany).toHaveBeenCalledWith({
      select: {
        customTitle: true,
        feed: {
          select: {
            faviconUrl: true,
            feedUrl: true,
            lastFeedSelfUrl: true,
            lastError: true,
            lastPermanentRedirectUrl: true,
            lastRecoveredAt: true,
            lastResolvedFeedUrl: true,
            lastSuccessfulFetchAt: true,
            lastSourceUrlObservedAt: true,
            previousFeedSelfUrl: true,
            previousResolvedFeedUrl: true,
            siteUrl: true,
            title: true,
            _count: {
              select: {
                subscriptions: true,
              },
            },
          },
        },
        feedId: true,
        folder: {
          select: {
            name: true,
          },
        },
        folderId: true,
        id: true,
        isPaused: true,
        lastSourceAttentionReviewedAt: true,
        previousFeedUrl: true,
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
        lastFeedSelfUrl: null,
        lastError: null,
        lastPermanentRedirectUrl: null,
        lastRecoveredAt: null,
        lastResolvedFeedUrl: null,
        lastSuccessfulFetchAt: null,
        lastSourceAttentionReviewedAt: null,
        lastSourceUrlObservedAt: null,
        previousFeedSelfUrl: null,
        previousFeedUrl: null,
        previousResolvedFeedUrl: null,
        siteUrl: "https://example.com",
        sourceSubscriberCount: 2,
        title: "Example Feed",
        unreadCount: 3,
      },
    ])
  })

  it("loads a large navigation with one grouped unread-count lookup and no source details", async () => {
    const subscriptions = Array.from({ length: 200 }, (_, index) => ({
      customTitle: null,
      feed: {
        faviconUrl: null,
        feedUrl: `https://example.com/feed-${index}.xml`,
        lastFeedSelfUrl: null,
        lastError: null,
        lastPermanentRedirectUrl: null,
        lastRecoveredAt: null,
        lastResolvedFeedUrl: null,
        lastSuccessfulFetchAt: null,
        lastSourceUrlObservedAt: null,
        previousFeedSelfUrl: null,
        previousResolvedFeedUrl: null,
        siteUrl: null,
        title: `Feed ${index}`,
        _count: { subscriptions: 1 },
      },
      feedId: `feed-${index}`,
      folder: null,
      folderId: null,
      id: `subscription-${index}`,
      isPaused: false,
      lastSourceAttentionReviewedAt: null,
      previousFeedUrl: null,
    }))
    findMany.mockResolvedValue(subscriptions)
    getUnreadArticleCountsByFeed.mockResolvedValue(
      new Map(subscriptions.map((subscription) => [subscription.feedId, 1]))
    )

    const result = await listUserFeedNavigation("user-1")

    expect(result).toHaveLength(200)
    expect(result.every((subscription) => subscription.unreadCount === 1)).toBe(true)
    expect(getUnreadArticleCountsByFeed).toHaveBeenCalledTimes(1)
    expect(getUnreadArticleCountsByFeed).toHaveBeenCalledWith(
      "user-1",
      subscriptions.map((subscription) => subscription.feedId)
    )
    expect(result[0]).toEqual({
      faviconUrl: null,
      feedId: "feed-0",
      folderId: null,
      id: "subscription-0",
      isPaused: false,
      needsAttention: false,
      title: "Feed 0",
      unreadCount: 1,
    })
    expect(findMany).toHaveBeenCalledWith({
      orderBy: [{ sortOrder: "asc" }, { subscribedAt: "desc" }],
      select: {
        customTitle: true,
        feed: {
          select: {
            faviconUrl: true,
            lastError: true,
            lastRecoveredAt: true,
            title: true,
          },
        },
        feedId: true,
        folderId: true,
        id: true,
        isPaused: true,
        lastSourceAttentionReviewedAt: true,
      },
      where: { userId: "user-1" },
    })
  })

  it("loads subscription URLs without shell or Source Hygiene fields", async () => {
    findMany.mockResolvedValue([
      { feed: { feedUrl: "https://example.com/first.xml" } },
      { feed: { feedUrl: "https://example.com/second.xml" } },
    ])

    await expect(listUserFeedSubscriptionUrls("user-1")).resolves.toEqual([
      "https://example.com/first.xml",
      "https://example.com/second.xml",
    ])

    expect(findMany).toHaveBeenCalledWith({
      select: { feed: { select: { feedUrl: true } } },
      where: { userId: "user-1" },
    })
  })

  it("pauses only the current user's selected feed subscription", async () => {
    feedSubscriptionUpdateMany.mockResolvedValue({ count: 1 })

    await expect(
      setFeedSubscriptionPaused({
        isPaused: true,
        subscriptionId: "subscription-1",
        userId: "user-1",
      })
    ).resolves.toEqual({ isPaused: true, subscriptionId: "subscription-1" })

    expect(feedSubscriptionUpdateMany).toHaveBeenCalledWith({
      data: { isPaused: true },
      where: {
        id: "subscription-1",
        userId: "user-1",
      },
    })
  })

  it("does not update a feed subscription outside the current user", async () => {
    feedSubscriptionUpdateMany.mockResolvedValue({ count: 0 })

    await expect(
      setFeedSubscriptionPaused({
        isPaused: false,
        subscriptionId: "subscription-other-user",
        userId: "user-1",
      })
    ).rejects.toThrow("That feed subscription was not found.")
  })

  it("marks only the current user's source recovery as reviewed", async () => {
    feedSubscriptionUpdateMany.mockResolvedValue({ count: 1 })

    await expect(
      markFeedSubscriptionAttentionReviewed({
        subscriptionId: "subscription-1",
        userId: "user-1",
      })
    ).resolves.toBeUndefined()

    expect(feedSubscriptionUpdateMany).toHaveBeenCalledWith({
      data: { lastSourceAttentionReviewedAt: expect.any(Date) },
      where: { id: "subscription-1", userId: "user-1" },
    })
  })

  it("replaces one owned subscription after safe discovery while preserving its subscription record", async () => {
    findFirst
      .mockResolvedValueOnce({
        customTitle: "My source title",
        feed: { feedUrl: "https://example.com/old.xml", title: "Old source" },
        feedId: "feed-old",
        id: "subscription-1",
      })
      .mockResolvedValueOnce(null)
    discoverFeedFromUrl.mockResolvedValue({
      description: "Verified replacement",
      faviconUrl: null,
      feedUrl: "https://feeds.example.com/new.xml",
      language: "en",
      siteUrl: "https://feeds.example.com",
      title: "New source",
    })
    feedUpsert.mockResolvedValue({ id: "feed-new", title: "New source" })
    feedSubscriptionUpdateMany.mockResolvedValue({ count: 1 })
    transaction.mockImplementation(async (callback) =>
      callback({
        feed: { upsert: feedUpsert },
        feedSubscription: { updateMany: feedSubscriptionUpdateMany },
      })
    )

    await expect(
      replaceFeedSubscription({
        candidateUrl: "https://feeds.example.com/new.xml",
        subscriptionId: "subscription-1",
        userId: "user-1",
      })
    ).resolves.toEqual({
      feedId: "feed-new",
      previousFeedUrl: "https://example.com/old.xml",
      title: "My source title",
    })

    expect(discoverFeedFromUrl).toHaveBeenCalledWith(
      "https://feeds.example.com/new.xml"
    )
    expect(feedSubscriptionUpdateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        feedId: "feed-new",
        previousFeedUrl: "https://example.com/old.xml",
        previousFeedUrlChangedAt: expect.any(Date),
      }),
      where: { id: "subscription-1", userId: "user-1" },
    })
  })

  it("refuses a replacement that is already subscribed by the reader", async () => {
    findFirst
      .mockResolvedValueOnce({
        customTitle: null,
        feed: { feedUrl: "https://example.com/old.xml", title: "Old source" },
        feedId: "feed-old",
        id: "subscription-1",
      })
      .mockResolvedValueOnce({
        customTitle: "Already here",
        feed: { title: "New source" },
        id: "subscription-2",
      })
    discoverFeedFromUrl.mockResolvedValue({ feedUrl: "https://feeds.example.com/new.xml" })

    await expect(
      replaceFeedSubscription({
        candidateUrl: "https://feeds.example.com/new.xml",
        subscriptionId: "subscription-1",
        userId: "user-1",
      })
    ).rejects.toThrow("You are already subscribed to Already here.")

    expect(transaction).not.toHaveBeenCalled()
  })

  it("unsubscribes only the current user's subscription", async () => {
    findFirst.mockResolvedValue({
      customTitle: "My Example Feed",
      feed: {
        title: "Example Feed",
      },
      folderId: "folder-1",
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
        folderId: true,
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
      folderId: "folder-1",
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
      folderId: null,
      id: "subscription-1",
    })
    deleteMany.mockResolvedValue({ count: 1 })

    await expect(
      unsubscribeFromFeed({
        subscriptionId: "subscription-1",
        userId: "user-1",
      })
    ).resolves.toEqual({
      folderId: null,
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
      folderId: null,
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
    expect(discoverFeedFromUrl).not.toHaveBeenCalled()
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

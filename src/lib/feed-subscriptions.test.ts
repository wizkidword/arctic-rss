import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  articleDeleteMany,
  articleStateDeleteMany,
  countUnreadArticlesForFeed,
  deleteMany,
  feedDelete,
  findFirst,
  findMany,
} = vi.hoisted(() => ({
  articleDeleteMany: vi.fn(),
  articleStateDeleteMany: vi.fn(),
  countUnreadArticlesForFeed: vi.fn(),
  deleteMany: vi.fn(),
  feedDelete: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
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
    },
    feedSubscription: {
      deleteMany,
      findFirst,
      findMany,
    },
  }),
}))

vi.mock("./articles", () => ({
  countUnreadArticlesForFeed,
}))

import {
  FeedSubscriptionError,
  listUserFeedSubscriptions,
  unsubscribeFromFeed,
} from "./feed-subscriptions"

describe("feed subscriptions", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    countUnreadArticlesForFeed.mockResolvedValue(3)
  })

  it("includes folder metadata for reader navigation", async () => {
    findMany.mockResolvedValue([
      {
        customTitle: null,
        feed: {
          faviconUrl: null,
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
})

import { describe, expect, it, vi } from "vitest"

const findMany = vi.fn()

vi.mock("./db", () => ({
  getPrisma: () => ({
    feedSubscription: {
      findMany,
    },
  }),
}))

vi.mock("./articles", () => ({
  countUnreadArticlesForFeed: vi.fn().mockResolvedValue(3),
}))

import { listUserFeedSubscriptions } from "./feed-subscriptions"

describe("feed subscriptions", () => {
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
})

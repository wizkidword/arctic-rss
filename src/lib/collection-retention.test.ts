import { describe, expect, it, vi } from "vitest"

const articleCollectionItemFindMany = vi.hoisted(() => vi.fn())

vi.mock("./db", () => ({
  getPrisma: () => ({
    articleCollectionItem: {
      findMany: articleCollectionItemFindMany,
    },
  }),
}))

import {
  CollectionRetentionError,
  getCollectionArticleSourceForUser,
  listCollectionArticleRetentionForUser,
} from "./collection-retention"

describe("collection retention", () => {
  it("loads save dates and follow status only from the reader-owned collection", async () => {
    const savedAt = new Date("2026-08-09T12:00:00.000Z")
    articleCollectionItemFindMany.mockResolvedValue([
      {
        article: {
          feed: {
            feedUrl: "https://example.com/feed.xml",
            subscriptions: [],
            title: "Example Source",
          },
        },
        articleId: "article-1",
        createdAt: savedAt,
      },
    ])

    await expect(
      listCollectionArticleRetentionForUser({
        articleIds: ["article-1", " article-1 ", ""],
        collectionId: "collection-1",
        userId: "user-1",
      })
    ).resolves.toEqual(
      new Map([
        [
          "article-1",
          {
            savedAt,
            sourceIsFollowed: false,
          },
        ],
      ])
    )

    expect(articleCollectionItemFindMany).toHaveBeenCalledWith({
      select: {
        article: {
          select: {
            feed: {
              select: {
                feedUrl: true,
                subscriptions: {
                  select: { id: true },
                  take: 1,
                  where: { userId: "user-1" },
                },
                title: true,
              },
            },
          },
        },
        articleId: true,
        createdAt: true,
      },
      where: {
        articleId: { in: ["article-1"] },
        collection: {
          id: "collection-1",
          userId: "user-1",
        },
      },
    })
  })

  it("does not query the database when no article IDs are supplied", async () => {
    articleCollectionItemFindMany.mockReset()

    await expect(
      listCollectionArticleRetentionForUser({
        articleIds: [],
        collectionId: "collection-1",
        userId: "user-1",
      })
    ).resolves.toEqual(new Map())

    expect(articleCollectionItemFindMany).not.toHaveBeenCalled()
  })

  it("returns a source only when the saved article belongs to the signed-in reader's collection", async () => {
    articleCollectionItemFindMany.mockResolvedValue([
      {
        article: {
          feed: {
            feedUrl: "https://example.com/feed.xml",
            subscriptions: [{ id: "subscription-1" }],
            title: "Example Source",
          },
        },
        articleId: "article-1",
        createdAt: new Date("2026-08-09T12:00:00.000Z"),
      },
    ])

    await expect(
      getCollectionArticleSourceForUser({
        articleId: "article-1",
        collectionId: "collection-1",
        userId: "user-1",
      })
    ).resolves.toEqual({
      feedUrl: "https://example.com/feed.xml",
      sourceIsFollowed: true,
      title: "Example Source",
    })
  })

  it("does not reveal a source when the ownership-filtered collection item is absent", async () => {
    articleCollectionItemFindMany.mockResolvedValue([])

    await expect(
      getCollectionArticleSourceForUser({
        articleId: "article-other",
        collectionId: "collection-other",
        userId: "user-1",
      })
    ).rejects.toEqual(
      new CollectionRetentionError("That saved collection article was not found.")
    )
  })
})

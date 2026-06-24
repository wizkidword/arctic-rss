import { describe, expect, it, vi } from "vitest"

import {
  markArticlesReadWithClient,
  sanitizeArticleHtml,
  setArticleReadStateWithClient,
  setArticleStarredStateWithClient,
} from "./articles"

function createStateStore({
  article = { id: "article-1" },
  articles = [{ id: "article-1" }, { id: "article-2" }],
}: {
  article?: { id: string } | null
  articles?: Array<{ id: string }>
} = {}) {
  return {
    article: {
      findFirst: vi.fn().mockResolvedValue(article),
      findMany: vi.fn().mockResolvedValue(articles),
    },
    articleState: {
      upsert: vi.fn().mockResolvedValue({}),
    },
  }
}

describe("article HTML sanitization", () => {
  it("keeps readable content while removing executable markup", () => {
    const html = sanitizeArticleHtml(`
      <article>
        <p onclick="steal()">Hello <strong>reader</strong>.</p>
        <script>alert("bad")</script>
        <a href="javascript:alert('bad')">bad link</a>
        <a href="https://example.com/read">safe link</a>
        <img src="https://example.com/image.jpg" onerror="steal()" />
      </article>
    `)

    expect(html).toContain("<strong>reader</strong>")
    expect(html).toContain('href="https://example.com/read"')
    expect(html).toContain('src="https://example.com/image.jpg"')
    expect(html).not.toContain("onclick")
    expect(html).not.toContain("onerror")
    expect(html).not.toContain("<script")
    expect(html).not.toContain("javascript:")
  })
})

describe("article state mutations", () => {
  it("marks an article read for the current user only", async () => {
    const store = createStateStore()
    const now = new Date("2026-06-22T13:00:00.000Z")

    await setArticleReadStateWithClient({
      articleId: "article-1",
      isRead: true,
      now: () => now,
      store,
      userId: "user-1",
    })

    expect(store.article.findFirst).toHaveBeenCalledWith({
      select: { id: true },
      where: {
        feed: {
          subscriptions: {
            some: {
              userId: "user-1",
            },
          },
        },
        id: "article-1",
      },
    })
    expect(store.articleState.upsert).toHaveBeenCalledWith({
      create: {
        articleId: "article-1",
        isRead: true,
        readAt: now,
        userId: "user-1",
      },
      update: {
        isRead: true,
        readAt: now,
      },
      where: {
        userId_articleId: {
          articleId: "article-1",
          userId: "user-1",
        },
      },
    })
  })

  it("unmarks read state without retaining a stale read timestamp", async () => {
    const store = createStateStore()

    await setArticleReadStateWithClient({
      articleId: "article-1",
      isRead: false,
      now: () => new Date("2026-06-22T13:00:00.000Z"),
      store,
      userId: "user-1",
    })

    expect(store.articleState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          isRead: false,
          readAt: null,
        }),
        update: {
          isRead: false,
          readAt: null,
        },
      })
    )
  })

  it("toggles starred state with per-user timestamps", async () => {
    const store = createStateStore()
    const now = new Date("2026-06-22T13:00:00.000Z")

    await setArticleStarredStateWithClient({
      articleId: "article-1",
      isStarred: true,
      now: () => now,
      store,
      userId: "user-1",
    })

    expect(store.articleState.upsert).toHaveBeenCalledWith({
      create: {
        articleId: "article-1",
        isStarred: true,
        starredAt: now,
        userId: "user-1",
      },
      update: {
        isStarred: true,
        starredAt: now,
      },
      where: {
        userId_articleId: {
          articleId: "article-1",
          userId: "user-1",
        },
      },
    })
  })

  it("marks every article in a feed read without crossing user boundaries", async () => {
    const store = createStateStore()
    const now = new Date("2026-06-22T13:00:00.000Z")

    const result = await markArticlesReadWithClient({
      now: () => now,
      scope: {
        feedId: "feed-1",
        type: "feed",
      },
      store,
      userId: "user-1",
    })

    expect(result).toEqual({ markedCount: 2 })
    expect(store.article.findMany).toHaveBeenCalledWith({
      select: { id: true },
      where: {
        feedId: "feed-1",
        feed: {
          subscriptions: {
            some: {
              userId: "user-1",
            },
          },
        },
      },
    })
    expect(store.articleState.upsert).toHaveBeenCalledTimes(2)
    expect(store.articleState.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          articleId: "article-2",
          isRead: true,
          readAt: now,
          userId: "user-1",
        }),
      })
    )
  })

  it("marks every article in a folder read without crossing user boundaries", async () => {
    const store = createStateStore()
    const now = new Date("2026-06-22T13:00:00.000Z")

    await markArticlesReadWithClient({
      now: () => now,
      scope: {
        folderId: "folder-1",
        type: "folder",
      },
      store,
      userId: "user-1",
    })

    expect(store.article.findMany).toHaveBeenCalledWith({
      select: { id: true },
      where: {
        feed: {
          subscriptions: {
            some: {
              folderId: "folder-1",
              isPaused: false,
              userId: "user-1",
            },
          },
        },
      },
    })
  })

  it("does not mutate state when the article is outside the current user subscriptions", async () => {
    const store = createStateStore({ article: null })

    await expect(
      setArticleReadStateWithClient({
        articleId: "article-1",
        isRead: true,
        store,
        userId: "user-1",
      })
    ).rejects.toThrow("Article not found.")

    expect(store.articleState.upsert).not.toHaveBeenCalled()
  })
})

import { describe, expect, it, vi } from "vitest"

import {
  deleteArticleForUserWithClient,
  listPublicReaderArticlesWithClient,
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
      createMany: vi.fn().mockResolvedValue({ count: articles.length }),
      updateMany: vi.fn().mockResolvedValue({ count: articles.length }),
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
    expect(html).toContain(
      'src="/api/image?url=https%3A%2F%2Fexample.com%2Fimage.jpg"'
    )
    expect(html).not.toContain("onclick")
    expect(html).not.toContain("onerror")
    expect(html).not.toContain("<script")
    expect(html).not.toContain("javascript:")
  })

  it("removes encoded scripts, unsafe embeds, styles, and malformed markup", () => {
    const html = sanitizeArticleHtml(`
      <p OnCliCk="steal()">Safe text</p>
      <a href="java&#x0A;script:alert(1)">unsafe URL</a>
      <svg><a href="javascript:alert(1)">svg payload</a></svg>
      <iframe src="https://attacker.example/embed"></iframe>
      <p style="background:url(javascript:alert(1))">styled text</p>
      <p><strong>Nested text</p></strong>
    `)

    expect(html).toContain("Safe text")
    expect(html).toContain("Nested text")
    expect(html).not.toMatch(/on\w+=/i)
    expect(html).not.toContain("javascript:")
    expect(html).not.toContain("<svg")
    expect(html).not.toContain("<iframe")
    expect(html).not.toContain("style=")
  })

  it("keeps article images private and removes declared tracking pixels", () => {
    const html = sanitizeArticleHtml(`
      <picture>
        <source srcset="https://example.com/image.webp" type="image/webp" />
        <img src="https://example.com/article.jpg" loading="eager" referrerpolicy="origin" alt="Article image" />
      </picture>
      <img src="https://tracker.example/pixel" width="1" height="1" alt="" />
      <img src="https://example.com/icon.png" width="16" height="16" alt="Source icon" />
    `)

    expect(html).toContain(
      'src="/api/image?url=https%3A%2F%2Fexample.com%2Farticle.jpg"'
    )
    expect(html).toContain('loading="lazy"')
    expect(html).toContain('referrerpolicy="no-referrer"')
    expect(html).toContain(
      'src="/api/image?url=https%3A%2F%2Fexample.com%2Ficon.png"'
    )
    expect(html).not.toContain("tracker.example")
    expect(html).not.toContain("<picture")
    expect(html).not.toContain("<source")
  })

  it("removes data URLs, MathML, and CSS-based payloads", () => {
    const html = sanitizeArticleHtml(`
      <math><mtext>unsafe math payload</mtext></math>
      <img src="data:image/svg+xml,&lt;svg onload=alert(1)&gt;" />
      <a href="data:text/html,&lt;script&gt;alert(1)&lt;/script&gt;">bad link</a>
      <p style="background-image:url(https://tracker.example/pixel)">Visible text</p>
    `)

    expect(html).toContain("Visible text")
    expect(html).not.toContain("data:")
    expect(html).not.toContain("<math")
    expect(html).not.toContain("style=")
    expect(html).not.toContain("tracker.example")
  })
})

describe("public article previews", () => {
  it("loads guest previews only from public Discover feed URLs", async () => {
    const store = {
      article: {
        findMany: vi.fn().mockResolvedValue([
          createArticleRecord({
            id: "article-public",
            title: "Public preview",
          }),
        ]),
      },
    }

    const articles = await listPublicReaderArticlesWithClient({
      limit: 12,
      publicFeedUrls: [
        "https://feeds.example.com/public.xml",
        "https://feeds.example.com/public-legacy.xml",
      ],
      store,
    })

    expect(store.article.findMany).toHaveBeenCalledWith({
      include: expect.objectContaining({
        feed: expect.any(Object),
        states: expect.objectContaining({
          where: { userId: "__public_guest_preview__" },
        }),
      }),
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: 12,
      where: {
        feed: {
          feedUrl: {
            in: [
              "https://feeds.example.com/public.xml",
              "https://feeds.example.com/public-legacy.xml",
            ],
          },
        },
      },
    })
    expect(articles).toHaveLength(1)
    expect(articles[0]).toMatchObject({
      id: "article-public",
      isRead: false,
      isStarred: false,
      title: "Public preview",
    })
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

  it("deletes an article from the current user's reader without removing it globally", async () => {
    const store = createStateStore()
    const now = new Date("2026-07-03T14:15:00.000Z")

    await deleteArticleForUserWithClient({
      articleId: "article-1",
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
        archivedAt: now,
        articleId: "article-1",
        isRead: true,
        readAt: now,
        userId: "user-1",
      },
      update: {
        archivedAt: now,
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
    expect(store.articleState.createMany).toHaveBeenCalledWith({
      data: [
        {
          articleId: "article-1",
          isRead: true,
          readAt: now,
          userId: "user-1",
        },
        {
          articleId: "article-2",
          isRead: true,
          readAt: now,
          userId: "user-1",
        },
      ],
      skipDuplicates: true,
    })
    expect(store.articleState.updateMany).toHaveBeenCalledWith({
      data: {
        isRead: true,
        readAt: now,
      },
      where: {
        articleId: {
          in: ["article-1", "article-2"],
        },
        userId: "user-1",
      },
    })
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

function createArticleRecord({
  id,
  title,
}: {
  id: string
  title: string
}) {
  return {
    aiSummaries: [],
    author: null,
    contentHtml: null,
    contentText: "Readable public body",
    feed: {
      faviconUrl: null,
      id: "feed-public",
      title: "Public Feed",
    },
    feedId: "feed-public",
    id,
    imageUrl: null,
    publishedAt: new Date("2026-07-02T14:00:00.000Z"),
    states: [],
    summary: "Public summary",
    title,
    url: "https://example.com/public-preview",
  }
}

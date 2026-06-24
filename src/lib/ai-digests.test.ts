import { describe, expect, it, vi } from "vitest"

import {
  AiDigestError,
  createLocalDigestProvider,
  createOpenAiDigestProvider,
  getAiDigestWithClient,
  processAiDigestWithClient,
  requestAiDigestWithClient,
  type AiDigestStore,
} from "./ai-digests"

function createStore(): AiDigestStore {
  const store = {
    $transaction: vi.fn(),
    aiDigest: {
      create: vi.fn().mockResolvedValue({
        id: "digest-1",
        status: "PENDING",
      }),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue({
        id: "digest-1",
        status: "PENDING",
        user: {
          aiMonthlyLimit: 100,
          aiMonthlyUsed: 4,
          id: "user-1",
        },
        userId: "user-1",
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    aiDigestItem: {
      createMany: vi.fn().mockResolvedValue({ count: 2 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    aiUsageLog: {
      create: vi.fn().mockResolvedValue({}),
    },
    article: {
      count: vi.fn().mockResolvedValue(2),
      findMany: vi.fn().mockResolvedValue([
        {
          aiSummaries: [
            {
              category: "Technology",
              shortSummary: "A cached AI summary.",
            },
          ],
          contentText: "Article body one.",
          feed: {
            subscriptions: [
              {
                folder: {
                  name: "Engineering",
                },
              },
            ],
            title: "Example Feed",
          },
          id: "article-1",
          publishedAt: new Date("2026-06-23T10:00:00.000Z"),
          summary: "Feed summary one.",
          title: "Top story",
          url: "https://example.com/top",
        },
        {
          aiSummaries: [],
          contentText: "Article body two.",
          feed: {
            subscriptions: [
              {
                folder: null,
              },
            ],
            title: "Second Feed",
          },
          id: "article-2",
          publishedAt: new Date("2026-06-23T09:00:00.000Z"),
          summary: "Feed summary two.",
          title: "Second story",
          url: "https://example.com/second",
        },
      ]),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({
        aiMonthlyLimit: 100,
        aiMonthlyUsed: 4,
      }),
      update: vi.fn().mockResolvedValue({}),
    },
  } satisfies Omit<AiDigestStore, "$transaction"> & {
    $transaction: ReturnType<typeof vi.fn>
  }

  store.$transaction.mockImplementation(
    async (callback: (transaction: AiDigestStore) => Promise<unknown>) =>
      callback(store as AiDigestStore)
  )

  return store as AiDigestStore
}

describe("AI digest provider", () => {
  it("creates deterministic must-read and skim-later sections", async () => {
    const provider = createLocalDigestProvider()
    const result = await provider.generate({
      articles: Array.from({ length: 7 }, (_, index) => ({
        aiSummary: index === 5 ? "Cached summary" : null,
        articleId: `article-${index + 1}`,
        category: index === 5 ? "AI" : null,
        feedTitle: "Example Feed",
        folderName: index === 0 ? "Engineering" : null,
        publishedAt: new Date(
          `2026-06-23T${String(12 - index).padStart(2, "0")}:00:00.000Z`
        ),
        summary: `Summary ${index + 1}`,
        title: `Story ${index + 1}`,
        url: `https://example.com/${index + 1}`,
      })),
      generatedAt: new Date("2026-06-23T13:00:00.000Z"),
    })

    expect(result.title).toBe("Arctic digest - 2026-06-23")
    expect(result.items).toHaveLength(7)
    expect(result.items.slice(0, 5).every((item) => item.section === "MUST_READ")).toBe(
      true
    )
    expect(result.items.slice(5).every((item) => item.section === "SKIM_LATER")).toBe(
      true
    )
    expect(result.items[0]).toMatchObject({
      articleId: "article-6",
      summary: "Cached summary",
      topic: "AI",
    })
  })

  it("parses structured OpenAI digest output through the provider contract", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            items: [
              {
                articleId: "article-1",
                reason: "Most relevant.",
                section: "MUST_READ",
                summary: "A concise digest summary.",
                topic: "Technology",
              },
            ],
            overview: "One important story.",
            title: "Morning digest",
          }),
          usage: {
            input_tokens: 120,
            output_tokens: 40,
          },
        }),
        {
          headers: {
            "Content-Type": "application/json",
          },
          status: 200,
        }
      )
    )
    const provider = createOpenAiDigestProvider({
      apiKey: "test-key",
      fetcher,
      model: "gpt-test",
    })

    const result = await provider.generate({
      articles: [
        {
          aiSummary: null,
          articleId: "article-1",
          category: null,
          feedTitle: "Example Feed",
          folderName: null,
          publishedAt: new Date("2026-06-23T12:00:00.000Z"),
          summary: "Article source summary.",
          title: "Top story",
          url: "https://example.com/top",
        },
      ],
      generatedAt: new Date("2026-06-23T13:00:00.000Z"),
    })

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.openai.com/v1/responses",
      expect.objectContaining({
        method: "POST",
      })
    )
    expect(result).toEqual({
      inputTokens: 120,
      items: [
        {
          articleId: "article-1",
          reason: "Most relevant.",
          section: "MUST_READ",
          summary: "A concise digest summary.",
          topic: "Technology",
        },
      ],
      outputTokens: 40,
      overview: "One important story.",
      title: "Morning digest",
    })
  })
})

describe("AI digest requests", () => {
  it("returns an existing active digest instead of creating a duplicate", async () => {
    const store = createStore()
    vi.mocked(store.aiDigest.findFirst).mockResolvedValue({
      id: "digest-active",
      status: "PROCESSING",
    })

    const result = await requestAiDigestWithClient({
      store,
      userId: "user-1",
    })

    expect(result).toEqual({
      digestId: "digest-active",
      existing: true,
      status: "PROCESSING",
    })
    expect(store.aiDigest.create).not.toHaveBeenCalled()
  })

  it("creates a pending digest when unread articles and usage remain", async () => {
    const store = createStore()

    const result = await requestAiDigestWithClient({
      store,
      userId: "user-1",
    })

    expect(store.article.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        feed: {
          subscriptions: {
            some: {
              isPaused: false,
              userId: "user-1",
            },
          },
        },
        states: {
          none: {
            isRead: true,
            userId: "user-1",
          },
        },
      }),
    })
    expect(result).toEqual({
      digestId: "digest-1",
      existing: false,
      status: "PENDING",
    })
  })

  it("rejects a request after the monthly limit is reached", async () => {
    const store = createStore()
    vi.mocked(store.user.findUnique).mockResolvedValue({
      aiMonthlyLimit: 4,
      aiMonthlyUsed: 4,
    })

    await expect(
      requestAiDigestWithClient({
        store,
        userId: "user-1",
      })
    ).rejects.toThrow("AI monthly limit reached.")
    expect(store.aiDigest.create).not.toHaveBeenCalled()
  })
})

describe("AI digest processing", () => {
  it("stores generated items and records one usage unit", async () => {
    const store = createStore()
    const provider = createLocalDigestProvider()

    const result = await processAiDigestWithClient({
      digestId: "digest-1",
      now: () => new Date("2026-06-23T13:00:00.000Z"),
      provider,
      store,
    })

    expect(store.article.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        take: 20,
        where: expect.objectContaining({
          states: {
            none: {
              isRead: true,
              userId: "user-1",
            },
          },
        }),
      })
    )
    expect(store.aiDigestItem.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          articleId: "article-1",
          digestId: "digest-1",
          section: "MUST_READ",
        }),
      ]),
    })
    expect(store.aiUsageLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "DAILY_DIGEST",
        userId: "user-1",
      }),
    })
    expect(store.user.update).toHaveBeenCalledWith({
      data: {
        aiMonthlyUsed: {
          increment: 1,
        },
      },
      where: {
        id: "user-1",
      },
    })
    expect(result).toEqual({
      articleCount: 2,
      digestId: "digest-1",
      status: "COMPLETED",
    })
  })

  it("stores a sanitized failure message when the provider fails", async () => {
    const store = createStore()
    const provider = {
      generate: vi
        .fn()
        .mockRejectedValue(
          new Error(`Provider failed with secret ${"x".repeat(700)}`)
        ),
      model: "broken-model",
      name: "broken",
    }

    await expect(
      processAiDigestWithClient({
        digestId: "digest-1",
        provider,
        store,
      })
    ).rejects.toBeInstanceOf(AiDigestError)

    expect(store.aiDigest.update).toHaveBeenLastCalledWith({
      data: {
        errorMessage: expect.stringMatching(/^Digest generation failed\./),
        status: "FAILED",
      },
      where: {
        id: "digest-1",
      },
    })
    expect(store.user.update).not.toHaveBeenCalled()
  })
})

describe("AI digest lookup", () => {
  it("scopes digest detail to the owning user", async () => {
    const store = createStore()
    vi.mocked(store.aiDigest.findFirst).mockResolvedValue({
      articleCount: 2,
      completedAt: new Date("2026-06-23T13:05:00.000Z"),
      createdAt: new Date("2026-06-23T13:00:00.000Z"),
      id: "digest-1",
      items: [],
      model: "local-digest-v1",
      overview: "Two unread stories.",
      provider: "local",
      status: "COMPLETED",
      title: "Arctic digest - 2026-06-23",
      userId: "user-1",
    })

    const digest = await getAiDigestWithClient({
      digestId: "digest-1",
      store,
      userId: "user-1",
    })

    expect(store.aiDigest.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "digest-1",
          userId: "user-1",
        },
      })
    )
    expect(digest?.id).toBe("digest-1")
  })
})

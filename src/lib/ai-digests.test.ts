import { describe, expect, it, vi } from "vitest"

import {
  AiDigestError,
  aiDigestPeriodStart,
  createLocalDigestProvider,
  createOpenAiDigestProvider,
  getAiDigestProvider,
  getAiDigestWithClient,
  processAiDigestWithClient,
  requestAiDigestWithClient,
  type AiDigestProvider,
  type AiDigestStore,
} from "./ai-digests"

describe("AI digest provider configuration", () => {
  it("defaults OpenAI digests to GPT-5.4 Mini", () => {
    vi.stubEnv("AI_PROVIDER", "openai")
    vi.stubEnv("OPENAI_API_KEY", "test-key")

    try {
      expect(getAiDigestProvider().model).toBe("gpt-5.4-mini")
    } finally {
      vi.unstubAllEnvs()
    }
  })
})

function createStore(): AiDigestStore {
  const operations = new Map<string, Record<string, unknown>>()
  let period: {
    consumedUnits: number
    id: string
    limitUnits: number
    reservedUnits: number
  } | null = null
  const store = {
    $queryRaw: vi.fn(
      async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const query = strings.join("?")

        if (query.includes('INSERT INTO "AiUsagePeriod"')) {
          const periodId = values[0] as string
          const limit = values[3] as number

          if (!period) {
            if (limit < 1) {
              return []
            }

            period = {
              consumedUnits: 0,
              id: periodId,
              limitUnits: limit,
              reservedUnits: 1,
            }
            return [{ id: period.id }]
          }

          if (
            period.reservedUnits + period.consumedUnits >=
            period.limitUnits
          ) {
            return []
          }

          period.reservedUnits += 1
          return [{ id: period.id }]
        }

        if (query.includes("operation_to_release")) {
          const operation = Array.from(operations.values()).find(
            (candidate) => candidate.id === values[0],
          )

          if (
            !operation ||
            (operation.status !== "RESERVED" &&
              operation.status !== "PROCESSING")
          ) {
            return []
          }

          const released = {
            periodId: operation.periodId as string | null,
            reservedUnits: operation.reservedUnits as number,
          }
          operation.errorCode = values[1]
          operation.reservedUnits = 0
          operation.status = "FAILED"
          return [released]
        }

        if (query.includes('UPDATE "AiUsagePeriod"')) {
          if (!period) {
            return []
          }

          if (query.includes('"consumedUnits"')) {
            period.reservedUnits -= values[1] as number
            period.consumedUnits += 1
          } else {
            period.reservedUnits = Math.max(
              0,
              period.reservedUnits - (values[1] as number),
            )
          }

          return [{ id: period.id }]
        }

        return []
      },
    ),
    $transaction: vi.fn(),
    aiDigest: {
      create: vi.fn().mockResolvedValue({
        id: "digest-1",
        status: "PENDING",
      }),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue({
        createdAt: new Date("2026-06-23T13:00:00.000Z"),
        id: "digest-1",
        period: "DAILY",
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
    aiOperation: {
      create: vi.fn(async ({ data }) => {
        if (operations.has(data.idempotencyKey)) {
          throw { code: "P2002" }
        }

        const operation = {
          ...data,
          attempt: 0,
          completedAt: null,
          consumedUnits: 0,
          errorCode: null,
          id: `operation-${operations.size + 1}`,
          lastHeartbeatAt: null,
          leaseExpiresAt: null,
          leaseOwner: null,
          periodId: null,
          providerRequestId: null,
          retryableAt: null,
        }
        operations.set(data.idempotencyKey, operation)
        return operation
      }),
      findUnique: vi.fn(async ({ where }) => {
        return (
          Array.from(operations.values()).find(
            (operation) =>
              operation.id === where.id ||
              operation.idempotencyKey === where.idempotencyKey,
          ) ?? null
        )
      }),
      update: vi.fn(async ({ data, where }) => {
        const operation = Array.from(operations.values()).find(
          (candidate) => candidate.id === where.id,
        )

        if (!operation) {
          throw new Error("Operation not found")
        }

        Object.assign(operation, data)
        return operation
      }),
      updateMany: vi.fn(async ({ data, where }) => {
        const operation = Array.from(operations.values()).find(
          (candidate) => candidate.id === where.id,
        )

        if (!operation || !matchesOperation(operation, where)) {
          return { count: 0 }
        }

        applyOperationData(operation, data)
        return { count: 1 }
      }),
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
  }

  store.$transaction.mockImplementation(
    async (callback: (transaction: AiDigestStore) => Promise<unknown>) =>
      callback(store as unknown as AiDigestStore),
  )

  return store as unknown as AiDigestStore
}

function matchesOperation(
  operation: Record<string, unknown>,
  where: Record<string, unknown>,
): boolean {
  if (where.leaseOwner && operation.leaseOwner !== where.leaseOwner) {
    return false
  }

  if (typeof where.attempt === "number" && operation.attempt !== where.attempt) {
    return false
  }

  if (typeof where.status === "string" && operation.status !== where.status) {
    return false
  }

  if (
    where.leaseExpiresAt &&
    typeof where.leaseExpiresAt === "object" &&
    "gt" in where.leaseExpiresAt
  ) {
    const expected = where.leaseExpiresAt.gt
    return operation.leaseExpiresAt instanceof Date &&
      expected instanceof Date &&
      operation.leaseExpiresAt > expected
  }

  return true
}

function applyOperationData(
  operation: Record<string, unknown>,
  data: Record<string, unknown>,
) {
  for (const [key, value] of Object.entries(data)) {
    if (
      value &&
      typeof value === "object" &&
      "increment" in value &&
      typeof value.increment === "number"
    ) {
      operation[key] = ((operation[key] as number) ?? 0) + value.increment
    } else {
      operation[key] = value
    }
  }
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
          `2026-06-23T${String(12 - index).padStart(2, "0")}:00:00.000Z`,
        ),
        summary: `Summary ${index + 1}`,
        title: `Story ${index + 1}`,
        url: `https://example.com/${index + 1}`,
      })),
      generatedAt: new Date("2026-06-23T13:00:00.000Z"),
      period: "DAILY",
    })

    expect(result.title).toBe("What matters today - 2026-06-23")
    expect(result.items).toHaveLength(7)
    expect(
      result.items.slice(0, 5).every((item) => item.section === "MUST_READ"),
    ).toBe(true)
    expect(
      result.items.slice(5).every((item) => item.section === "SKIM_LATER"),
    ).toBe(true)
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
        },
      ),
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
      period: "WEEKLY",
    })

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.openai.com/v1/responses",
      expect.objectContaining({ method: "POST" }),
    )
    const request = fetcher.mock.calls[0]?.[1]
    const body = JSON.parse(String(request?.body))
    expect(request?.signal).toBeInstanceOf(AbortSignal)
    expect(body.max_output_tokens).toBe(4000)
    expect(body.input[0].content).toContain("untrusted publisher data")
    expect(body.input[1].content).toContain('"briefingPeriod":"WEEKLY"')
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
      providerRequestId: null,
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
    const requestedAt = new Date("2026-06-23T13:00:00.000Z")

    const result = await requestAiDigestWithClient({
      now: () => requestedAt,
      store,
      userId: "user-1",
    })

    expect(store.article.count).toHaveBeenCalledWith({
      where: {
        AND: expect.arrayContaining([
          expect.objectContaining({
            feed: {
              subscriptions: {
                some: {
                  isPaused: false,
                  userId: "user-1",
                },
              },
            },
          }),
          expect.objectContaining({
            OR: expect.arrayContaining([
              {
                publishedAt: {
                  gte: new Date("2026-06-22T13:00:00.000Z"),
                },
              },
            ]),
          }),
        ]),
      },
    })
    expect(store.aiDigest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          period: "DAILY",
          status: "PENDING",
          userId: "user-1",
        },
      }),
    )
    expect(result).toEqual({
      digestId: "digest-1",
      existing: false,
      status: "PENDING",
    })
  })

  it("uses a seven-day window for a weekly briefing", () => {
    expect(
      aiDigestPeriodStart({
        now: new Date("2026-06-23T13:00:00.000Z"),
        period: "WEEKLY",
      }),
    ).toEqual(new Date("2026-06-16T13:00:00.000Z"))
  })

  it("does not consume allowance until the worker is ready to call a provider", async () => {
    const store = createStore()
    vi.mocked(store.user.findUnique).mockResolvedValue({
      aiMonthlyLimit: 0,
      aiMonthlyUsed: 0,
    })

    await expect(
      requestAiDigestWithClient({ store, userId: "user-1" }),
    ).resolves.toEqual({
      digestId: "digest-1",
      existing: false,
      status: "PENDING",
    })
  })
})

describe("AI digest processing", () => {
  it("rejects a provider call when no monthly allowance can be reserved", async () => {
    const store = createStore()
    vi.mocked(store.user.findUnique).mockResolvedValue({
      aiMonthlyLimit: 0,
      aiMonthlyUsed: 0,
    })
    const provider: AiDigestProvider = {
      generate: vi.fn(),
      model: "local-digest-v1",
      name: "local",
    }

    await expect(
      processAiDigestWithClient({
        digestId: "digest-1",
        provider,
        store,
      }),
    ).rejects.toThrow("AI monthly limit reached.")

    expect(provider.generate).not.toHaveBeenCalled()
  })

  it("stores generated items and records one usage unit", async () => {
    const store = createStore()
    vi.mocked(store.aiDigest.findUnique).mockResolvedValue({
      createdAt: new Date("2026-06-23T13:00:00.000Z"),
      id: "digest-1",
      period: "WEEKLY",
      status: "PENDING",
      userId: "user-1",
    })
    const provider: AiDigestProvider = {
      generate: vi.fn().mockResolvedValue({
        inputTokens: 1_000,
        items: [
          {
            articleId: "article-1",
            reason: "Most relevant.",
            section: "MUST_READ",
            summary: "A concise digest summary.",
            topic: "Technology",
          },
          {
            articleId: "article-2",
            reason: "Worth skimming.",
            section: "SKIM_LATER",
            summary: "A second digest summary.",
            topic: "Product",
          },
        ],
        outputTokens: 200,
        overview: "Two important stories.",
        title: "Morning digest",
      }),
      model: "gpt-5.4-nano",
      name: "openai",
    }

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
          AND: expect.arrayContaining([
            expect.objectContaining({
              states: {
                none: {
                  isRead: true,
                  userId: "user-1",
                },
              },
            }),
            expect.objectContaining({
              OR: expect.arrayContaining([
                {
                  publishedAt: {
                    gte: new Date("2026-06-16T13:00:00.000Z"),
                  },
                },
              ]),
            }),
          ]),
        }),
      }),
    )
    expect(provider.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        period: "WEEKLY",
      }),
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
        costEstimate: 0.00045,
        inputTokens: 1_000,
        model: "gpt-5.4-nano",
        outputTokens: 200,
        provider: "openai",
        userId: "user-1",
      }),
    })
    expect(store.user.update).not.toHaveBeenCalled()
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
          new Error(`Provider failed with secret ${"x".repeat(700)}`),
        ),
      model: "broken-model",
      name: "broken",
    }

    await expect(
      processAiDigestWithClient({
        digestId: "digest-1",
        provider,
        store,
      }),
    ).rejects.toBeInstanceOf(AiDigestError)

    expect(store.aiDigest.update).toHaveBeenLastCalledWith({
      data: {
        errorMessage: expect.stringMatching(/^Briefing generation failed\./),
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
      period: "DAILY",
      provider: "local",
      status: "COMPLETED",
      title: "What matters today - 2026-06-23",
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
      }),
    )
    expect(digest?.id).toBe("digest-1")
  })
})

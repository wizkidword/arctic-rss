import { describe, expect, it, vi } from "vitest"

import { SmartDigestError } from "./smart-digests"
import {
  processSmartDigestRuleWithClient,
  smartDigestCandidateWhere,
  type SmartDigestProcessingStore,
  type SmartDigestRuleForProcessing,
} from "./smart-digest-processing"

const now = new Date("2026-06-30T12:00:00.000Z")

describe("smart digest candidate filters", () => {
  it("limits all-feed candidates to unpaused subscriptions for the rule user", () => {
    expect(smartDigestCandidateWhere(baseRule({ sourceScope: "ALL_FEEDS" }))).toEqual({
      feed: {
        subscriptions: {
          some: {
            isPaused: false,
            userId: "user-1",
          },
        },
      },
    })
  })

  it("limits folder candidates to selected folders, rule user, and unpaused subscriptions", () => {
    expect(
      smartDigestCandidateWhere(
        baseRule({
          folders: [{ folderId: "folder-1" }, { folderId: "folder-2" }],
          sourceScope: "FOLDERS",
        })
      )
    ).toEqual({
      feed: {
        subscriptions: {
          some: {
            folderId: { in: ["folder-1", "folder-2"] },
            isPaused: false,
            userId: "user-1",
          },
        },
      },
    })
  })

  it("limits feed candidates to selected subscriptions, rule user, and unpaused subscriptions", () => {
    expect(
      smartDigestCandidateWhere(
        baseRule({
          sourceScope: "FEEDS",
          subscriptions: [
            { subscriptionId: "sub-1" },
            { subscriptionId: "sub-2" },
          ],
        })
      )
    ).toEqual({
      feed: {
        subscriptions: {
          some: {
            id: { in: ["sub-1", "sub-2"] },
            isPaused: false,
            userId: "user-1",
          },
        },
      },
    })
  })
})

describe("smart digest processing", () => {
  it("creates a completed digest with matching articles", async () => {
    const store = createStore({
      articles: [
        article({
          id: "article-1",
          summary: "A climate update from the north.",
          title: "Arctic climate report",
        }),
        article({
          id: "article-2",
          title: "Unrelated market report",
        }),
      ],
    })

    await expect(
      processSmartDigestRuleWithClient({
        now,
        ruleId: "rule-1",
        sendDigestEmail: vi.fn(),
        store,
      })
    ).resolves.toEqual({
      articleCount: 1,
      digestId: "digest-1",
      status: "COMPLETED",
    })

    expect(store.article.findMany).toHaveBeenCalledWith({
      include: { feed: true },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: 100,
      where: smartDigestCandidateWhere(baseRule()),
    })
    expect(store.smartDigest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        articleCount: 1,
        emailStatus: "PENDING",
        items: {
          create: [
            expect.objectContaining({
              articleId: "article-1",
              articleTitle: "Arctic climate report",
              articleUrl: "https://example.test/article-1",
              feedTitle: "North Feed",
              matchedFields: ["title", "summary"],
              matchedTerms: ["climate"],
              position: 1,
            }),
          ],
        },
        status: "COMPLETED",
      }),
      include: { items: true },
    })
    expect(store.smartDigestRule.update).toHaveBeenCalledWith({
      data: {
        lastMatchedAt: now,
        lastRunAt: now,
        nextRunAt: new Date("2026-07-01T08:00:00.000Z"),
      },
      where: { id: "rule-1" },
    })
  })

  it("creates a completed no-match digest without sending email or changing lastMatchedAt", async () => {
    const sendDigestEmail = vi.fn()
    const store = createStore({
      articles: [article({ title: "Unrelated market report" })],
      rule: baseRule({ lastMatchedAt: new Date("2026-06-20T12:00:00.000Z") }),
    })

    await expect(
      processSmartDigestRuleWithClient({
        now,
        ruleId: "rule-1",
        sendDigestEmail,
        store,
      })
    ).resolves.toEqual({
      articleCount: 0,
      digestId: "digest-1",
      status: "COMPLETED_NO_MATCHES",
    })

    expect(sendDigestEmail).not.toHaveBeenCalled()
    expect(store.smartDigest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        articleCount: 0,
        emailStatus: "NOT_REQUESTED",
        items: { create: [] },
        status: "COMPLETED_NO_MATCHES",
      }),
      include: { items: true },
    })
    expect(store.smartDigestRule.update).toHaveBeenCalledWith({
      data: {
        lastRunAt: now,
        nextRunAt: new Date("2026-07-01T08:00:00.000Z"),
      },
      where: { id: "rule-1" },
    })
  })

  it("updates email status when delivery succeeds", async () => {
    const sendDigestEmail = vi.fn().mockResolvedValue(undefined)
    const store = createStore({
      articles: [
        article({
          id: "article-1",
          publishedAt: new Date("2026-06-30T10:00:00.000Z"),
          summary: "A climate update.",
          title: "Climate update",
        }),
        article({
          id: "article-2",
          publishedAt: new Date("2026-06-30T09:00:00.000Z"),
          summary: "A climate analysis.",
          title: "Climate analysis",
        }),
      ],
      reverseDigestItems: true,
    })

    await processSmartDigestRuleWithClient({
      now,
      ruleId: "rule-1",
      sendDigestEmail,
      store,
    })

    expect(sendDigestEmail).toHaveBeenCalledWith({
      digest: {
        articleCount: 2,
        id: "digest-1",
        items: [
          expect.objectContaining({
            articleTitle: "Climate update",
            articleUrl: "https://example.test/article-1",
            feedTitle: "North Feed",
            matchedTerms: ["climate"],
            publishedAt: new Date("2026-06-30T10:00:00.000Z"),
            reason: expect.stringContaining('"climate"'),
            summary: "A climate update.",
          }),
          expect.objectContaining({
            articleTitle: "Climate analysis",
            articleUrl: "https://example.test/article-2",
            feedTitle: "North Feed",
            matchedTerms: ["climate"],
            publishedAt: new Date("2026-06-30T09:00:00.000Z"),
            reason: expect.stringContaining('"climate"'),
            summary: "A climate analysis.",
          }),
        ],
        title: "Climate Digest",
        topicPrompt: "Climate news",
      },
      to: "reader@example.test",
    })
    expect(store.smartDigest.update).toHaveBeenCalledWith({
      data: {
        emailedAt: now,
        emailStatus: "SENT",
      },
      where: { id: "digest-1" },
    })
  })

  it("updates email status when delivery fails but returns the digest result", async () => {
    const sendDigestEmail = vi.fn().mockRejectedValue(new Error("SMTP unavailable"))
    const store = createStore({
      articles: [article({ title: "Climate update" })],
    })

    await expect(
      processSmartDigestRuleWithClient({
        now,
        ruleId: "rule-1",
        sendDigestEmail,
        store,
      })
    ).resolves.toEqual({
      articleCount: 1,
      digestId: "digest-1",
      status: "COMPLETED",
    })

    expect(store.smartDigest.update).toHaveBeenCalledWith({
      data: {
        emailErrorMessage: "Smart Digest email delivery failed.",
        emailStatus: "FAILED",
      },
      where: { id: "digest-1" },
    })
  })

  it("lets the public processor receive the Task 5 sender dependency", async () => {
    const sendDigestEmail = vi.fn().mockResolvedValue(undefined)
    const store = createStore({
      articles: [article({ title: "Climate update" })],
    })

    vi.resetModules()
    vi.doMock("./db", () => ({
      getPrisma: () => store,
    }))

    try {
      const { processSmartDigestRule } = await import("./smart-digest-processing")
      const input = { ruleId: "rule-1", sendDigestEmail }

      await processSmartDigestRule(input)

      expect(sendDigestEmail).toHaveBeenCalledWith({
        digest: expect.objectContaining({
          id: "digest-1",
          items: [
            expect.objectContaining({
              articleTitle: "Climate update",
            }),
          ],
          title: "Climate Digest",
          topicPrompt: "Climate news",
        }),
        to: "reader@example.test",
      })
    } finally {
      vi.doUnmock("./db")
      vi.resetModules()
    }
  })

  it("throws for missing or disabled rules", async () => {
    await expect(
      processSmartDigestRuleWithClient({
        now,
        ruleId: "missing-rule",
        sendDigestEmail: vi.fn(),
        store: createStore({ rule: null }),
      })
    ).rejects.toThrow(new SmartDigestError("Smart Digest rule not found."))

    await expect(
      processSmartDigestRuleWithClient({
        now,
        ruleId: "disabled-rule",
        sendDigestEmail: vi.fn(),
        store: createStore({ rule: baseRule({ isEnabled: false }) }),
      })
    ).rejects.toThrow(new SmartDigestError("Smart Digest rule not found."))
  })
})

function baseRule(
  overrides: Partial<SmartDigestRuleForProcessing> = {}
): SmartDigestRuleForProcessing {
  return {
    emailEnabled: true,
    excludeTerms: [],
    folders: [],
    id: "rule-1",
    includeTerms: ["climate"],
    isEnabled: true,
    lastMatchedAt: null,
    name: "Climate Digest",
    scheduledHour: 8,
    sourceScope: "ALL_FEEDS",
    subscriptions: [],
    timeZone: "UTC",
    topicPrompt: "Climate news",
    user: {
      email: "reader@example.test",
      id: "user-1",
    },
    userId: "user-1",
    ...overrides,
  }
}

function article({
  contentText = null,
  id = "article-1",
  publishedAt = new Date("2026-06-30T10:00:00.000Z"),
  summary = null,
  title,
}: {
  contentText?: string | null
  id?: string
  publishedAt?: Date | null
  summary?: string | null
  title: string
}) {
  return {
    contentText,
    createdAt: new Date("2026-06-30T09:00:00.000Z"),
    feed: {
      title: "North Feed",
    },
    feedId: "feed-1",
    id,
    publishedAt,
    summary,
    title,
    url: `https://example.test/${id}`,
  }
}

function createStore({
  articles = [],
  digest = { id: "digest-1" },
  reverseDigestItems = false,
  rule = baseRule(),
}: {
  articles?: ReturnType<typeof article>[]
  digest?: { id: string }
  reverseDigestItems?: boolean
  rule?: SmartDigestRuleForProcessing | null
} = {}) {
  const store = {
    article: {
      findMany: vi.fn().mockResolvedValue(articles),
    },
    smartDigest: {
      create: vi.fn((args) => {
        const createItems = args.data.items.create
        const items = reverseDigestItems ? [...createItems].reverse() : createItems

        return Promise.resolve({
          articleCount: args.data.articleCount,
          id: digest.id,
          items,
          title: args.data.title,
          topicPrompt: args.data.topicPrompt,
        })
      }),
      update: vi.fn().mockResolvedValue(digest),
    },
    smartDigestRule: {
      findUnique: vi.fn().mockResolvedValue(rule),
      update: vi.fn().mockResolvedValue(rule),
    },
  }

  return store as typeof store & SmartDigestProcessingStore
}

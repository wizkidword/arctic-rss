import { describe, expect, it, vi } from "vitest"

import {
  digestWatermarkFrom,
  processSmartDigestRuleWithClient,
  smartDigestWindowWhere,
  type DigestRunRecord,
  type SmartDigestProcessingStore,
  type SmartDigestRuleForProcessing,
} from "./smart-digest-processing"

const now = new Date("2026-07-13T09:00:00.000Z")
const scheduledFor = new Date("2026-07-13T08:00:00.000Z")

describe("smart digest processing", () => {
  it("creates one durable digest, advances its watermark, then queues delivery", async () => {
    const { mocks, store } = createStore({
      articles: [
        article({
          id: "article-1",
          summary: "A climate update from the north.",
          title: "Arctic climate report",
        }),
      ],
    })
    const enqueueEmail = vi.fn(async () => {
      mocks.events.push("enqueue-email")
    })

    await expect(
      processSmartDigestRuleWithClient({
        enqueueEmail,
        now,
        ruleId: "rule-1",
        scheduledFor,
        store,
      })
    ).resolves.toEqual({
      articleCount: 1,
      digestId: "digest-1",
      status: "COMPLETED",
    })

    expect(mocks.smartDigestCreate).toHaveBeenCalledTimes(1)
    expect(mocks.smartDigestRuleUpdate).toHaveBeenCalledWith({
      data: {
        contentWatermarkAt: now,
        lastMatchedAt: now,
        lastRunAt: now,
        nextRunAt: new Date("2026-07-14T08:00:00.000Z"),
      },
      where: { id: "rule-1" },
    })
    expect(mocks.articleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            expect.any(Object),
            smartDigestWindowWhere({
              ruleId: "rule-1",
              watermarkFrom: new Date("2026-07-12T07:00:00.000Z"),
              watermarkTo: now,
            }),
          ],
        },
      })
    )
    expect(enqueueEmail).toHaveBeenCalledWith("run-1")
    expect(mocks.events.indexOf("create-digest")).toBeLessThan(
      mocks.events.indexOf("enqueue-email")
    )
  })

  it("reuses a completed run instead of creating another digest", async () => {
    const { mocks, store } = createStore({
      run: digestRun({
        digestId: "digest-existing",
        emailStatus: "PENDING",
        status: "COMPLETED",
      }),
    })
    const enqueueEmail = vi.fn().mockResolvedValue(undefined)

    await expect(
      processSmartDigestRuleWithClient({
        enqueueEmail,
        now,
        ruleId: "rule-1",
        scheduledFor,
        store,
      })
    ).resolves.toEqual({
      articleCount: 0,
      digestId: "digest-existing",
      status: "SKIPPED",
    })

    expect(mocks.smartDigestCreate).not.toHaveBeenCalled()
    expect(enqueueEmail).toHaveBeenCalledWith("run-1")
  })

  it("recovers a stale claimed run with a stored digest without recreating it", async () => {
    const { mocks, store } = createStore({
      run: digestRun({
        digestId: "digest-existing",
        processingStartedAt: new Date("2026-07-13T08:40:00.000Z"),
        status: "PROCESSING",
      }),
    })

    await expect(
      processSmartDigestRuleWithClient({
        enqueueEmail: vi.fn().mockResolvedValue(undefined),
        now,
        ruleId: "rule-1",
        scheduledFor,
        store,
      })
    ).resolves.toEqual({
      articleCount: 0,
      digestId: "digest-existing",
      status: "SKIPPED",
    })

    expect(mocks.smartDigestCreate).not.toHaveBeenCalled()
    expect(mocks.digestRunUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "COMPLETED" }),
      })
    )
  })

  it("uses a late-arrival lookback and never selects an already included article", () => {
    expect(
      smartDigestWindowWhere({
        ruleId: "rule-1",
        watermarkFrom: new Date("2026-07-13T06:00:00.000Z"),
        watermarkTo: now,
      })
    ).toEqual({
      AND: [
        {
          OR: [
            {
              publishedAt: {
                gte: new Date("2026-07-13T06:00:00.000Z"),
                lte: now,
              },
            },
            {
              createdAt: {
                gte: new Date("2026-07-13T06:00:00.000Z"),
                lte: now,
              },
            },
          ],
        },
        {
          smartDigestItems: {
            none: {
              digest: {
                ruleId: "rule-1",
              },
            },
          },
        },
      ],
    })
    expect(
      digestWatermarkFrom(
        baseRule({ contentWatermarkAt: new Date("2026-07-13T08:00:00.000Z") }),
        now
      )
    ).toEqual(new Date("2026-07-13T06:00:00.000Z"))
  })
})

function baseRule(
  overrides: Partial<SmartDigestRuleForProcessing> = {}
): SmartDigestRuleForProcessing {
  return {
    contentWatermarkAt: null,
    emailEnabled: true,
    excludeTerms: [],
    folders: [],
    id: "rule-1",
    includeTerms: ["climate"],
    isEnabled: true,
    lastMatchedAt: null,
    lastRunAt: null,
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
  id = "article-1",
  summary = null,
  title,
}: {
  id?: string
  summary?: string | null
  title: string
}) {
  return {
    contentText: null,
    createdAt: new Date("2026-07-13T08:10:00.000Z"),
    feed: { title: "North Feed" },
    feedId: "feed-1",
    id,
    publishedAt: new Date("2026-07-13T08:05:00.000Z"),
    summary,
    title,
    url: `https://example.test/${id}`,
  }
}

function digestRun(overrides: Partial<DigestRunRecord> = {}): DigestRunRecord {
  return {
    completedAt: null,
    digestId: null,
    emailStatus: "NOT_REQUESTED",
    id: "run-1",
    processingStartedAt: null,
    ruleId: "rule-1",
    scheduledFor,
    status: "PENDING",
    ...overrides,
  }
}

function createStore({
  articles = [],
  rule = baseRule(),
  run = null,
}: {
  articles?: ReturnType<typeof article>[]
  rule?: SmartDigestRuleForProcessing
  run?: DigestRunRecord | null
} = {}) {
  let currentRun = run
  const events: string[] = []
  const mocks = {
    articleFindMany: vi.fn().mockResolvedValue(articles),
    digestRunUpdate: vi.fn((args) => {
      currentRun = { ...currentRun!, ...args.data }
      return Promise.resolve(currentRun)
    }),
    digestRunUpdateMany: vi.fn((args) => {
      const staleLease = currentRun?.processingStartedAt
        ? currentRun.processingStartedAt.getTime() <
          new Date("2026-07-13T08:50:00.000Z").getTime()
        : false
      const canClaim =
        currentRun?.status === "PENDING" ||
        currentRun?.status === "FAILED" ||
        (currentRun?.status === "PROCESSING" && staleLease)

      if (!canClaim) {
        return Promise.resolve({ count: 0 })
      }

      currentRun = { ...currentRun!, ...args.data }
      return Promise.resolve({ count: 1 })
    }),
    digestRunUpsert: vi.fn((args) => {
      currentRun ??= digestRun({
        emailStatus: args.create.emailStatus,
        ruleId: args.create.ruleId,
        scheduledFor: args.create.scheduledFor,
        status: args.create.status,
      })
      return Promise.resolve(currentRun)
    }),
    smartDigestCreate: vi.fn((args) => {
      events.push("create-digest")
      return Promise.resolve({
        articleCount: args.data.articleCount,
        id: "digest-1",
        items: args.data.items.create,
        title: args.data.title,
        topicPrompt: args.data.topicPrompt,
      })
    }),
    smartDigestRuleUpdate: vi.fn().mockResolvedValue(rule),
  }

  const store = {
    $transaction: async (callback: (transaction: unknown) => Promise<unknown>) =>
      callback(store),
    article: {
      findMany: mocks.articleFindMany,
    },
    digestRun: {
      findUnique: vi.fn().mockImplementation(() => Promise.resolve(currentRun)),
      update: mocks.digestRunUpdate,
      updateMany: mocks.digestRunUpdateMany,
      upsert: mocks.digestRunUpsert,
    },
    smartDigest: {
      create: mocks.smartDigestCreate,
    },
    smartDigestRule: {
      findUnique: vi.fn().mockResolvedValue(rule),
      update: mocks.smartDigestRuleUpdate,
    },
  }

  return {
    mocks: {
      ...mocks,
      events,
    },
    store: store as unknown as SmartDigestProcessingStore,
  }
}

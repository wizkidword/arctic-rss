import { describe, expect, it, vi } from "vitest"

import {
  processDueSavedMonitors,
  savedMonitorSettings,
} from "./saved-monitors"

const now = new Date("2026-07-29T12:00:00.000Z")
const settings = {
  batchSize: 10,
  intervalMs: 5 * 60_000,
  leaseMs: 10 * 60_000,
  matchBatchSize: 2,
  retryBaseMs: 60_000,
  retryMaxMs: 60 * 60_000,
}

function monitor(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    collectionId: null,
    folderId: null,
    id: "saved-search-1",
    monitorCursorArticleId: "article-0",
    monitorCursorCreatedAt: new Date("2026-07-29T11:00:00.000Z"),
    monitorAction: "count",
    monitorFailureCount: 0,
    monitorNextRunAt: new Date("2026-07-29T11:55:00.000Z"),
    publishedAfter: null,
    publishedBefore: null,
    query: "sea ice",
    state: "all",
    subscriptionId: null,
    userId: "user-1",
    ...overrides,
  }
}

function createStore({
  due = [monitor()],
  updateCounts = [1, 1],
  user = activeUser(),
}: {
  due?: ReturnType<typeof monitor>[]
  updateCounts?: number[]
  user?: ReturnType<typeof activeUser> | null
} = {}) {
  return {
    articleState: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    savedSearch: {
      findMany: vi.fn().mockResolvedValue(due),
      updateMany: vi.fn().mockImplementation(async () => ({
        count: updateCounts.shift() ?? 1,
      })),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
    },
  }
}

function activeUser(): {
  disabledAt: Date | null
  emailVerified: Date | null
  id: string
  plan: "FREE"
} {
  return {
    disabledAt: null,
    emailVerified: new Date("2026-07-01T00:00:00.000Z"),
    id: "user-1",
    plan: "FREE" as const,
  }
}

describe("saved monitors", () => {
  it("claims a due monitor and atomically advances its private cursor and in-app count", async () => {
    const store = createStore()
    const matches = [
      { articleId: "article-1", createdAt: new Date("2026-07-29T11:05:00.000Z") },
      { articleId: "article-2", createdAt: new Date("2026-07-29T11:10:00.000Z") },
    ]
    const findMatches = vi.fn().mockResolvedValue(matches)

    await expect(
      processDueSavedMonitors({ findMatches, now, settings, store })
    ).resolves.toEqual({
      claimed: 1,
      continued: 0,
      failed: 0,
      initialized: 0,
      newMatches: 2,
      skipped: 0,
    })

    expect(findMatches).toHaveBeenCalledWith({
      cursor: {
        articleId: "article-0",
        createdAt: new Date("2026-07-29T11:00:00.000Z"),
      },
      limit: 3,
      monitor: monitor(),
    })
    expect(store.savedSearch.updateMany).toHaveBeenNthCalledWith(1, {
      data: { monitorNextRunAt: new Date("2026-07-29T12:10:00.000Z") },
      where: {
        id: "saved-search-1",
        monitorEnabled: true,
        monitorNextRunAt: new Date("2026-07-29T11:55:00.000Z"),
        userId: "user-1",
      },
    })
    expect(store.savedSearch.updateMany).toHaveBeenNthCalledWith(2, {
      data: {
        monitorCursorArticleId: "article-2",
        monitorCursorCreatedAt: new Date("2026-07-29T11:10:00.000Z"),
        monitorFailureCount: 0,
        monitorLastRunAt: now,
        monitorNewMatchCount: { increment: 2 },
        monitorNextRunAt: new Date("2026-07-29T12:05:00.000Z"),
      },
      where: {
        id: "saved-search-1",
        monitorEnabled: true,
        monitorNextRunAt: new Date("2026-07-29T12:10:00.000Z"),
        userId: "user-1",
      },
    })
  })

  it("continues from a durable cursor without double-counting a bounded backlog", async () => {
    const store = createStore()

    await expect(
      processDueSavedMonitors({
        findMatches: vi.fn().mockResolvedValue([
          { articleId: "article-1", createdAt: new Date("2026-07-29T11:05:00.000Z") },
          { articleId: "article-2", createdAt: new Date("2026-07-29T11:10:00.000Z") },
          { articleId: "article-3", createdAt: new Date("2026-07-29T11:15:00.000Z") },
        ]),
        now,
        settings,
        store,
      })
    ).resolves.toMatchObject({ continued: 1, newMatches: 2 })

    expect(store.savedSearch.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          monitorCursorArticleId: "article-2",
          monitorNewMatchCount: { increment: 2 },
          monitorNextRunAt: now,
        }),
      })
    )
  })

  it("stars only newly matched articles before advancing an automated monitor cursor", async () => {
    const store = createStore({ due: [monitor({ monitorAction: "star" })] })
    const matches = [
      { articleId: "article-1", createdAt: new Date("2026-07-29T11:05:00.000Z") },
      { articleId: "article-2", createdAt: new Date("2026-07-29T11:10:00.000Z") },
    ]

    await processDueSavedMonitors({
      findMatches: vi.fn().mockResolvedValue(matches),
      now,
      settings,
      store,
    })

    expect(store.articleState.createMany).toHaveBeenCalledWith({
      data: matches.map((match) => ({
        articleId: match.articleId,
        isRead: false,
        isStarred: true,
        starredAt: now,
        userId: "user-1",
      })),
      skipDuplicates: true,
    })
    expect(store.articleState.updateMany).toHaveBeenCalledWith({
      data: { isStarred: true, starredAt: now },
      where: {
        articleId: { in: matches.map((match) => match.articleId) },
        isStarred: false,
        userId: "user-1",
      },
    })
  })

  it("does not evaluate a monitor another worker already claimed", async () => {
    const store = createStore({ updateCounts: [0] })
    const findMatches = vi.fn()

    await expect(
      processDueSavedMonitors({ findMatches, now, settings, store })
    ).resolves.toMatchObject({ claimed: 0, skipped: 1 })
    expect(findMatches).not.toHaveBeenCalled()
  })

  it("pauses a due monitor when its account was disabled after scheduling", async () => {
    const store = createStore({
      user: { ...activeUser(), disabledAt: new Date("2026-07-29T11:59:00.000Z") },
    })
    const findMatches = vi.fn()

    await expect(
      processDueSavedMonitors({ findMatches, now, settings, store })
    ).resolves.toMatchObject({ claimed: 0, skipped: 1 })

    expect(findMatches).not.toHaveBeenCalled()
    expect(store.savedSearch.updateMany).toHaveBeenCalledWith({
      data: {
        monitorEnabled: false,
        monitorNextRunAt: null,
      },
      where: {
        id: "saved-search-1",
        monitorEnabled: true,
        userId: "user-1",
      },
    })
  })

  it("stops a claimed monitor before applying matches when the account is disabled mid-run", async () => {
    const store = createStore()
    store.user.findUnique
      .mockResolvedValueOnce(activeUser())
      .mockResolvedValueOnce({
        ...activeUser(),
        disabledAt: new Date("2026-07-29T12:00:00.000Z"),
      })

    await expect(
      processDueSavedMonitors({
        findMatches: vi
          .fn()
          .mockResolvedValue([
            { articleId: "article-1", createdAt: new Date("2026-07-29T11:05:00.000Z") },
          ]),
        now,
        settings,
        store,
      })
    ).resolves.toMatchObject({ claimed: 1, newMatches: 0, skipped: 1 })

    expect(store.articleState.createMany).not.toHaveBeenCalled()
    expect(store.savedSearch.updateMany).toHaveBeenLastCalledWith({
      data: {
        monitorEnabled: false,
        monitorNextRunAt: null,
      },
      where: {
        id: "saved-search-1",
        monitorEnabled: true,
        monitorNextRunAt: new Date("2026-07-29T12:10:00.000Z"),
        userId: "user-1",
      },
    })
  })

  it("initializes a legacy saved search without counting its old matches", async () => {
    const store = createStore({
      due: [
        monitor({
          monitorCursorArticleId: null,
          monitorCursorCreatedAt: null,
        }),
      ],
    })
    const findMatches = vi.fn()

    await expect(
      processDueSavedMonitors({ findMatches, now, settings, store })
    ).resolves.toMatchObject({ initialized: 1, newMatches: 0 })
    expect(findMatches).not.toHaveBeenCalled()
  })

  it("releases a failed monitor for a short bounded retry without exposing its search terms", async () => {
    const store = createStore()

    await expect(
      processDueSavedMonitors({
        findMatches: vi.fn().mockRejectedValue(new Error("database unavailable")),
        now,
        settings,
        store,
      })
    ).resolves.toMatchObject({ failed: 1, newMatches: 0 })
    expect(store.savedSearch.updateMany).toHaveBeenLastCalledWith({
      data: {
        monitorFailureCount: 1,
        monitorNextRunAt: new Date("2026-07-29T12:01:00.000Z"),
      },
      where: {
        id: "saved-search-1",
        monitorEnabled: true,
        monitorNextRunAt: new Date("2026-07-29T12:10:00.000Z"),
        userId: "user-1",
      },
    })
  })

  it("increases a monitor retry delay after repeated failures and resets it on success", async () => {
    const failedStore = createStore({
      due: [monitor({ monitorFailureCount: 1 })],
    })

    await processDueSavedMonitors({
      findMatches: vi.fn().mockRejectedValue(new Error("database unavailable")),
      now,
      settings,
      store: failedStore,
    })

    expect(failedStore.savedSearch.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: {
          monitorFailureCount: 2,
          monitorNextRunAt: new Date("2026-07-29T12:02:00.000Z"),
        },
      })
    )

    const recoveredStore = createStore({
      due: [monitor({ monitorFailureCount: 2 })],
    })
    await processDueSavedMonitors({
      findMatches: vi.fn().mockResolvedValue([]),
      now,
      settings,
      store: recoveredStore,
    })

    expect(recoveredStore.savedSearch.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ monitorFailureCount: 0 }),
      })
    )
  })

  it("clamps monitor scheduling settings to a safe bounded range", () => {
    expect(
      savedMonitorSettings({
        SAVED_MONITOR_BATCH_SIZE: "9999",
        SAVED_MONITOR_INTERVAL_MS: "10",
        SAVED_MONITOR_MATCH_BATCH_SIZE: "9999",
      })
    ).toEqual({
      batchSize: 100,
      intervalMs: 60_000,
      leaseMs: 10 * 60_000,
      matchBatchSize: 500,
      retryBaseMs: 60_000,
      retryMaxMs: 60 * 60_000,
    })
  })

  it("does not allow the configured retry cap to be lower than the retry base", () => {
    expect(
      savedMonitorSettings({
        SAVED_MONITOR_RETRY_BASE_MS: "300000",
        SAVED_MONITOR_RETRY_MAX_MS: "60000",
      })
    ).toMatchObject({ retryBaseMs: 300_000, retryMaxMs: 300_000 })
  })
})

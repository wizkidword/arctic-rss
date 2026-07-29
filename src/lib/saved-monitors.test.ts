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
}

function monitor(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    collectionId: null,
    folderId: null,
    id: "saved-search-1",
    monitorCursorArticleId: "article-0",
    monitorCursorCreatedAt: new Date("2026-07-29T11:00:00.000Z"),
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
}: {
  due?: ReturnType<typeof monitor>[]
  updateCounts?: number[]
} = {}) {
  return {
    savedSearch: {
      findMany: vi.fn().mockResolvedValue(due),
      updateMany: vi.fn().mockImplementation(async () => ({
        count: updateCounts.shift() ?? 1,
      })),
    },
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

  it("does not evaluate a monitor another worker already claimed", async () => {
    const store = createStore({ updateCounts: [0] })
    const findMatches = vi.fn()

    await expect(
      processDueSavedMonitors({ findMatches, now, settings, store })
    ).resolves.toMatchObject({ claimed: 0, skipped: 1 })
    expect(findMatches).not.toHaveBeenCalled()
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

  it("releases a failed monitor for a bounded retry without exposing its search terms", async () => {
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
      data: { monitorNextRunAt: new Date("2026-07-29T12:05:00.000Z") },
      where: {
        id: "saved-search-1",
        monitorEnabled: true,
        monitorNextRunAt: new Date("2026-07-29T12:10:00.000Z"),
        userId: "user-1",
      },
    })
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
    })
  })
})

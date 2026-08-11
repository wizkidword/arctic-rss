import { describe, expect, it, vi } from "vitest"

import { MobileApiError, type MobileApiClient } from "@arctic-rss/mobile-client"

import type { MobileOfflineStore } from "@/storage/mobile-offline-store"

import { synchronizeMobileState } from "./synchronize-mobile-state"

function createOffline({
  cursor = null,
  milestones = [],
}: {
  cursor?: string | null
  milestones?: string[]
} = {}) {
  const recorded = new Set(milestones)

  return {
    bootstrapSync: vi.fn(),
    clearDownloadedData: vi.fn(),
    commitSyncPage: vi.fn(),
    getCursor: vi.fn().mockResolvedValue(cursor),
    hasProductMilestone: vi.fn(async (milestone: string) => recorded.has(milestone)),
  }
}

const emptySyncResponse = {
  data: { events: [], fullResyncRequired: false as const, hasMore: false },
  meta: { nextCursor: "2", requestId: "11111111-1111-4111-8111-111111111111" },
}

const articleStateEvent = {
  action: "UPSERT" as const,
  occurredAt: "2026-08-11T00:00:00.000Z",
  payload: {
    archivedAt: null,
    articleId: "article-1",
    isRead: true,
    isStarred: false,
    readAt: "2026-08-11T00:00:00.000Z",
    starredAt: null,
  },
  resourceId: "article-1",
  resourceType: "article-state",
  resourceVersion: "2026-08-11 00:00:00+00",
  schemaVersion: 1 as const,
  sequence: "2",
}

describe("synchronizeMobileState", () => {
  it("commits the first successful sync and local milestone in one store operation", async () => {
    const offline = createOffline({ cursor: "1" })
    const api = { sync: vi.fn().mockResolvedValue(emptySyncResponse) }

    await synchronizeMobileState(
      api as unknown as MobileApiClient,
      offline as unknown as MobileOfflineStore
    )

    expect(api.sync).toHaveBeenCalledWith("1")
    expect(offline.commitSyncPage).toHaveBeenCalledWith({
      cursor: "2",
      events: [],
      milestone: "first_mobile_sync",
    })
  })

  it("records the first return only after initial sync has already succeeded", async () => {
    const offline = createOffline({ milestones: ["first_mobile_sync"] })
    const api = { sync: vi.fn().mockResolvedValue(emptySyncResponse) }

    await synchronizeMobileState(
      api as unknown as MobileApiClient,
      offline as unknown as MobileOfflineStore,
      { returnSession: true }
    )

    expect(api.sync).toHaveBeenCalledWith(undefined)
    expect(offline.commitSyncPage).toHaveBeenCalledWith(
      expect.objectContaining({ milestone: "first_return_session" })
    )
  })

  it("leaves the cursor and milestone pending when its sync request fails", async () => {
    const offline = createOffline()
    const api = { sync: vi.fn().mockRejectedValue(new Error("offline")) }

    await expect(
      synchronizeMobileState(
        api as unknown as MobileApiClient,
        offline as unknown as MobileOfflineStore
      )
    ).rejects.toThrow("offline")

    expect(offline.commitSyncPage).not.toHaveBeenCalled()
  })

  it("validates and commits an event page before advancing its cursor", async () => {
    const offline = createOffline({ cursor: "1" })
    const api = {
      sync: vi.fn().mockResolvedValue({
        ...emptySyncResponse,
        data: { ...emptySyncResponse.data, events: [articleStateEvent] },
      }),
    }

    await synchronizeMobileState(
      api as unknown as MobileApiClient,
      offline as unknown as MobileOfflineStore
    )

    expect(offline.commitSyncPage).toHaveBeenCalledWith({
      cursor: "2",
      events: [articleStateEvent],
      milestone: "first_mobile_sync",
    })
  })

  it("processes every available page before recording the first-sync milestone", async () => {
    const offline = createOffline({ cursor: "1" })
    const api = {
      sync: vi
        .fn()
        .mockResolvedValueOnce({
          ...emptySyncResponse,
          data: { ...emptySyncResponse.data, events: [articleStateEvent], hasMore: true },
        })
        .mockResolvedValueOnce(emptySyncResponse),
    }

    await synchronizeMobileState(
      api as unknown as MobileApiClient,
      offline as unknown as MobileOfflineStore
    )

    expect(api.sync).toHaveBeenNthCalledWith(1, "1")
    expect(api.sync).toHaveBeenNthCalledWith(2, "2")
    expect(offline.commitSyncPage).toHaveBeenNthCalledWith(1, {
      cursor: "2",
      events: [articleStateEvent],
      milestone: undefined,
    })
    expect(offline.commitSyncPage).toHaveBeenNthCalledWith(2, {
      cursor: "2",
      events: [],
      milestone: "first_mobile_sync",
    })
  })

  it("fails closed when a partial page lacks a usable next cursor", async () => {
    const offline = createOffline({ cursor: "1" })
    const api = {
      sync: vi.fn().mockResolvedValue({
        ...emptySyncResponse,
        data: { ...emptySyncResponse.data, events: [articleStateEvent], hasMore: true },
        meta: { ...emptySyncResponse.meta, nextCursor: "1" },
      }),
    }

    await expect(
      synchronizeMobileState(
        api as unknown as MobileApiClient,
        offline as unknown as MobileOfflineStore
      )
    ).rejects.toThrow("incomplete mobile sync page")

    expect(offline.commitSyncPage).not.toHaveBeenCalled()
  })

  it("uses a high-water bootstrap before resuming incremental sync", async () => {
    const offline = createOffline({ cursor: "1" })
    const api = {
      sync: vi
        .fn()
        .mockRejectedValueOnce(
          new MobileApiError("FULL_RESYNC_REQUIRED", "A full resync is required.", false, 409)
        )
        .mockResolvedValueOnce({ ...emptySyncResponse, meta: { ...emptySyncResponse.meta, nextCursor: "42" } }),
      syncBootstrap: vi.fn().mockResolvedValue({ data: { highWaterCursor: "42" } }),
    }

    await synchronizeMobileState(
      api as unknown as MobileApiClient,
      offline as unknown as MobileOfflineStore
    )

    expect(api.syncBootstrap).toHaveBeenCalledOnce()
    expect(offline.bootstrapSync).toHaveBeenCalledWith("42")
    expect(api.sync).toHaveBeenNthCalledWith(1, "1")
    expect(api.sync).toHaveBeenNthCalledWith(2, "42")
    expect(offline.commitSyncPage).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: "42", milestone: "first_mobile_sync" })
    )
    expect(offline.clearDownloadedData).not.toHaveBeenCalled()
  })
})

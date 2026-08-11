import { describe, expect, it, vi } from "vitest"

import type { MobileApiClient } from "@arctic-rss/mobile-client"

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
    clearDownloadedData: vi.fn(),
    getCursor: vi.fn().mockResolvedValue(cursor),
    hasProductMilestone: vi.fn(async (milestone: string) => recorded.has(milestone)),
    markProductMilestone: vi.fn(async (milestone: string) => recorded.add(milestone)),
    setCursor: vi.fn(),
  }
}

const syncResponse = {
  data: { events: [], fullResyncRequired: false as const },
  meta: { nextCursor: "2", requestId: "11111111-1111-4111-8111-111111111111" },
}

const unappliedEventResponse = {
  data: {
    events: [
      {
        action: "UPSERT" as const,
        occurredAt: "2026-08-11T00:00:00.000Z",
        payload: {},
        resourceId: "article-1",
        resourceType: "ARTICLE_STATE",
        resourceVersion: "1",
        sequence: "2",
      },
    ],
    fullResyncRequired: false as const,
  },
  meta: { nextCursor: "2", requestId: "11111111-1111-4111-8111-111111111111" },
}

describe("synchronizeMobileState", () => {
  it("records the first successful sync once per local signed-in device", async () => {
    const offline = createOffline({ cursor: "1" })
    const api = { sync: vi.fn().mockResolvedValue(syncResponse) }

    await synchronizeMobileState(
      api as unknown as MobileApiClient,
      offline as unknown as MobileOfflineStore
    )

    expect(api.sync).toHaveBeenCalledWith("1", "first_mobile_sync")
    expect(offline.markProductMilestone).toHaveBeenCalledWith("first_mobile_sync")
    expect(offline.setCursor).toHaveBeenCalledWith("2")
  })

  it("records the first return only after initial sync has already succeeded", async () => {
    const offline = createOffline({ milestones: ["first_mobile_sync"] })
    const api = { sync: vi.fn().mockResolvedValue(syncResponse) }

    await synchronizeMobileState(
      api as unknown as MobileApiClient,
      offline as unknown as MobileOfflineStore,
      { returnSession: true }
    )

    expect(api.sync).toHaveBeenCalledWith(undefined, "first_return_session")
    expect(offline.markProductMilestone).toHaveBeenCalledWith(
      "first_return_session"
    )
  })

  it("leaves a milestone pending when its sync request fails", async () => {
    const offline = createOffline()
    const api = { sync: vi.fn().mockRejectedValue(new Error("offline")) }

    await expect(
      synchronizeMobileState(
        api as unknown as MobileApiClient,
        offline as unknown as MobileOfflineStore
      )
    ).rejects.toThrow("offline")

    expect(offline.markProductMilestone).not.toHaveBeenCalled()
  })

  it("does not acknowledge events until the client can apply them transactionally", async () => {
    const offline = createOffline({ cursor: "1" })
    const api = { sync: vi.fn().mockResolvedValue(unappliedEventResponse) }

    await synchronizeMobileState(
      api as unknown as MobileApiClient,
      offline as unknown as MobileOfflineStore
    )

    expect(offline.setCursor).not.toHaveBeenCalled()
    expect(offline.markProductMilestone).not.toHaveBeenCalled()
  })
})

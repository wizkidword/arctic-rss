import { describe, expect, it } from "vitest"

import { toMobileSyncEvent } from "./mobile-sync-event"

const storedEvent = {
  action: "UPSERT",
  occurredAt: new Date("2026-08-11T00:00:00.000Z"),
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
  sequence: BigInt(1),
}

describe("toMobileSyncEvent", () => {
  it("adds the current schema version to a valid journal event", () => {
    expect(toMobileSyncEvent(storedEvent)).toMatchObject({
      resourceType: "article-state",
      schemaVersion: 1,
      sequence: "1",
    })
  })

  it("rejects an unknown journal shape instead of publishing a generic event", () => {
    expect(() => toMobileSyncEvent({ ...storedEvent, resourceType: "future-resource" })).toThrow()
  })
})

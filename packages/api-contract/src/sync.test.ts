import { describe, expect, it } from "vitest"

import { userSyncEventSchema } from "./sync"

const articleStateEvent = {
  action: "UPSERT",
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
  schemaVersion: 1,
  sequence: "1",
}

describe("userSyncEventSchema", () => {
  it("accepts a bounded typed event", () => {
    expect(userSyncEventSchema.parse(articleStateEvent)).toEqual(articleStateEvent)
  })

  it("rejects unknown schema versions and unbounded payload fields", () => {
    expect(userSyncEventSchema.safeParse({ ...articleStateEvent, schemaVersion: 2 }).success).toBe(false)
    expect(
      userSyncEventSchema.safeParse({
        ...articleStateEvent,
        payload: { ...articleStateEvent.payload, articleBody: "must-not-enter-sync" },
      }).success
    ).toBe(false)
  })
})

import { describe, expect, it } from "vitest"

import { syncBootstrapResponseSchema, userSyncEventSchema } from "./sync"

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
    expect(
      userSyncEventSchema.parse({
        action: "UPSERT",
        occurredAt: "2026-08-11T00:00:00.000Z",
        payload: { collectionId: "collection-1", name: "Research", sortOrder: 2 },
        resourceId: "collection-1",
        resourceType: "collection",
        resourceVersion: "2026-08-11 00:00:00+00",
        schemaVersion: 1,
        sequence: "2",
      })
    ).toMatchObject({ resourceType: "collection" })
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

  it("bounds the high-water bootstrap cursor", () => {
    expect(
      syncBootstrapResponseSchema.parse({
        data: { highWaterCursor: "42" },
        meta: { requestId: "11111111-1111-4111-8111-111111111111" },
      })
    ).toMatchObject({ data: { highWaterCursor: "42" } })
    expect(
      syncBootstrapResponseSchema.safeParse({
        data: { highWaterCursor: "not-a-cursor" },
        meta: { requestId: "11111111-1111-4111-8111-111111111111" },
      }).success
    ).toBe(false)
  })
})

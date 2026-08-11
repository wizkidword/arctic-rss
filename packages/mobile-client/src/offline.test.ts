import { describe, expect, it } from "vitest"

import {
  completePendingMobileMutation,
  createPendingMobileMutation,
  failPendingMobileMutation,
  isReplayableMobileMutation,
  mobileMutationRetryDelayMs,
  retryPendingMobileMutation,
  startPendingMobileMutation,
} from "./offline"

const owner = { mobileDeviceId: "device-1", userId: "user-1" }

function articleMutation() {
  return createPendingMobileMutation(
    {
      body: { isRead: true },
      createdAt: 1_000,
      idempotencyKey: "a".repeat(16),
      method: "PATCH",
      path: "/api/v1/articles/article-1/state",
    },
    owner
  )
}

describe("mobile offline mutation state", () => {
  it("records stable ownership, operation metadata, and an explicit initial state", () => {
    expect(articleMutation()).toMatchObject({
      attemptCount: 0,
      id: `mutation:${"a".repeat(16)}`,
      mobileDeviceId: "device-1",
      operation: "ARTICLE_STATE_UPDATE",
      ownerUserId: "user-1",
      resourceId: "article-1",
      state: "PENDING",
    })
  })

  it("backs retryable failures off and keeps terminal failures visible for a manual retry", () => {
    const sending = startPendingMobileMutation(articleMutation(), 2_000)
    const retryable = failPendingMobileMutation(sending, {
      code: "NETWORK_UNAVAILABLE",
      state: "RETRYABLE_FAILURE",
      updatedAt: 2_000,
    })

    expect(mobileMutationRetryDelayMs(1)).toBe(5_000)
    expect(retryable.nextAttemptAt).toBe(7_000)
    expect(isReplayableMobileMutation(retryable, 6_999)).toBe(false)
    expect(isReplayableMobileMutation(retryable, 7_000)).toBe(true)

    const conflict = failPendingMobileMutation(retryable, {
      code: "IDEMPOTENCY_KEY_REUSED",
      state: "CONFLICT",
      updatedAt: 8_000,
    })
    expect(retryPendingMobileMutation(conflict, 9_000)).toMatchObject({
      lastErrorCode: "IDEMPOTENCY_KEY_REUSED",
      state: "PENDING",
      updatedAt: 9_000,
    })
  })

  it("marks a received reply as completed without silently deleting the record", () => {
    const completed = completePendingMobileMutation(
      startPendingMobileMutation(articleMutation(), 2_000),
      3_000
    )

    expect(completed).toMatchObject({ state: "COMPLETED", updatedAt: 3_000 })
  })

  it("rejects a collection queue entry that cannot identify its target article", () => {
    expect(() =>
      createPendingMobileMutation(
        {
          createdAt: 1_000,
          idempotencyKey: "a".repeat(16),
          method: "POST",
          path: "/api/v1/collections/collection-1/items",
        },
        owner
      )
    ).toThrow(/article identifier/)
  })
})

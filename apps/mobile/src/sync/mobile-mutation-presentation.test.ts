import { describe, expect, it } from "vitest"

import type { PendingMobileMutation } from "@arctic-rss/mobile-client"

import {
  mobileMutationLabel,
  mobileMutationReason,
  mobileMutationResourcePath,
} from "./mobile-mutation-presentation"

const mutation: PendingMobileMutation = {
  attemptCount: 1,
  body: { isRead: true },
  createdAt: 1,
  id: `mutation:${"a".repeat(16)}`,
  idempotencyKey: "a".repeat(16),
  lastAttemptAt: 1,
  lastErrorCode: "IDEMPOTENCY_KEY_REUSED",
  method: "PATCH",
  mobileDeviceId: "device-1",
  nextAttemptAt: null,
  operation: "ARTICLE_STATE_UPDATE",
  ownerUserId: "user-1",
  path: "/api/v1/articles/article-1/state",
  resourceId: "article-1",
  state: "CONFLICT",
  updatedAt: 1,
}

describe("mobile mutation presentation", () => {
  it("uses safe operation labels, reasons, and in-app destinations", () => {
    expect(mobileMutationLabel(mutation)).toBe("Article change")
    expect(mobileMutationReason(mutation)).toBe(
      "This saved change conflicts with a different change on the service."
    )
    expect(mobileMutationResourcePath(mutation)).toBe("/article/article-1")
  })

  it("routes a collection record to its collection without exposing queue metadata", () => {
    const collection = { ...mutation, operation: "COLLECTION_ITEM_REMOVE" as const, resourceId: "collection-1:article-1" }

    expect(mobileMutationLabel(collection)).toBe("Remove from collection")
    expect(mobileMutationResourcePath(collection)).toBe("/collection/collection-1")
  })
})

import { describe, expect, it, vi } from "vitest"

import {
  MobileApiError,
  MobileNetworkError,
  type MobileApiClient,
  type PendingMobileMutation,
} from "@arctic-rss/mobile-client"

import type { MobileOfflineStore } from "@/storage/mobile-offline-store"

import { flushPendingMutations } from "./flush-pending-mutations"

function mutation(idempotencyKey: string): PendingMobileMutation {
  return {
    attemptCount: 1,
    body: { isRead: true },
    createdAt: 1,
    id: `mutation:${idempotencyKey}`,
    idempotencyKey,
    lastAttemptAt: 1,
    lastErrorCode: null,
    method: "PATCH",
    mobileDeviceId: "device-1",
    nextAttemptAt: null,
    operation: "ARTICLE_STATE_UPDATE",
    ownerUserId: "user-1",
    path: "/api/v1/articles/article-1/state",
    resourceId: "article-1",
    state: "SENDING",
    updatedAt: 1,
  }
}

function createOffline(mutations: PendingMobileMutation[]) {
  return {
    completePendingMutation: vi.fn(),
    failPendingMutation: vi.fn(),
    nextReplayableMutation: vi
      .fn()
      .mockResolvedValueOnce(mutations[0] ?? null)
      .mockResolvedValueOnce(mutations[1] ?? null)
      .mockResolvedValue(null),
  }
}

describe("flushPendingMutations", () => {
  it("marks a received replay as completed and continues through the active queue", async () => {
    const offline = createOffline([mutation("a".repeat(16)), mutation("b".repeat(16))])
    const api = { replayMutation: vi.fn().mockResolvedValue({}) }

    await expect(
      flushPendingMutations(api as unknown as MobileApiClient, offline as unknown as MobileOfflineStore)
    ).resolves.toEqual({ completed: 2, conflicts: 0 })

    expect(offline.completePendingMutation).toHaveBeenNthCalledWith(1, "a".repeat(16))
    expect(offline.completePendingMutation).toHaveBeenNthCalledWith(2, "b".repeat(16))
    expect(offline.failPendingMutation).not.toHaveBeenCalled()
  })

  it("keeps a retryable failure with bounded evidence and stops this pass", async () => {
    const offline = createOffline([mutation("a".repeat(16))])
    const api = { replayMutation: vi.fn().mockRejectedValue(new MobileNetworkError()) }

    await expect(
      flushPendingMutations(api as unknown as MobileApiClient, offline as unknown as MobileOfflineStore)
    ).resolves.toEqual({ completed: 0, conflicts: 0 })

    expect(offline.failPendingMutation).toHaveBeenCalledWith({
      code: "NETWORK_UNAVAILABLE",
      idempotencyKey: "a".repeat(16),
      state: "RETRYABLE_FAILURE",
    })
    expect(offline.nextReplayableMutation).toHaveBeenCalledOnce()
  })

  it("preserves missing resources and idempotency conflicts for the inbox", async () => {
    const offline = createOffline([mutation("a".repeat(16)), mutation("b".repeat(16))])
    const api = {
      replayMutation: vi
        .fn()
        .mockRejectedValueOnce(new MobileApiError("RESOURCE_NOT_FOUND", "Not found", false, 404))
        .mockRejectedValueOnce(new MobileApiError("IDEMPOTENCY_KEY_REUSED", "Conflict", false, 409)),
    }

    await expect(
      flushPendingMutations(api as unknown as MobileApiClient, offline as unknown as MobileOfflineStore)
    ).resolves.toEqual({ completed: 0, conflicts: 2 })

    expect(offline.failPendingMutation).toHaveBeenNthCalledWith(1, {
      code: "RESOURCE_NOT_FOUND",
      idempotencyKey: "a".repeat(16),
      state: "CONFLICT",
    })
    expect(offline.failPendingMutation).toHaveBeenNthCalledWith(2, {
      code: "IDEMPOTENCY_KEY_REUSED",
      idempotencyKey: "b".repeat(16),
      state: "CONFLICT",
    })
  })

  it("marks an authentication failure before allowing the owner boundary to clear it", async () => {
    const offline = createOffline([mutation("a".repeat(16))])
    const authenticationFailure = new MobileApiError(
      "MOBILE_DEVICE_SESSION_REQUIRED",
      "Sign in again.",
      false,
      401
    )
    const api = { replayMutation: vi.fn().mockRejectedValue(authenticationFailure) }

    await expect(
      flushPendingMutations(api as unknown as MobileApiClient, offline as unknown as MobileOfflineStore)
    ).rejects.toBe(authenticationFailure)

    expect(offline.failPendingMutation).toHaveBeenCalledWith({
      code: "MOBILE_DEVICE_SESSION_REQUIRED",
      idempotencyKey: "a".repeat(16),
      state: "PERMANENT_FAILURE",
    })
  })
})

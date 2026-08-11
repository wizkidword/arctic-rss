import { describe, expect, it, vi } from "vitest"

import { MobileApiError, MobileNetworkError, type IdempotentRequest } from "@arctic-rss/mobile-client"

import type { MobileOfflineStore } from "@/storage/mobile-offline-store"

import { submitMobileMutation } from "./submit-mobile-mutation"

const request: IdempotentRequest = {
  body: { isRead: true },
  idempotencyKey: "a".repeat(16),
  method: "PATCH",
  path: "/api/v1/articles/article-1/state",
}

describe("submitMobileMutation", () => {
  it("queues network and retryable service failures with the original idempotency key", async () => {
    const offline = { queueMutation: vi.fn() }

    await expect(
      submitMobileMutation({
        offline: offline as unknown as MobileOfflineStore,
        perform: vi.fn().mockRejectedValue(new MobileNetworkError()),
        request,
      })
    ).resolves.toEqual({ queued: true, result: null })

    await expect(
      submitMobileMutation({
        offline: offline as unknown as MobileOfflineStore,
        perform: vi
          .fn()
          .mockRejectedValue(new MobileApiError("SERVICE_UNAVAILABLE", "Try again.", true, 503)),
        request,
      })
    ).resolves.toEqual({ queued: true, result: null })

    expect(offline.queueMutation).toHaveBeenCalledTimes(2)
    expect(offline.queueMutation.mock.calls[0][0]).toMatchObject(request)
    expect(offline.queueMutation.mock.calls[1][0]).toMatchObject(request)
  })

  it("does not queue permanent service responses", async () => {
    const offline = { queueMutation: vi.fn() }
    const failure = new MobileApiError("RESOURCE_NOT_FOUND", "Not found", false, 404)

    await expect(
      submitMobileMutation({
        offline: offline as unknown as MobileOfflineStore,
        perform: vi.fn().mockRejectedValue(failure),
        request,
      })
    ).rejects.toBe(failure)

    expect(offline.queueMutation).not.toHaveBeenCalled()
  })

  it("does not save a caller-cancelled request for replay", async () => {
    const offline = { queueMutation: vi.fn() }
    const cancelled = new MobileNetworkError("MOBILE_REQUEST_ABORTED")

    await expect(
      submitMobileMutation({
        offline: offline as unknown as MobileOfflineStore,
        perform: vi.fn().mockRejectedValue(cancelled),
        request,
      })
    ).rejects.toBe(cancelled)

    expect(offline.queueMutation).not.toHaveBeenCalled()
  })
})

import {
  MobileApiError,
  MobileNetworkError,
  type MobileApiClient,
} from "@arctic-rss/mobile-client"

import type { MobileOfflineStore } from "@/storage/mobile-offline-store"

export async function flushPendingMutations(api: MobileApiClient, offline: MobileOfflineStore) {
  let completed = 0
  let conflicts = 0
  while (true) {
    const mutation = await offline.nextReplayableMutation()
    if (!mutation) {
      return { completed, conflicts }
    }
    try {
      await api.replayMutation(mutation)
      await offline.completePendingMutation(mutation.idempotencyKey)
      completed += 1
    } catch (error) {
      if (error instanceof MobileNetworkError && !error.retryable) {
        throw error
      }
      if (
        (error instanceof MobileNetworkError && error.retryable) ||
        (error instanceof MobileApiError && error.retryable)
      ) {
        await offline.failPendingMutation({
          code: error instanceof MobileApiError ? error.code : "NETWORK_UNAVAILABLE",
          idempotencyKey: mutation.idempotencyKey,
          state: "RETRYABLE_FAILURE",
        })
        return { completed, conflicts }
      }
      if (error instanceof MobileApiError && error.status === 401) {
        await offline.failPendingMutation({
          code: error.code,
          idempotencyKey: mutation.idempotencyKey,
          state: "PERMANENT_FAILURE",
        })
        throw error
      }
      const state = error instanceof MobileApiError && (error.status === 404 || error.code === "IDEMPOTENCY_KEY_REUSED")
        ? "CONFLICT"
        : "PERMANENT_FAILURE"
      await offline.failPendingMutation({
        code: error instanceof MobileApiError ? error.code : "UNKNOWN_REPLAY_FAILURE",
        idempotencyKey: mutation.idempotencyKey,
        state,
      })
      conflicts += state === "CONFLICT" ? 1 : 0
    }
  }
}

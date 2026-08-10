import {
  MobileApiError,
  MobileNetworkError,
  type MobileApiClient,
} from "@arctic-rss/mobile-client"

import type { MobileOfflineStore } from "@/storage/mobile-offline-store"

export async function flushPendingMutations(api: MobileApiClient, offline: MobileOfflineStore) {
  let completed = 0
  for (const mutation of await offline.pendingMutations()) {
    try {
      await api.replayMutation(mutation)
      await offline.removePendingMutation(mutation.idempotencyKey)
      completed += 1
    } catch (error) {
      if (error instanceof MobileNetworkError || (error instanceof MobileApiError && error.retryable)) {
        break
      }
      await offline.removePendingMutation(mutation.idempotencyKey)
    }
  }
  return completed
}

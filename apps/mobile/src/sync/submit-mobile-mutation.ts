import {
  MobileApiError,
  MobileNetworkError,
  type IdempotentRequest,
} from "@arctic-rss/mobile-client"

import type { MobileOfflineStore } from "@/storage/mobile-offline-store"

export async function submitMobileMutation<T>({
  offline,
  perform,
  request,
}: {
  offline: MobileOfflineStore
  perform: () => Promise<T>
  request: IdempotentRequest
}): Promise<{ queued: boolean; result: T | null }> {
  try {
    return { queued: false, result: await perform() }
  } catch (error) {
    if (
      !(error instanceof MobileNetworkError) &&
      !(error instanceof MobileApiError && error.retryable)
    ) {
      throw error
    }
    await offline.queueMutation({ ...request, createdAt: Date.now() })
    return { queued: true, result: null }
  }
}

import { MobileApiError, type MobileApiClient } from "@arctic-rss/mobile-client"

import type { MobileOfflineStore } from "@/storage/mobile-offline-store"

export async function synchronizeMobileState(api: MobileApiClient, offline: MobileOfflineStore) {
  const cursor = await offline.getCursor()
  try {
    const response = await api.sync(cursor ?? undefined)
    await offline.setCursor(response.meta.nextCursor ?? cursor)
    return response
  } catch (error) {
    if (!(error instanceof MobileApiError) || error.code !== "FULL_RESYNC_REQUIRED") {
      throw error
    }

    await offline.clearDownloadedData()
    const response = await api.sync()
    await offline.setCursor(response.meta.nextCursor ?? null)
    return response
  }
}

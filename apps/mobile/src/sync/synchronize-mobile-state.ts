import {
  MobileApiError,
  type MobileApiClient,
  type MobileProductMilestone,
} from "@arctic-rss/mobile-client"

import type { MobileOfflineStore } from "@/storage/mobile-offline-store"

export async function synchronizeMobileState(
  api: MobileApiClient,
  offline: MobileOfflineStore,
  { returnSession = false }: { returnSession?: boolean } = {}
) {
  const cursor = await offline.getCursor()
  const milestone = await nextMobileSyncMilestone(offline, returnSession)
  try {
    const response = await api.sync(cursor ?? undefined, milestone)
    await offline.setCursor(response.meta.nextCursor ?? cursor)
    if (milestone) {
      await offline.markProductMilestone(milestone)
    }
    return response
  } catch (error) {
    if (!(error instanceof MobileApiError) || error.code !== "FULL_RESYNC_REQUIRED") {
      throw error
    }

    await offline.clearDownloadedData()
    const response = await api.sync(undefined, milestone)
    await offline.setCursor(response.meta.nextCursor ?? null)
    if (milestone) {
      await offline.markProductMilestone(milestone)
    }
    return response
  }
}

async function nextMobileSyncMilestone(
  offline: MobileOfflineStore,
  returnSession: boolean
): Promise<MobileProductMilestone | undefined> {
  if (!(await offline.hasProductMilestone("first_mobile_sync"))) {
    return "first_mobile_sync"
  }

  if (
    returnSession &&
    !(await offline.hasProductMilestone("first_return_session"))
  ) {
    return "first_return_session"
  }

  return undefined
}

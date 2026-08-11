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
    await commitHandledSyncPage({ cursor, milestone, offline, response })
    return response
  } catch (error) {
    if (!(error instanceof MobileApiError) || error.code !== "FULL_RESYNC_REQUIRED") {
      throw error
    }

    await offline.clearDownloadedData()
    const response = await api.sync(undefined, milestone)
    await commitHandledSyncPage({ cursor: null, milestone, offline, response })
    return response
  }
}

async function commitHandledSyncPage({
  cursor,
  milestone,
  offline,
  response,
}: {
  cursor: string | null
  milestone: MobileProductMilestone | undefined
  offline: MobileOfflineStore
  response: Awaited<ReturnType<MobileApiClient["sync"]>>
}) {
  // Generic sync events have no safe local application path yet. Leaving the
  // cursor and product milestone unchanged guarantees they are replayed after
  // the typed transactional invalidation model lands.
  if (response.data.events.length > 0) {
    return
  }
  await offline.setCursor(response.meta.nextCursor ?? cursor)
  if (milestone) {
    await offline.markProductMilestone(milestone)
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

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
  let cursor = await offline.getCursor()
  const milestone = await nextMobileSyncMilestone(offline, returnSession)
  let bootstrapped = false
  while (true) {
    let response: Awaited<ReturnType<MobileApiClient["sync"]>>
    try {
      response = await api.sync(cursor ?? undefined)
    } catch (error) {
      if (
        !bootstrapped &&
        error instanceof MobileApiError &&
        error.code === "FULL_RESYNC_REQUIRED"
      ) {
        const bootstrap = await api.syncBootstrap()
        await offline.bootstrapSync(bootstrap.data.highWaterCursor)
        cursor = bootstrap.data.highWaterCursor
        bootstrapped = true
        continue
      }
      throw error
    }
    const followingCursor = response.meta.nextCursor
    const nextCursor = followingCursor ?? cursor
    if (!response.data.hasMore) {
      await offline.commitSyncPage({
        cursor: nextCursor,
        events: response.data.events,
        milestone,
      })
      return response
    }
    if (!followingCursor || followingCursor === cursor) {
      throw new Error("Arctic RSS returned an incomplete mobile sync page.")
    }
    await offline.commitSyncPage({
      cursor: nextCursor,
      events: response.data.events,
      milestone: undefined,
    })
    cursor = followingCursor
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

export const CHAT_PRESENCE_TTL_SECONDS = 75
export const CHAT_PRESENCE_HEARTBEAT_INTERVAL_MS = Math.floor(
  (CHAT_PRESENCE_TTL_SECONDS * 1_000) / 2
)
const PRESENCE_NAMESPACE = "arctic-rss:chat:presence:v1"

export type ChatPresenceEntry = {
  connectionId: string
  roomId: string
  userId: string
}

export type ChatPresenceStore = {
  del: (key: string) => Promise<unknown>
  set: (
    key: string,
    value: string,
    mode: "EX",
    ttlSeconds: number
  ) => Promise<unknown>
}

export async function markChatPresence(
  { connectionId, roomId, userId }: ChatPresenceEntry,
  store: ChatPresenceStore
) {
  await store.set(
    chatPresenceKey({ connectionId, roomId, userId }),
    "1",
    "EX",
    CHAT_PRESENCE_TTL_SECONDS
  )
}

export async function refreshChatPresence(
  entries: readonly ChatPresenceEntry[],
  store: ChatPresenceStore
) {
  await Promise.all(entries.map((entry) => markChatPresence(entry, store)))
}

export async function clearChatPresence(
  {
    connectionId,
    roomId,
    userId,
  }: ChatPresenceEntry,
  store: ChatPresenceStore
) {
  await store.del(chatPresenceKey({ connectionId, roomId, userId }))
}

export function chatPresenceKey({
  connectionId,
  roomId,
  userId,
}: {
  connectionId: string
  roomId: string
  userId: string
}) {
  return `${PRESENCE_NAMESPACE}:${roomId}:${userId}:${connectionId}`
}

export type ChatPresenceMetrics = {
  activePresenceEntries: number
  activeSubscriptions: number
  presenceRefreshFailures: number
  stalePresenceCleanup: number
}

export type ChatPresenceMetricEvent =
  | "cleanup"
  | "refresh-failure"
  | "subscription-added"
  | "subscription-removed"

export type ChatPresenceTelemetry = {
  recordCleanup: (count: number) => void
  recordRefreshFailure: () => void
  recordSubscriptionAdded: () => void
  recordSubscriptionRemoved: (count?: number) => void
  snapshot: () => ChatPresenceMetrics
}

export function createChatPresenceTelemetry(
  onUpdate: (event: ChatPresenceMetricEvent, metrics: ChatPresenceMetrics) => void = () => {}
): ChatPresenceTelemetry {
  let activeSubscriptions = 0
  let activePresenceEntries = 0
  let presenceRefreshFailures = 0
  let stalePresenceCleanup = 0

  const snapshot = () => ({
    activePresenceEntries,
    activeSubscriptions,
    presenceRefreshFailures,
    stalePresenceCleanup,
  })
  const update = (event: ChatPresenceMetricEvent) => onUpdate(event, snapshot())

  return {
    recordCleanup(count) {
      stalePresenceCleanup += Math.max(0, count)
      update("cleanup")
    },
    recordRefreshFailure() {
      presenceRefreshFailures += 1
      update("refresh-failure")
    },
    recordSubscriptionAdded() {
      activeSubscriptions += 1
      activePresenceEntries += 1
      update("subscription-added")
    },
    recordSubscriptionRemoved(count = 1) {
      const boundedCount = Math.max(0, count)
      activeSubscriptions = Math.max(0, activeSubscriptions - boundedCount)
      activePresenceEntries = Math.max(0, activePresenceEntries - boundedCount)
      update("subscription-removed")
    },
    snapshot,
  }
}

export function createChatPresenceHeartbeat({
  connectionId,
  getRoomIds,
  intervalMs = CHAT_PRESENCE_HEARTBEAT_INTERVAL_MS,
  onRefreshFailure = () => {},
  refresh,
  userId,
}: {
  connectionId: string
  getRoomIds: () => Iterable<string>
  intervalMs?: number
  onRefreshFailure?: () => void
  refresh: (entries: readonly ChatPresenceEntry[]) => Promise<void>
  userId: string
}) {
  let refreshing = false
  let timer: ReturnType<typeof setInterval> | undefined

  const renew = async () => {
    if (refreshing) {
      return
    }

    const entries = [...getRoomIds()].map((roomId) => ({ connectionId, roomId, userId }))
    if (entries.length === 0) {
      return
    }

    refreshing = true
    try {
      await refresh(entries)
    } catch {
      onRefreshFailure()
    } finally {
      refreshing = false
    }
  }

  return {
    renew,
    start() {
      if (timer !== undefined) {
        return
      }

      timer = setInterval(() => {
        void renew()
      }, intervalMs)
      timer.unref?.()
    },
    stop() {
      if (timer !== undefined) {
        clearInterval(timer)
        timer = undefined
      }
    },
  }
}

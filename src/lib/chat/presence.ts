const PRESENCE_TTL_SECONDS = 75
const PRESENCE_NAMESPACE = "arctic-rss:chat:presence:v1"

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
  {
    connectionId,
    roomId,
    userId,
  }: {
    connectionId: string
    roomId: string
    userId: string
  },
  store: ChatPresenceStore
) {
  await store.set(
    chatPresenceKey({ connectionId, roomId, userId }),
    "1",
    "EX",
    PRESENCE_TTL_SECONDS
  )
}

export async function clearChatPresence(
  {
    connectionId,
    roomId,
    userId,
  }: {
    connectionId: string
    roomId: string
    userId: string
  },
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

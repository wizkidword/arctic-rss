import { getPrisma } from "@/lib/db"

import { getChatFeatureFlags, type ChatFeatureFlagEnvironment } from "./feature-flags"
import { normalizeChatRoomSlug } from "./normalization"
import { canPerformChatAction, type ChatRoomMemberRole } from "./permissions"
import type { ChatIdentity, ChatMessageWire } from "./room-service"

export const ARCTIC_BOT_NAME = "ArcticBot"
export const CHAT_BOT_MAX_DIGEST_ITEMS = 5
export const CHAT_BOT_MINIMUM_INTERVAL_MINUTES = 1
export const CHAT_BOT_MAXIMUM_INTERVAL_MINUTES = 24 * 60

type ChatBotPostingMode = "OFF" | "LIVE" | "DIGEST"

type ChatBotArticle = {
  feedId: string
  id: string
}

type ChatBotRoom = {
  botLastPostedAt: Date | null
  id: string
  isOfficial: boolean
  slug: string
  state: "ACTIVE" | "ARCHIVED" | "READ_ONLY" | "SUSPENDED"
}

type ChatBotRoomFeed = {
  feedId: string
  minimumIntervalMinutes: number
  postingMode: ChatBotPostingMode
  roomId: string
}

type ChatBotDelivery = {
  article: {
    feed: { title: string }
    id: string
    title: string
  }
  articleId: string
}

type ChatBotMessageRecord = {
  article: { feed: { title: string }; id: string; title: string } | null
  body: string
  clientMessageId: string
  createdAt: Date
  id: string
  kind: "BOT"
  roomId: string
  senderUserId: string | null
  sequence: bigint
}

type ChatBotStore = {
  $transaction?: <T>(work: (transaction: ChatBotStore) => Promise<T>) => Promise<T>
  article: {
    findUnique(args: Record<string, unknown>): Promise<ChatBotArticle | null>
  }
  chatAuditLog: {
    create(args: Record<string, unknown>): Promise<unknown>
  }
  chatBotDelivery: {
    deleteMany(args: Record<string, unknown>): Promise<{ count: number }>
    findMany(args: Record<string, unknown>): Promise<ChatBotDelivery[]>
    updateMany(args: Record<string, unknown>): Promise<{ count: number }>
    upsert(args: Record<string, unknown>): Promise<unknown>
  }
  chatMessage: {
    create(args: Record<string, unknown>): Promise<ChatBotMessageRecord>
  }
  chatRoom: {
    findUnique(args: Record<string, unknown>): Promise<ChatBotRoom | null>
    updateMany(args: Record<string, unknown>): Promise<{ count: number }>
  }
  chatRoomFeed: {
    findMany(args: Record<string, unknown>): Promise<ChatBotRoomFeed[]>
    findUnique(args: Record<string, unknown>): Promise<ChatBotRoomFeed | null>
    updateMany(args: Record<string, unknown>): Promise<{ count: number }>
    upsert(args: Record<string, unknown>): Promise<ChatBotRoomFeed>
  }
  chatRoomMember: {
    findUnique(args: Record<string, unknown>): Promise<{
      role: ChatRoomMemberRole
      status: "ACTIVE" | "LEFT" | "PENDING"
    } | null>
  }
  feedSubscription: {
    findFirst(args: Record<string, unknown>): Promise<{ id: string } | null>
  }
}

export class ChatBotError extends Error {
  constructor(
    message: string,
    readonly code: "forbidden" | "invalid-request" | "not-found"
  ) {
    super(message)
    this.name = "ChatBotError"
  }
}

export function parseChatRoomFeedSettingsInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ChatBotError("ArcticBot settings are invalid.", "invalid-request")
  }

  const input = value as Record<string, unknown>
  if (
    Object.keys(input).some(
      (key) =>
        key !== "feedId" &&
        key !== "minimumIntervalMinutes" &&
        key !== "postingMode"
    ) ||
    typeof input.feedId !== "string" ||
    typeof input.minimumIntervalMinutes !== "number" ||
    typeof input.postingMode !== "string"
  ) {
    throw new ChatBotError("ArcticBot settings are invalid.", "invalid-request")
  }

  const feedId = input.feedId.trim()
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(feedId)) {
    throw new ChatBotError("ArcticBot settings are invalid.", "invalid-request")
  }

  if (
    !Number.isInteger(input.minimumIntervalMinutes) ||
    input.minimumIntervalMinutes < CHAT_BOT_MINIMUM_INTERVAL_MINUTES ||
    input.minimumIntervalMinutes > CHAT_BOT_MAXIMUM_INTERVAL_MINUTES
  ) {
    throw new ChatBotError(
      `ArcticBot intervals must be ${CHAT_BOT_MINIMUM_INTERVAL_MINUTES}–${CHAT_BOT_MAXIMUM_INTERVAL_MINUTES} minutes.`,
      "invalid-request"
    )
  }

  if (
    input.postingMode !== "OFF" &&
    input.postingMode !== "LIVE" &&
    input.postingMode !== "DIGEST"
  ) {
    throw new ChatBotError("ArcticBot settings are invalid.", "invalid-request")
  }

  return {
    feedId,
    minimumIntervalMinutes: input.minimumIntervalMinutes,
    postingMode: input.postingMode as ChatBotPostingMode,
  }
}

export function parseChatBotDisableInput(value: unknown) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== 1 ||
    (value as Record<string, unknown>).action !== "disable"
  ) {
    throw new ChatBotError("ArcticBot request is invalid.", "invalid-request")
  }
}

export async function listChatRoomFeedSettings({
  identity,
  roomSlug,
  store = getChatBotStore(),
}: {
  identity: ChatIdentity
  roomSlug: string
  store?: ChatBotStore
}) {
  const room = await findRoom(roomSlug, store)
  await assertCanConfigureRoomFeeds({ identity, room, store })

  return store.chatRoomFeed.findMany({
    orderBy: [{ postingMode: "asc" }, { feedId: "asc" }],
    select: {
      feed: { select: { title: true } },
      feedId: true,
      minimumIntervalMinutes: true,
      postingMode: true,
      roomId: true,
    },
    where: { roomId: room.id },
  })
}

export async function configureChatRoomFeed({
  identity,
  roomSlug,
  settings,
  store = getChatBotStore(),
}: {
  identity: ChatIdentity
  roomSlug: string
  settings: ReturnType<typeof parseChatRoomFeedSettingsInput>
  store?: ChatBotStore
}) {
  return inTransaction(store, async (transaction) => {
    const room = await findRoom(roomSlug, transaction)
    await assertCanConfigureRoomFeeds({ identity, room, store: transaction })

    const subscription = await transaction.feedSubscription.findFirst({
      select: { id: true },
      where: { feedId: settings.feedId, userId: identity.userId },
    })
    if (!subscription) {
      throw new ChatBotError("Subscribe to that feed before adding it to a room.", "not-found")
    }

    if (
      settings.postingMode !== "OFF" &&
      (!room.isOfficial || room.state !== "ACTIVE")
    ) {
      throw new ChatBotError(
        "Automated feed posts are limited to active official rooms.",
        "forbidden"
      )
    }

    const result = await transaction.chatRoomFeed.upsert({
      create: {
        createdByUserId: identity.userId,
        feedId: settings.feedId,
        minimumIntervalMinutes: settings.minimumIntervalMinutes,
        postingMode: settings.postingMode,
        roomId: room.id,
      },
      select: {
        feedId: true,
        minimumIntervalMinutes: true,
        postingMode: true,
        roomId: true,
      },
      update: {
        createdByUserId: identity.userId,
        minimumIntervalMinutes: settings.minimumIntervalMinutes,
        postingMode: settings.postingMode,
      },
      where: { roomId_feedId: { feedId: settings.feedId, roomId: room.id } },
    })
    const discardedPendingDeliveries =
      settings.postingMode === "OFF"
        ? await transaction.chatBotDelivery.deleteMany({
            where: {
              feedId: settings.feedId,
              roomId: room.id,
              status: "PENDING",
            },
          })
        : { count: 0 }
    await transaction.chatAuditLog.create({
      data: {
        action: "BOT_FEED_CONFIGURED",
        actorUserId: identity.userId,
        metadata: {
          feedId: settings.feedId,
          discardedPendingDeliveryCount: discardedPendingDeliveries.count,
          minimumIntervalMinutes: settings.minimumIntervalMinutes,
          postingMode: settings.postingMode,
        },
        roomId: room.id,
      },
      select: { id: true },
    })

    return result
  })
}

export async function disableChatBotForRoom({
  identity,
  roomSlug,
  store = getChatBotStore(),
}: {
  identity: ChatIdentity
  roomSlug: string
  store?: ChatBotStore
}) {
  return inTransaction(store, async (transaction) => {
    const room = await findRoom(roomSlug, transaction)
    await assertCanConfigureRoomFeeds({ identity, room, store: transaction })

    const updated = await transaction.chatRoomFeed.updateMany({
      data: { postingMode: "OFF" },
      where: { roomId: room.id, postingMode: { not: "OFF" } },
    })
    const discardedPendingDeliveries = await transaction.chatBotDelivery.deleteMany({
      where: { roomId: room.id, status: "PENDING" },
    })
    await transaction.chatAuditLog.create({
      data: {
        action: "BOT_FEEDS_DISABLED",
        actorUserId: identity.userId,
        metadata: {
          discardedPendingDeliveryCount: discardedPendingDeliveries.count,
          updatedFeedCount: updated.count,
        },
        roomId: room.id,
      },
      select: { id: true },
    })

    return { disabledFeedCount: updated.count, roomId: room.id }
  })
}

export async function processChatArticleIntegration({
  articleId,
  environment = process.env,
  now = () => new Date(),
  store = getChatBotStore(),
}: {
  articleId: string
  environment?: ChatFeatureFlagEnvironment
  now?: () => Date
  store?: ChatBotStore
}) {
  if (!getChatFeatureFlags(environment).botEnabled) {
    return { disabled: true, messages: [] as ChatMessageWire[], queued: 0 }
  }

  const article = await store.article.findUnique({
    select: { feedId: true, id: true },
    where: { id: articleId },
  })
  if (!article) {
    return { disabled: false, messages: [] as ChatMessageWire[], queued: 0 }
  }

  const roomFeeds = await store.chatRoomFeed.findMany({
    select: { feedId: true, minimumIntervalMinutes: true, postingMode: true, roomId: true },
    where: {
      feedId: article.feedId,
      postingMode: { in: ["LIVE", "DIGEST"] },
      room: { isOfficial: true, state: "ACTIVE" },
    },
  })
  const messages: ChatMessageWire[] = []

  for (const roomFeed of roomFeeds) {
    await store.chatBotDelivery.upsert({
      create: {
        articleId: article.id,
        feedId: article.feedId,
        roomId: roomFeed.roomId,
      },
      update: {},
      where: {
        roomId_articleId: { articleId: article.id, roomId: roomFeed.roomId },
      },
    })
    const message = await drainChatRoomFeed({
      feedId: article.feedId,
      now: now(),
      roomId: roomFeed.roomId,
      store,
    })
    if (message) {
      messages.push(message)
    }
  }

  return { disabled: false, messages, queued: roomFeeds.length }
}

export async function processPendingChatBotDeliveries({
  environment = process.env,
  limit = 100,
  now = () => new Date(),
  store = getChatBotStore(),
}: {
  environment?: ChatFeatureFlagEnvironment
  limit?: number
  now?: () => Date
  store?: ChatBotStore
}) {
  if (!getChatFeatureFlags(environment).botEnabled) {
    return { disabled: true, messages: [] as ChatMessageWire[], roomFeedCount: 0 }
  }

  const roomFeeds = await store.chatRoomFeed.findMany({
    orderBy: [{ roomId: "asc" }, { feedId: "asc" }],
    select: { feedId: true, minimumIntervalMinutes: true, postingMode: true, roomId: true },
    take: Math.max(1, Math.min(500, Math.floor(limit))),
    where: {
      postingMode: { in: ["LIVE", "DIGEST"] },
      room: { isOfficial: true, state: "ACTIVE" },
    },
  })
  const messages: ChatMessageWire[] = []

  for (const roomFeed of roomFeeds) {
    const message = await drainChatRoomFeed({
      feedId: roomFeed.feedId,
      now: now(),
      roomId: roomFeed.roomId,
      store,
    })
    if (message) {
      messages.push(message)
    }
  }

  return { disabled: false, messages, roomFeedCount: roomFeeds.length }
}

async function drainChatRoomFeed({
  feedId,
  now,
  roomId,
  store,
}: {
  feedId: string
  now: Date
  roomId: string
  store: ChatBotStore
}) {
  return inTransaction(store, async (transaction) => {
    const [room, roomFeed] = await Promise.all([
      transaction.chatRoom.findUnique({
        select: {
          botLastPostedAt: true,
          id: true,
          isOfficial: true,
          slug: true,
          state: true,
        },
        where: { id: roomId },
      }),
      transaction.chatRoomFeed.findUnique({
        select: {
          feedId: true,
          minimumIntervalMinutes: true,
          postingMode: true,
          roomId: true,
        },
        where: { roomId_feedId: { feedId, roomId } },
      }),
    ])

    if (
      !room ||
      !roomFeed ||
      !room.isOfficial ||
      room.state !== "ACTIVE" ||
      roomFeed.postingMode === "OFF"
    ) {
      return null
    }

    const cutoff = new Date(
      now.getTime() - roomFeed.minimumIntervalMinutes * 60_000
    )
    if (room.botLastPostedAt && room.botLastPostedAt > cutoff) {
      return null
    }

    const deliveries = await transaction.chatBotDelivery.findMany({
      orderBy: [{ createdAt: "asc" }, { articleId: "asc" }],
      select: {
        article: { select: { feed: { select: { title: true } }, id: true, title: true } },
        articleId: true,
      },
      take: roomFeed.postingMode === "LIVE" ? 1 : CHAT_BOT_MAX_DIGEST_ITEMS,
      where: { feedId, roomId, status: "PENDING" },
    })
    if (!deliveries.length) {
      return null
    }

    const lock = await transaction.chatRoom.updateMany({
      data: { botLastPostedAt: now, lastActivityAt: now },
      where: {
        id: room.id,
        OR: [
          { botLastPostedAt: null },
          { botLastPostedAt: { lte: cutoff } },
        ],
      },
    })
    if (!lock.count) {
      return null
    }

    const message = await transaction.chatMessage.create({
      data: buildBotMessageData({ deliveries, mode: roomFeed.postingMode, roomId }),
      select: {
        article: { select: { feed: { select: { title: true } }, id: true, title: true } },
        body: true,
        clientMessageId: true,
        createdAt: true,
        id: true,
        kind: true,
        roomId: true,
        senderUserId: true,
        sequence: true,
      },
    })
    const delivered = await transaction.chatBotDelivery.updateMany({
      data: { messageId: message.id, status: "POSTED" },
      where: {
        articleId: { in: deliveries.map((delivery) => delivery.articleId) },
        roomId,
        status: "PENDING",
      },
    })
    if (delivered.count !== deliveries.length) {
      throw new Error("ArcticBot delivery state changed while posting.")
    }

    return serializeBotMessage(message)
  })
}

function buildBotMessageData({
  deliveries,
  mode,
  roomId,
}: {
  deliveries: ChatBotDelivery[]
  mode: Exclude<ChatBotPostingMode, "OFF">
  roomId: string
}) {
  const first = deliveries[0]
  const feedTitle = compactText(first.article.feed.title, 120) || "a feed"

  if (mode === "LIVE") {
    const title = compactText(first.article.title, 240) || "New article"
    return {
      articleId: first.article.id,
      body: `New from ${feedTitle}: ${title}`,
      clientMessageId: `arcticbot-${roomId}-${first.article.id}`,
      kind: "BOT" as const,
      metadata: { mode: "LIVE", v: 1 },
      roomId,
      senderUserId: null,
    }
  }

  const titles = deliveries.map((delivery) => compactText(delivery.article.title, 240) || "New article")
  return {
    body: `ArcticBot digest from ${feedTitle}:\n${titles.map((title) => `• ${title}`).join("\n")}`,
    clientMessageId: `arcticbot-digest-${roomId}-${first.article.id}`,
    kind: "BOT" as const,
    metadata: {
      articleIds: deliveries.map((delivery) => delivery.article.id),
      mode: "DIGEST",
      v: 1,
    },
    roomId,
    senderUserId: null,
  }
}

function serializeBotMessage(message: ChatBotMessageRecord): ChatMessageWire {
  return {
    article: message.article
      ? {
          id: message.article.id,
          publisher: message.article.feed.title,
          title: message.article.title,
        }
      : null,
    body: message.body,
    clientMessageId: message.clientMessageId,
    createdAt: message.createdAt.toISOString(),
    id: message.id,
    kind: message.kind,
    roomId: message.roomId,
    senderHandle: null,
    senderUserId: message.senderUserId,
    sequence: message.sequence.toString(),
  }
}

async function findRoom(roomSlug: string, store: ChatBotStore) {
  const room = await store.chatRoom.findUnique({
    select: {
      botLastPostedAt: true,
      id: true,
      isOfficial: true,
      slug: true,
      state: true,
    },
    where: { slug: normalizeChatRoomSlug(roomSlug) },
  })
  if (!room) {
    throw new ChatBotError("That chat room was not found.", "not-found")
  }

  return room
}

async function assertCanConfigureRoomFeeds({
  identity,
  room,
  store,
}: {
  identity: ChatIdentity
  room: ChatBotRoom
  store: ChatBotStore
}) {
  const membership = await store.chatRoomMember.findUnique({
    select: { role: true, status: true },
    where: { roomId_userId: { roomId: room.id, userId: identity.userId } },
  })
  if (
    !canPerformChatAction("SET_ROOM_MODE", {
      chatEnabled: true,
      emailVerified: true,
      globalRole: identity.role,
      roomMemberStatus: membership?.status,
      roomRole: membership?.role,
      roomState: room.state,
    })
  ) {
    throw new ChatBotError("You cannot change ArcticBot settings for this room.", "forbidden")
  }
}

function compactText(value: string, maximumLength: number) {
  const compact = value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  return compact.length <= maximumLength
    ? compact
    : `${compact.slice(0, maximumLength - 3).trimEnd()}...`
}

function inTransaction<T>(
  store: ChatBotStore,
  work: (transaction: ChatBotStore) => Promise<T>
) {
  return store.$transaction ? store.$transaction(work) : work(store)
}

function getChatBotStore() {
  return getPrisma() as unknown as ChatBotStore
}

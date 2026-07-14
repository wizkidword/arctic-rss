import type { PrismaClient } from "@/generated/prisma/client"

import { getPrisma } from "@/lib/db"

import { normalizeChatHandle, normalizeChatRoomSlug } from "./normalization"
import { canPerformChatAction, type ChatRoomMemberRole } from "./permissions"

const MAX_HISTORY_PAGE_SIZE = 100
const DEFAULT_HISTORY_PAGE_SIZE = 50
const CLIENT_MESSAGE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/

const roomSummarySelect = {
  description: true,
  historyVisibility: true,
  id: true,
  interests: { select: { interestId: true } },
  isOfficial: true,
  joinPolicy: true,
  languageCode: true,
  name: true,
  slug: true,
  slowModeSeconds: true,
  state: true,
  topicLine: true,
  visibility: true,
} as const

const messageSelect = {
  article: {
    select: {
      feed: { select: { title: true } },
      id: true,
      title: true,
    },
  },
  body: true,
  clientMessageId: true,
  createdAt: true,
  id: true,
  kind: true,
  roomId: true,
  senderUserId: true,
  sender: {
    select: {
      chatProfile: { select: { handle: true } },
    },
  },
  sequence: true,
} as const

export type ChatRoomStore = Pick<
  PrismaClient,
  "article" | "chatMessage" | "chatRoom" | "chatRoomBan" | "chatRoomMember"
>

export type ChatIdentity = {
  role: "USER" | "ADMIN"
  userId: string
}

export type ChatMessageWire = {
  article: { id: string; publisher: string; title: string } | null
  body: string
  clientMessageId: string
  createdAt: string
  id: string
  kind: "TEXT" | "ACTION" | "NOTICE" | "SYSTEM" | "ARTICLE" | "BOT"
  roomId: string
  senderHandle: string | null
  senderUserId: string | null
  sequence: string
}

export class ChatRoomServiceError extends Error {
  constructor(
    message: string,
    readonly code:
      | "banned"
      | "duplicate-article"
      | "forbidden"
      | "idempotency-conflict"
      | "invalid-message"
      | "invalid-request"
      | "muted"
      | "not-found"
      | "slow-mode"
  ) {
    super(message)
    this.name = "ChatRoomServiceError"
  }
}

export function parseChatMessageInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ChatRoomServiceError("Message input is invalid.", "invalid-message")
  }

  const input = value as Record<string, unknown>

  if (
    Object.keys(input).some(
      (key) => key !== "body" && key !== "clientMessageId" && key !== "kind"
    ) ||
    typeof input.body !== "string" ||
    typeof input.clientMessageId !== "string" ||
    (input.kind !== undefined && input.kind !== "TEXT" && input.kind !== "ACTION")
  ) {
    throw new ChatRoomServiceError("Message input is invalid.", "invalid-message")
  }

  const body = input.body.trim()
  const clientMessageId = input.clientMessageId.trim()

  if (
    !body ||
    body.length > 2_000 ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(body) ||
    !CLIENT_MESSAGE_ID_PATTERN.test(clientMessageId)
  ) {
    throw new ChatRoomServiceError("Message input is invalid.", "invalid-message")
  }

  return {
    body,
    clientMessageId,
    kind: (input.kind ?? "TEXT") as "TEXT" | "ACTION",
  }
}

export function parseChatTopicInput(value: unknown) {
  if (typeof value !== "string") {
    throw new ChatRoomServiceError("Room topic is invalid.", "invalid-request")
  }

  const topic = value.trim()

  if (
    !topic ||
    topic.length > 240 ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(topic)
  ) {
    throw new ChatRoomServiceError("Room topic is invalid.", "invalid-request")
  }

  return topic
}

export function parseChatArticleShareInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ChatRoomServiceError("Article share input is invalid.", "invalid-request")
  }

  const input = value as Record<string, unknown>

  if (
    Object.keys(input).some((key) => key !== "articleId" && key !== "clientMessageId") ||
    typeof input.articleId !== "string" ||
    typeof input.clientMessageId !== "string"
  ) {
    throw new ChatRoomServiceError("Article share input is invalid.", "invalid-request")
  }

  const articleId = input.articleId.trim()
  const clientMessageId = input.clientMessageId.trim()

  if (!/^[A-Za-z0-9_-]{8,128}$/.test(articleId) || !CLIENT_MESSAGE_ID_PATTERN.test(clientMessageId)) {
    throw new ChatRoomServiceError("Article share input is invalid.", "invalid-request")
  }

  return { articleId, clientMessageId }
}

export function parseHistoryPageSize(value: string | null) {
  if (!value) {
    return DEFAULT_HISTORY_PAGE_SIZE
  }

  const size = Number(value)

  if (!Number.isInteger(size) || size < 1 || size > MAX_HISTORY_PAGE_SIZE) {
    throw new ChatRoomServiceError("History page size is invalid.", "invalid-request")
  }

  return size
}

export function parseHistoryCursor(value: string | null) {
  if (!value) {
    return undefined
  }

  if (!/^\d+$/.test(value)) {
    throw new ChatRoomServiceError("History cursor is invalid.", "invalid-request")
  }

  return BigInt(value)
}

export async function listChatRooms(store: ChatRoomStore = getPrisma()) {
  const rooms = await store.chatRoom.findMany({
    orderBy: [{ isOfficial: "desc" }, { name: "asc" }],
    select: roomSummarySelect,
    where: {
      state: "ACTIVE",
      visibility: "PUBLIC",
    },
  })

  return rooms.map(serializeRoom)
}

export async function joinChatRoom({
  identity,
  slug,
  store = getPrisma(),
}: {
  identity: ChatIdentity
  slug: string
  store?: ChatRoomStore
}) {
  const room = await findRoomBySlug(slug, store)

  if (
    room.state !== "ACTIVE" ||
    !canPerformChatAction("JOIN_OPEN_ROOM", {
      chatEnabled: true,
      emailVerified: true,
      globalRole: identity.role,
      roomState: room.state,
    }) ||
    room.joinPolicy !== "OPEN"
  ) {
    throw new ChatRoomServiceError("You cannot join this room.", "forbidden")
  }

  const ban = await store.chatRoomBan.findFirst({
    select: { id: true },
    where: {
      roomId: room.id,
      revokedAt: null,
      targetUserId: identity.userId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  })

  if (ban) {
    throw new ChatRoomServiceError("You are banned from this room.", "banned")
  }

  const membership = await store.chatRoomMember.upsert({
    create: {
      roomId: room.id,
      status: "ACTIVE",
      userId: identity.userId,
    },
    select: memberSelect,
    update: {
      joinedAt: new Date(),
      leftAt: null,
      status: "ACTIVE",
    },
    where: {
      roomId_userId: { roomId: room.id, userId: identity.userId },
    },
  })

  return { member: serializeMember(membership), room: serializeRoom(room) }
}

export async function leaveChatRoom({
  identity,
  slug,
  store = getPrisma(),
}: {
  identity: ChatIdentity
  slug: string
  store?: ChatRoomStore
}) {
  const room = await findRoomBySlug(slug, store)
  const membership = await store.chatRoomMember.findUnique({
    select: memberSelect,
    where: {
      roomId_userId: { roomId: room.id, userId: identity.userId },
    },
  })

  if (!membership?.status || membership.status !== "ACTIVE") {
    throw new ChatRoomServiceError("You are not in this room.", "forbidden")
  }

  const updated = await store.chatRoomMember.update({
    data: { leftAt: new Date(), status: "LEFT" },
    select: memberSelect,
    where: { roomId_userId: { roomId: room.id, userId: identity.userId } },
  })

  return { member: serializeMember(updated), room: serializeRoom(room) }
}

export async function getChatRoomSnapshot({
  beforeSequence,
  identity,
  limit = DEFAULT_HISTORY_PAGE_SIZE,
  slug,
  store = getPrisma(),
}: {
  beforeSequence?: bigint
  identity: ChatIdentity
  limit?: number
  slug: string
  store?: ChatRoomStore
}) {
  const room = await findRoomBySlug(slug, store)
  const membership = await store.chatRoomMember.findUnique({
    select: memberSelect,
    where: {
      roomId_userId: { roomId: room.id, userId: identity.userId },
    },
  })

  if (
    !canPerformChatAction("READ_MEMBER_HISTORY", {
      chatEnabled: true,
      emailVerified: true,
      globalRole: identity.role,
      roomMemberStatus: membership?.status,
      roomRole: membership?.role,
      roomState: room.state,
    })
  ) {
    throw new ChatRoomServiceError("You cannot view this room.", "forbidden")
  }

  const messages = await store.chatMessage.findMany({
    orderBy: { sequence: "desc" },
    select: messageSelect,
    take: limit,
    where: {
      deletedAt: null,
      roomId: room.id,
      ...(beforeSequence ? { sequence: { lt: beforeSequence } } : {}),
    },
  })

  return {
    member: membership ? serializeMember(membership) : null,
    messages: messages.reverse().map(serializeMessage),
    room: serializeRoom(room),
  }
}

export async function sendChatRoomMessage({
  body,
  clientMessageId,
  identity,
  kind,
  roomId,
  store = getPrisma(),
}: {
  body: string
  clientMessageId: string
  identity: ChatIdentity
  kind?: "TEXT" | "ACTION"
  roomId: string
  store?: ChatRoomStore
}): Promise<{ created: boolean; message: ChatMessageWire }> {
  const input = parseChatMessageInput({ body, clientMessageId, kind })
  const existing = await store.chatMessage.findUnique({
    select: messageSelect,
    where: {
      senderUserId_clientMessageId: {
        clientMessageId: input.clientMessageId,
        senderUserId: identity.userId,
      },
    },
  })

  if (existing) {
    if (existing.roomId !== roomId) {
      throw new ChatRoomServiceError(
        "Message ID cannot be reused for another room.",
        "idempotency-conflict"
      )
    }

    return { created: false, message: serializeMessage(existing) }
  }

  const room = await store.chatRoom.findUnique({
    select: roomSummarySelect,
    where: { id: roomId },
  })

  if (!room) {
    throw new ChatRoomServiceError("Room was not found.", "not-found")
  }

  const membership = await store.chatRoomMember.findUnique({
    select: memberSelect,
    where: { roomId_userId: { roomId, userId: identity.userId } },
  })

  if (!canPostInRoom(room, membership, identity)) {
    throw new ChatRoomServiceError("You cannot post in this room.", "forbidden")
  }

  await enforceRoomPostLimits({ identity, membership, room, store })

  try {
    const message = await store.chatMessage.create({
      data: {
        body: input.body,
        clientMessageId: input.clientMessageId,
        kind: input.kind,
        roomId,
        senderUserId: identity.userId,
      },
      select: messageSelect,
    })

    await store.chatRoom.update({
      data: { lastActivityAt: message.createdAt },
      where: { id: roomId },
    })

    return { created: true, message: serializeMessage(message) }
  } catch (error) {
    const duplicate = await store.chatMessage.findUnique({
      select: messageSelect,
      where: {
        senderUserId_clientMessageId: {
          clientMessageId: input.clientMessageId,
          senderUserId: identity.userId,
        },
      },
    })

    if (duplicate?.roomId === roomId) {
      return { created: false, message: serializeMessage(duplicate) }
    }

    throw error
  }
}

export async function shareChatRoomArticle({
  articleId,
  clientMessageId,
  identity,
  roomId,
  store = getPrisma(),
}: {
  articleId: string
  clientMessageId: string
  identity: ChatIdentity
  roomId: string
  store?: ChatRoomStore
}): Promise<{ created: boolean; message: ChatMessageWire }> {
  const input = parseChatArticleShareInput({ articleId, clientMessageId })
  const existing = await store.chatMessage.findUnique({
    select: messageSelect,
    where: {
      senderUserId_clientMessageId: {
        clientMessageId: input.clientMessageId,
        senderUserId: identity.userId,
      },
    },
  })

  if (existing) {
    if (existing.roomId !== roomId || existing.kind !== "ARTICLE") {
      throw new ChatRoomServiceError(
        "Message ID cannot be reused for another chat action.",
        "idempotency-conflict"
      )
    }
    return { created: false, message: serializeMessage(existing) }
  }

  const room = await store.chatRoom.findUnique({
    select: roomSummarySelect,
    where: { id: roomId },
  })
  const membership = await store.chatRoomMember.findUnique({
    select: memberSelect,
    where: { roomId_userId: { roomId, userId: identity.userId } },
  })

  if (!room) {
    throw new ChatRoomServiceError("Room was not found.", "not-found")
  }

  if (!canPostInRoom(room, membership, identity)) {
    throw new ChatRoomServiceError("You cannot post in this room.", "forbidden")
  }

  await enforceRoomPostLimits({ identity, membership, room, store })

  const article = await store.article.findFirst({
    select: {
      feed: { select: { title: true } },
      id: true,
      title: true,
    },
    where: {
      id: input.articleId,
      feed: { subscriptions: { some: { userId: identity.userId } } },
    },
  })

  if (!article) {
    throw new ChatRoomServiceError("That article is not available to share.", "not-found")
  }

  const duplicate = await store.chatMessage.findFirst({
    select: { id: true },
    where: {
      articleId: article.id,
      createdAt: { gt: new Date(Date.now() - 60 * 60_000) },
      kind: "ARTICLE",
      roomId,
      senderUserId: identity.userId,
    },
  })

  if (duplicate) {
    throw new ChatRoomServiceError(
      "You already shared that article in this room recently.",
      "duplicate-article"
    )
  }

  const message = await store.chatMessage.create({
    data: {
      articleId: article.id,
      body: article.title.trim().slice(0, 2_000) || "Shared an article",
      clientMessageId: input.clientMessageId,
      kind: "ARTICLE",
      metadata: { v: 1 },
      roomId,
      senderUserId: identity.userId,
    },
    select: messageSelect,
  })

  await store.chatRoom.update({
    data: { lastActivityAt: message.createdAt },
    where: { id: roomId },
  })

  return { created: true, message: serializeMessage(message) }
}

export async function updateChatRoomTopic({
  identity,
  slug,
  store = getPrisma(),
  topic,
}: {
  identity: ChatIdentity
  slug: string
  store?: ChatRoomStore
  topic: string
}) {
  const room = await findRoomBySlug(slug, store)
  const membership = await store.chatRoomMember.findUnique({
    select: memberSelect,
    where: { roomId_userId: { roomId: room.id, userId: identity.userId } },
  })

  if (
    !canPerformChatAction("UPDATE_TOPIC", {
      chatEnabled: true,
      emailVerified: true,
      globalRole: identity.role,
      roomMemberStatus: membership?.status,
      roomRole: membership?.role,
      roomState: room.state,
    })
  ) {
    throw new ChatRoomServiceError("You cannot update this room topic.", "forbidden")
  }

  const updated = await store.chatRoom.update({
    data: { topicLine: parseChatTopicInput(topic) },
    select: roomSummarySelect,
    where: { id: room.id },
  })

  return serializeRoom(updated)
}

export async function getChatRoomMemberWhois({
  handle,
  identity,
  slug,
  store = getPrisma(),
}: {
  handle: string
  identity: ChatIdentity
  slug: string
  store?: ChatRoomStore
}) {
  const room = await findRoomBySlug(slug, store)
  const requester = await store.chatRoomMember.findUnique({
    select: memberSelect,
    where: { roomId_userId: { roomId: room.id, userId: identity.userId } },
  })

  if (
    !canPerformChatAction("READ_MEMBER_HISTORY", {
      chatEnabled: true,
      emailVerified: true,
      globalRole: identity.role,
      roomMemberStatus: requester?.status,
      roomRole: requester?.role,
      roomState: room.state,
    })
  ) {
    throw new ChatRoomServiceError("You cannot view this room.", "forbidden")
  }

  const member = await store.chatRoomMember.findFirst({
    select: {
      role: true,
      user: { select: { chatProfile: { select: { handle: true } } } },
    },
    where: {
      roomId: room.id,
      status: "ACTIVE",
      user: { chatProfile: { handleNormalized: normalizeChatHandle(handle) } },
    },
  })

  if (!member?.user.chatProfile) {
    throw new ChatRoomServiceError("That member is not in this room.", "not-found")
  }

  return { handle: member.user.chatProfile.handle, role: member.role }
}

export async function updateChatReadMarker({
  identity,
  roomId,
  sequence,
  store = getPrisma(),
}: {
  identity: ChatIdentity
  roomId: string
  sequence: bigint
  store?: ChatRoomStore
}) {
  const membership = await store.chatRoomMember.findUnique({
    select: memberSelect,
    where: { roomId_userId: { roomId, userId: identity.userId } },
  })

  if (membership?.status !== "ACTIVE") {
    throw new ChatRoomServiceError("You cannot update this room.", "forbidden")
  }

  await store.chatRoomMember.updateMany({
    data: { lastReadMessageSequence: sequence },
    where: {
      roomId,
      userId: identity.userId,
      OR: [
        { lastReadMessageSequence: null },
        { lastReadMessageSequence: { lt: sequence } },
      ],
    },
  })
}

const memberSelect = {
  lastReadMessageSequence: true,
  role: true,
  roomId: true,
  roomMutedUntil: true,
  status: true,
  userId: true,
} as const

async function findRoomBySlug(slug: string, store: ChatRoomStore) {
  const room = await store.chatRoom.findUnique({
    select: roomSummarySelect,
    where: { slug: normalizeChatRoomSlug(slug) },
  })

  if (!room) {
    throw new ChatRoomServiceError("Room was not found.", "not-found")
  }

  return room
}

function serializeMember(member: {
  lastReadMessageSequence: bigint | null
  role: ChatRoomMemberRole
  roomId: string
  status: "ACTIVE" | "LEFT" | "PENDING"
  userId: string
}) {
  return {
    lastReadMessageSequence: member.lastReadMessageSequence?.toString() ?? null,
    role: member.role,
    roomId: member.roomId,
    status: member.status,
    userId: member.userId,
  }
}

function serializeMessage(message: {
  article?: { feed: { title: string }; id: string; title: string } | null
  body: string
  clientMessageId: string
  createdAt: Date
  id: string
  kind: ChatMessageWire["kind"]
  roomId: string
  sender?: { chatProfile: { handle: string } | null } | null
  senderUserId: string | null
  sequence: bigint
}): ChatMessageWire {
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
    senderHandle:
      message.sender?.chatProfile?.handle ??
      (message.senderUserId === null && (message.kind === "ACTION" || message.kind === "TEXT")
        ? "Deleted user"
        : null),
    senderUserId: message.senderUserId,
    sequence: message.sequence.toString(),
  }
}

function canPostInRoom(
  room: { state: "ACTIVE" | "ARCHIVED" | "READ_ONLY" | "SUSPENDED" },
  membership: {
    roomMutedUntil?: Date | null
    role: ChatRoomMemberRole
    status: "ACTIVE" | "LEFT" | "PENDING"
  } | null,
  identity: ChatIdentity
) {
  return canPerformChatAction("POST_MESSAGE", {
    chatEnabled: true,
    emailVerified: true,
    globalRole: identity.role,
    roomMemberStatus: membership?.status,
    roomRole: membership?.role,
    roomState: room.state,
  })
}

async function enforceRoomPostLimits({
  identity,
  membership,
  room,
  store,
}: {
  identity: ChatIdentity
  membership: {
    roomMutedUntil?: Date | null
    role: ChatRoomMemberRole
    status: "ACTIVE" | "LEFT" | "PENDING"
  } | null
  room: { id: string; slowModeSeconds: number }
  store: ChatRoomStore
}) {
  if (membership?.roomMutedUntil && membership.roomMutedUntil > new Date()) {
    throw new ChatRoomServiceError("You are muted in this room.", "muted")
  }

  if (identity.role === "ADMIN" || !room.slowModeSeconds || room.slowModeSeconds <= 0) {
    return
  }

  const previous = await store.chatMessage.findFirst({
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
    where: {
      deletedAt: null,
      roomId: room.id,
      senderUserId: identity.userId,
    },
  })

  if (
    previous &&
    previous.createdAt.getTime() + room.slowModeSeconds * 1_000 > Date.now()
  ) {
    throw new ChatRoomServiceError(
      "Slow mode is active in this room.",
      "slow-mode"
    )
  }
}

function serializeRoom(room: {
  description: string
  historyVisibility: "PUBLIC_PREVIEW" | "MEMBERS" | "AFTER_JOIN"
  id: string
  interests: Array<{ interestId: string }>
  isOfficial: boolean
  joinPolicy: "OPEN" | "REQUEST" | "INVITE"
  languageCode: string
  name: string
  slug: string
  state: "ACTIVE" | "READ_ONLY" | "ARCHIVED" | "SUSPENDED"
  topicLine: string | null
  visibility: "PUBLIC" | "UNLISTED" | "PRIVATE"
}) {
  return {
    description: room.description,
    historyVisibility: room.historyVisibility,
    id: room.id,
    interestIds: room.interests.map((interest) => interest.interestId),
    isOfficial: room.isOfficial,
    joinPolicy: room.joinPolicy,
    languageCode: room.languageCode,
    name: room.name,
    slug: room.slug,
    state: room.state,
    topicLine: room.topicLine,
    visibility: room.visibility,
  }
}

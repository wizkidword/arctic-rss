import type { Prisma, PrismaClient } from "@/generated/prisma/client"

import { getPrisma } from "@/lib/db"

import { normalizeChatHandle, normalizeChatRoomSlug } from "./normalization"
import { canPerformChatAction, type ChatAction, type ChatRoomMemberRole } from "./permissions"
import type { ChatIdentity } from "./room-service"

const REPORT_CATEGORIES = [
  "HARASSMENT",
  "HATE",
  "IMPERSONATION",
  "ILLEGAL_CONTENT",
  "MALWARE",
  "OTHER",
  "PERSONAL_INFO",
  "SAFETY",
  "SCAM",
  "SPAM",
] as const

const MEMBER_ROLE_RANK: Record<ChatRoomMemberRole, number> = {
  ADMIN: 3,
  MEMBER: 0,
  OPERATOR: 2,
  OWNER: 4,
  VOICE: 1,
}

const roomSelect = {
  id: true,
  joinPolicy: true,
  slug: true,
  slowModeSeconds: true,
  state: true,
} as const

const memberSelect = {
  role: true,
  roomId: true,
  roomMutedUntil: true,
  status: true,
  userId: true,
} as const

const profileSelect = { handle: true, userId: true } as const

export type ChatModerationStore = Pick<
  PrismaClient,
  | "chatAuditLog"
  | "chatMessage"
  | "chatProfile"
  | "chatReport"
  | "chatRoom"
  | "chatRoomBan"
  | "chatRoomMember"
>

export type ChatReportCategory = (typeof REPORT_CATEGORIES)[number]

export type ChatReportInput = {
  category: ChatReportCategory
  details: string | null
  messageId: string | null
  roomSlug: string | null
  targetHandle: string | null
}

export type ChatReportResolutionInput = {
  retentionClass: "ORDINARY" | "SERIOUS"
  status: "ACTIONED" | "DISMISSED"
}

export class ChatModerationError extends Error {
  constructor(
    message: string,
    readonly code: "forbidden" | "invalid-request" | "not-found"
  ) {
    super(message)
    this.name = "ChatModerationError"
  }
}

export function parseChatReportInput(value: unknown): ChatReportInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ChatModerationError("Report input is invalid.", "invalid-request")
  }

  const input = value as Record<string, unknown>
  const allowedKeys = new Set([
    "category",
    "details",
    "messageId",
    "roomSlug",
    "targetHandle",
  ])

  if (
    Object.keys(input).some((key) => !allowedKeys.has(key)) ||
    typeof input.category !== "string" ||
    !REPORT_CATEGORIES.includes(input.category as ChatReportCategory)
  ) {
    throw new ChatModerationError("Report input is invalid.", "invalid-request")
  }

  const details = optionalBoundedText(input.details, 1_000)
  const messageId = optionalIdentifier(input.messageId)
  const roomSlug = optionalText(input.roomSlug, 64)
  const targetHandle = optionalText(input.targetHandle, 64)

  if (!messageId && !roomSlug && !targetHandle) {
    throw new ChatModerationError(
      "Choose a message, room, or chat member to report.",
      "invalid-request"
    )
  }

  return {
    category: input.category as ChatReportCategory,
    details,
    messageId,
    roomSlug,
    targetHandle,
  }
}

export function parseChatReportResolutionInput(value: unknown): ChatReportResolutionInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ChatModerationError("Report resolution input is invalid.", "invalid-request")
  }

  const input = value as Record<string, unknown>

  if (
    Object.keys(input).some((key) => key !== "retentionClass" && key !== "status") ||
    (input.status !== "ACTIONED" && input.status !== "DISMISSED") ||
    (input.retentionClass !== undefined &&
      input.retentionClass !== "ORDINARY" &&
      input.retentionClass !== "SERIOUS")
  ) {
    throw new ChatModerationError("Report resolution input is invalid.", "invalid-request")
  }

  return {
    retentionClass: input.retentionClass === "SERIOUS" ? "SERIOUS" : "ORDINARY",
    status: input.status,
  }
}

export function parseChatModerationTargetInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ChatModerationError("Moderation input is invalid.", "invalid-request")
  }

  const input = value as Record<string, unknown>

  if (
    Object.keys(input).some(
      (key) => key !== "durationSeconds" && key !== "reason" && key !== "targetHandle"
    ) ||
    typeof input.targetHandle !== "string" ||
    typeof input.reason !== "string"
  ) {
    throw new ChatModerationError("Moderation input is invalid.", "invalid-request")
  }

  const reason = boundedText(input.reason, 240)
  const targetHandle = boundedText(input.targetHandle, 64)
  const durationSeconds =
    input.durationSeconds === undefined
      ? null
      : parseDurationSeconds(input.durationSeconds)

  return { durationSeconds, reason, targetHandle }
}

export function parseChatModerationUnbanInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ChatModerationError("Moderation input is invalid.", "invalid-request")
  }

  const input = value as Record<string, unknown>
  if (Object.keys(input).length !== 1 || typeof input.targetHandle !== "string") {
    throw new ChatModerationError("Moderation input is invalid.", "invalid-request")
  }

  return { targetHandle: boundedText(input.targetHandle, 64) }
}

export function parseChatRoomModerationSettingsInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ChatModerationError("Room moderation input is invalid.", "invalid-request")
  }

  const input = value as Record<string, unknown>

  if (input.action === "lock" && Object.keys(input).length === 2 && typeof input.locked === "boolean") {
    return { action: "lock" as const, locked: input.locked }
  }

  if (
    input.action === "slow-mode" &&
    Object.keys(input).length === 2 &&
    Number.isInteger(input.seconds) &&
    typeof input.seconds === "number" &&
    input.seconds >= 0 &&
    input.seconds <= 3_600
  ) {
    return { action: "slow-mode" as const, seconds: input.seconds }
  }

  if (
    input.action === "state" &&
    Object.keys(input).length === 2 &&
    (input.state === "ACTIVE" ||
      input.state === "READ_ONLY" ||
      input.state === "SUSPENDED")
  ) {
    return {
      action: "state" as const,
      state: input.state as "ACTIVE" | "READ_ONLY" | "SUSPENDED",
    }
  }

  throw new ChatModerationError("Room moderation input is invalid.", "invalid-request")
}

export async function createChatReport({
  identity,
  input,
  store = getPrisma(),
}: {
  identity: ChatIdentity
  input: ChatReportInput
  store?: ChatModerationStore
}) {
  return inTransaction(store, async (transaction) => {
    const target = input.targetHandle
      ? await findProfile(input.targetHandle, transaction)
      : null
    const message = input.messageId
      ? await transaction.chatMessage.findUnique({
          select: {
            createdAt: true,
            id: true,
            roomId: true,
            senderUserId: true,
            sequence: true,
          },
          where: { id: input.messageId },
        })
      : null

    if (input.messageId && !message) {
      throw new ChatModerationError("That chat message was not found.", "not-found")
    }

    if (target && message?.senderUserId && target.userId !== message.senderUserId) {
      throw new ChatModerationError(
        "The reported member does not match the reported message.",
        "invalid-request"
      )
    }

    const room = message
      ? await findRoomById(message.roomId, transaction)
      : input.roomSlug
        ? await findRoomBySlug(input.roomSlug, transaction)
        : null

    if (input.roomSlug && room && room.slug !== normalizeChatRoomSlug(input.roomSlug)) {
      throw new ChatModerationError(
        "The reported room does not match the reported message.",
        "invalid-request"
      )
    }

    if (room) {
      const reporterMembership = await transaction.chatRoomMember.findUnique({
        select: memberSelect,
        where: { roomId_userId: { roomId: room.id, userId: identity.userId } },
      })
      assertRoomPermission("READ_MEMBER_HISTORY", identity, reporterMembership, room)
    }

    const targetUserId = message?.senderUserId ?? target?.userId ?? null
    const report = await transaction.chatReport.create({
      data: {
        category: input.category,
        details: input.details,
        evidence: {
          create: {
            snapshot: message
              ? {
                  createdAt: message.createdAt.toISOString(),
                  messageId: message.id,
                  sequence: message.sequence.toString(),
                  v: 1,
                }
              : { v: 1 },
          },
        },
        messageId: message?.id ?? null,
        reporterUserId: identity.userId,
        roomId: room?.id ?? null,
        targetUserId,
      },
      select: { id: true, status: true },
    })

    await writeAudit(transaction, {
      action: "REPORT_CREATED",
      actorUserId: identity.userId,
      messageId: message?.id ?? null,
      metadata: { category: input.category },
      roomId: room?.id ?? null,
      targetUserId,
    })

    return report
  })
}

export async function listChatReports({
  identity,
  store = getPrisma(),
}: {
  identity: ChatIdentity
  store?: ChatModerationStore
}) {
  if (identity.role !== "ADMIN") {
    throw new ChatModerationError("Moderator access is required.", "forbidden")
  }

  return store.chatReport.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    select: {
      category: true,
      createdAt: true,
      details: true,
      evidence: { select: { createdAt: true, snapshot: true } },
      id: true,
      messageId: true,
      room: { select: { name: true, slug: true } },
      status: true,
      target: { select: { chatProfile: { select: { handle: true } } } },
    },
    take: 100,
    where: { status: { in: ["OPEN", "REVIEWING"] } },
  })
}

export async function resolveChatReport({
  identity,
  input,
  reportId,
  store = getPrisma(),
}: {
  identity: ChatIdentity
  input: ChatReportResolutionInput
  reportId: string
  store?: ChatModerationStore
}) {
  if (identity.role !== "ADMIN") {
    throw new ChatModerationError("Moderator access is required.", "forbidden")
  }

  const report = await store.chatReport.findUnique({
    select: { id: true, messageId: true, roomId: true, targetUserId: true },
    where: { id: reportId },
  })

  if (!report) {
    throw new ChatModerationError("That report was not found.", "not-found")
  }

  const closedAt = new Date()
  await store.chatReport.update({
    data: {
      closedAt,
      retentionClass: input.retentionClass,
      status: input.status,
    },
    where: { id: report.id },
  })
  await writeAudit(store, {
    action: "REPORT_RESOLVED",
    actorUserId: identity.userId,
    messageId: report.messageId,
    metadata: { retentionClass: input.retentionClass, status: input.status },
    roomId: report.roomId,
    targetUserId: report.targetUserId,
  })

  return { closedAt, id: report.id, retentionClass: input.retentionClass, status: input.status }
}

export async function kickChatRoomMember({
  identity,
  reason,
  roomSlug,
  store = getPrisma(),
  targetHandle,
}: {
  identity: ChatIdentity
  reason: string
  roomSlug: string
  store?: ChatModerationStore
  targetHandle: string
}) {
  return changeRoomMember({
    action: "KICK_MEMBER",
    auditAction: "MEMBER_KICKED",
    identity,
    reason,
    roomSlug,
    store,
    targetHandle,
    updateMember: (transaction, target) =>
      transaction.chatRoomMember.update({
        data: { leftAt: new Date(), status: "LEFT" },
        select: { userId: true },
        where: { roomId_userId: { roomId: target.roomId, userId: target.userId } },
      }),
  })
}

export async function banChatRoomMember({
  durationSeconds,
  identity,
  reason,
  roomSlug,
  store = getPrisma(),
  targetHandle,
}: {
  durationSeconds: number | null
  identity: ChatIdentity
  reason: string
  roomSlug: string
  store?: ChatModerationStore
  targetHandle: string
}) {
  return inTransaction(store, async (transaction) => {
    const context = await resolveModerationTarget({
      action: "BAN_MEMBER",
      identity,
      roomSlug,
      store: transaction,
      targetHandle,
    })
    const activeBan = await transaction.chatRoomBan.findFirst({
      select: { id: true },
      where: {
        roomId: context.room.id,
        revokedAt: null,
        targetUserId: context.target.profile.userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    })

    if (!activeBan) {
      await transaction.chatRoomBan.create({
        data: {
          createdByUserId: identity.userId,
          expiresAt: durationSeconds
            ? new Date(Date.now() + durationSeconds * 1_000)
            : null,
          reason,
          roomId: context.room.id,
          targetUserId: context.target.profile.userId,
        },
        select: { id: true },
      })
    }

    await transaction.chatRoomMember.update({
      data: { leftAt: new Date(), status: "LEFT" },
      select: { userId: true },
      where: {
        roomId_userId: {
          roomId: context.room.id,
          userId: context.target.profile.userId,
        },
      },
    })
    await writeAudit(transaction, {
      action: "MEMBER_BANNED",
      actorUserId: identity.userId,
      metadata: { durationSeconds, existing: Boolean(activeBan) },
      reason,
      roomId: context.room.id,
      targetUserId: context.target.profile.userId,
    })

    return {
      alreadyBanned: Boolean(activeBan),
      roomId: context.room.id,
      targetHandle: context.target.profile.handle,
      targetUserId: context.target.profile.userId,
    }
  })
}

export async function unbanChatRoomMember({
  identity,
  roomSlug,
  store = getPrisma(),
  targetHandle,
}: {
  identity: ChatIdentity
  roomSlug: string
  store?: ChatModerationStore
  targetHandle: string
}) {
  return inTransaction(store, async (transaction) => {
    const room = await findRoomBySlug(roomSlug, transaction)
    const actorMembership = await transaction.chatRoomMember.findUnique({
      select: memberSelect,
      where: { roomId_userId: { roomId: room.id, userId: identity.userId } },
    })
    assertRoomPermission("BAN_MEMBER", identity, actorMembership, room)
    const target = await findProfile(targetHandle, transaction)
    const updated = await transaction.chatRoomBan.updateMany({
      data: { revokedAt: new Date() },
      where: {
        revokedAt: null,
        roomId: room.id,
        targetUserId: target.userId,
      },
    })

    if (!updated.count) {
      throw new ChatModerationError("That member has no active room ban.", "not-found")
    }

    await writeAudit(transaction, {
      action: "MEMBER_UNBANNED",
      actorUserId: identity.userId,
      roomId: room.id,
      targetUserId: target.userId,
    })

    return { roomId: room.id, targetHandle: target.handle, targetUserId: target.userId }
  })
}

export async function muteChatRoomMember({
  durationSeconds,
  identity,
  reason,
  roomSlug,
  store = getPrisma(),
  targetHandle,
}: {
  durationSeconds: number
  identity: ChatIdentity
  reason: string
  roomSlug: string
  store?: ChatModerationStore
  targetHandle: string
}) {
  return changeRoomMember({
    action: "MUTE_MEMBER",
    auditAction: "MEMBER_MUTED",
    identity,
    metadata: { durationSeconds },
    reason,
    roomSlug,
    store,
    targetHandle,
    updateMember: (transaction, target) =>
      transaction.chatRoomMember.update({
        data: { roomMutedUntil: new Date(Date.now() + durationSeconds * 1_000) },
        select: { userId: true },
        where: { roomId_userId: { roomId: target.roomId, userId: target.userId } },
      }),
  })
}

export async function updateChatRoomModerationSettings({
  identity,
  roomSlug,
  settings,
  store = getPrisma(),
}: {
  identity: ChatIdentity
  roomSlug: string
  settings: ReturnType<typeof parseChatRoomModerationSettingsInput>
  store?: ChatModerationStore
}) {
  return inTransaction(store, async (transaction) => {
    const room = await findRoomBySlug(roomSlug, transaction)
    const actorMembership = await transaction.chatRoomMember.findUnique({
      select: memberSelect,
      where: { roomId_userId: { roomId: room.id, userId: identity.userId } },
    })
    assertRoomPermission("SET_ROOM_MODE", identity, actorMembership, room)

    if (settings.action === "state" && settings.state === "SUSPENDED" && identity.role !== "ADMIN") {
      throw new ChatModerationError("Administrator access is required to suspend a room.", "forbidden")
    }

    if (settings.action === "state" && room.state === "SUSPENDED" && identity.role !== "ADMIN") {
      throw new ChatModerationError("Administrator access is required to change a suspended room.", "forbidden")
    }

    const data =
      settings.action === "lock"
        ? { joinPolicy: settings.locked ? "INVITE" as const : "OPEN" as const }
        : settings.action === "slow-mode"
          ? { slowModeSeconds: settings.seconds }
          : { state: settings.state }
    const updated = await transaction.chatRoom.update({
      data,
      select: roomSelect,
      where: { id: room.id },
    })
    await writeAudit(transaction, {
      action:
        settings.action === "lock"
          ? settings.locked ? "ROOM_LOCKED" : "ROOM_UNLOCKED"
          : settings.action === "slow-mode"
            ? "ROOM_SLOW_MODE_UPDATED"
            : "ROOM_STATE_UPDATED",
      actorUserId: identity.userId,
      metadata:
        settings.action === "lock"
          ? { locked: settings.locked }
          : settings.action === "slow-mode"
            ? { seconds: settings.seconds }
            : { state: settings.state },
      roomId: room.id,
    })

    return updated
  })
}

async function changeRoomMember({
  action,
  auditAction,
  identity,
  metadata,
  reason,
  roomSlug,
  store,
  targetHandle,
  updateMember,
}: {
  action: "KICK_MEMBER" | "MUTE_MEMBER"
  auditAction: string
  identity: ChatIdentity
  metadata?: Record<string, unknown>
  reason: string
  roomSlug: string
  store: ChatModerationStore
  targetHandle: string
  updateMember: (
    transaction: ChatModerationStore,
    target: { roomId: string; userId: string }
  ) => Promise<unknown>
}) {
  return inTransaction(store, async (transaction) => {
    const context = await resolveModerationTarget({
      action,
      identity,
      roomSlug,
      store: transaction,
      targetHandle,
    })
    await updateMember(transaction, {
      roomId: context.room.id,
      userId: context.target.profile.userId,
    })
    await writeAudit(transaction, {
      action: auditAction,
      actorUserId: identity.userId,
      metadata,
      reason,
      roomId: context.room.id,
      targetUserId: context.target.profile.userId,
    })

    return {
      roomId: context.room.id,
      targetHandle: context.target.profile.handle,
      targetUserId: context.target.profile.userId,
    }
  })
}

async function resolveModerationTarget({
  action,
  identity,
  roomSlug,
  store,
  targetHandle,
}: {
  action: "BAN_MEMBER" | "KICK_MEMBER" | "MUTE_MEMBER"
  identity: ChatIdentity
  roomSlug: string
  store: ChatModerationStore
  targetHandle: string
}) {
  const room = await findRoomBySlug(roomSlug, store)
  const actorMembership = await store.chatRoomMember.findUnique({
    select: memberSelect,
    where: { roomId_userId: { roomId: room.id, userId: identity.userId } },
  })
  assertRoomPermission(action, identity, actorMembership, room)
  const profile = await findProfile(targetHandle, store)
  const membership = await store.chatRoomMember.findUnique({
    select: memberSelect,
    where: { roomId_userId: { roomId: room.id, userId: profile.userId } },
  })

  if (!membership || membership.status !== "ACTIVE") {
    throw new ChatModerationError("That chat member is not active in this room.", "not-found")
  }

  if (profile.userId === identity.userId) {
    throw new ChatModerationError("You cannot moderate your own room membership.", "invalid-request")
  }

  if (
    identity.role !== "ADMIN" &&
    (!actorMembership || MEMBER_ROLE_RANK[membership.role] >= MEMBER_ROLE_RANK[actorMembership.role])
  ) {
    throw new ChatModerationError("You cannot moderate a member with an equal or higher room role.", "forbidden")
  }

  return { room, target: { membership, profile } }
}

function assertRoomPermission(
  action: ChatAction,
  identity: ChatIdentity,
  membership: {
    role: ChatRoomMemberRole
    status: "ACTIVE" | "LEFT" | "PENDING"
  } | null,
  room: { state: "ACTIVE" | "ARCHIVED" | "READ_ONLY" | "SUSPENDED" }
) {
  if (
    !canPerformChatAction(action, {
      chatEnabled: true,
      emailVerified: true,
      globalRole: identity.role,
      roomMemberStatus: membership?.status,
      roomRole: membership?.role,
      roomState: room.state,
    })
  ) {
    throw new ChatModerationError("You cannot perform that room action.", "forbidden")
  }
}

async function findRoomById(id: string, store: ChatModerationStore) {
  const room = await store.chatRoom.findUnique({ select: roomSelect, where: { id } })

  if (!room) {
    throw new ChatModerationError("That chat room was not found.", "not-found")
  }

  return room
}

async function findRoomBySlug(slug: string, store: ChatModerationStore) {
  const room = await store.chatRoom.findUnique({
    select: roomSelect,
    where: { slug: normalizeChatRoomSlug(slug) },
  })

  if (!room) {
    throw new ChatModerationError("That chat room was not found.", "not-found")
  }

  return room
}

async function findProfile(handle: string, store: ChatModerationStore) {
  const profile = await store.chatProfile.findUnique({
    select: profileSelect,
    where: { handleNormalized: normalizeChatHandle(handle) },
  })

  if (!profile) {
    throw new ChatModerationError("That chat handle was not found.", "not-found")
  }

  return profile
}

async function writeAudit(
  store: ChatModerationStore,
  input: {
    action: string
    actorUserId: string
    messageId?: string | null
    metadata?: Record<string, unknown>
    reason?: string | null
    roomId?: string | null
    targetUserId?: string | null
  }
) {
  await store.chatAuditLog.create({
    data: {
      action: input.action,
      actorUserId: input.actorUserId,
      messageId: input.messageId ?? null,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
      reason: input.reason ?? null,
      roomId: input.roomId ?? null,
      targetUserId: input.targetUserId ?? null,
    },
    select: { id: true },
  })
}

function inTransaction<T>(
  store: ChatModerationStore,
  work: (transaction: ChatModerationStore) => Promise<T>
) {
  const transaction = (
    store as unknown as {
      $transaction?: (callback: (transaction: ChatModerationStore) => Promise<T>) => Promise<T>
    }
  ).$transaction

  return transaction ? transaction(work) : work(store)
}

function optionalIdentifier(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null
  }

  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(value.trim())) {
    throw new ChatModerationError("Report input is invalid.", "invalid-request")
  }

  return value.trim()
}

function optionalText(value: unknown, maxLength: number) {
  if (value === undefined || value === null || value === "") {
    return null
  }

  return boundedText(value, maxLength)
}

function optionalBoundedText(value: unknown, maxLength: number) {
  if (value === undefined || value === null || value === "") {
    return null
  }

  return boundedText(value, maxLength)
}

function boundedText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    throw new ChatModerationError("Moderation input is invalid.", "invalid-request")
  }

  const normalized = value.trim()
  if (
    !normalized ||
    normalized.length > maxLength ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(normalized)
  ) {
    throw new ChatModerationError("Moderation input is invalid.", "invalid-request")
  }

  return normalized
}

function parseDurationSeconds(value: unknown) {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 30 ||
    value > 30 * 24 * 60 * 60
  ) {
    throw new ChatModerationError("Moderation duration is invalid.", "invalid-request")
  }

  return value
}

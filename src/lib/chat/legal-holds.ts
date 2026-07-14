import type { PrismaClient } from "@/generated/prisma/client"

import { getPrisma } from "@/lib/db"

export const CHAT_LEGAL_HOLD_SUBJECT_TYPES = [
  "CHAT_AUDIT_LOG",
  "CHAT_MESSAGE",
  "CHAT_REPORT",
] as const

const MAX_REASON_LENGTH = 500
const MAX_SUBJECT_ID_LENGTH = 128
const MAX_REVIEW_WINDOW_MS = 90 * 24 * 60 * 60 * 1_000
export const DEFAULT_CHAT_LEGAL_HOLD_REVIEW_WINDOW_MS = 89 * 24 * 60 * 60 * 1_000

export type ChatLegalHoldSubjectType = (typeof CHAT_LEGAL_HOLD_SUBJECT_TYPES)[number]

export type ChatLegalHoldStore = Pick<PrismaClient, "chatAuditLog" | "chatLegalHold">

export type ChatLegalHoldIdentity = {
  role: "ADMIN" | "USER"
  userId: string
}

export class ChatLegalHoldError extends Error {
  constructor(
    message: string,
    readonly code: "active" | "forbidden" | "invalid-request" | "not-found"
  ) {
    super(message)
    this.name = "ChatLegalHoldError"
  }
}

export type CreateChatLegalHoldInput = {
  reason: string
  reviewAt: Date
  subjectId: string
  subjectType: ChatLegalHoldSubjectType
}

export function parseCreateChatLegalHoldInput(
  value: unknown,
  now = new Date()
): CreateChatLegalHoldInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ChatLegalHoldError("Legal hold input is invalid.", "invalid-request")
  }

  const input = value as Record<string, unknown>
  const allowedKeys = new Set(["reason", "reviewAt", "subjectId", "subjectType"])

  if (
    Object.keys(input).some((key) => !allowedKeys.has(key)) ||
    typeof input.reason !== "string" ||
    typeof input.reviewAt !== "string" ||
    typeof input.subjectId !== "string" ||
    !CHAT_LEGAL_HOLD_SUBJECT_TYPES.includes(input.subjectType as ChatLegalHoldSubjectType)
  ) {
    throw new ChatLegalHoldError("Legal hold input is invalid.", "invalid-request")
  }

  const reason = input.reason.trim()
  const subjectId = input.subjectId.trim()
  const reviewAt = new Date(input.reviewAt)

  if (!reason || reason.length > MAX_REASON_LENGTH || !subjectId || subjectId.length > MAX_SUBJECT_ID_LENGTH) {
    throw new ChatLegalHoldError("Legal hold input is invalid.", "invalid-request")
  }

  assertValidReviewDate(reviewAt, now)

  return {
    reason,
    reviewAt,
    subjectId,
    subjectType: input.subjectType as ChatLegalHoldSubjectType,
  }
}

export function parseChatLegalHoldUpdateInput(value: unknown, now = new Date()) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ChatLegalHoldError("Legal hold update is invalid.", "invalid-request")
  }

  const input = value as Record<string, unknown>

  if (input.action === "release" && Object.keys(input).length === 1) {
    return { action: "release" as const }
  }

  if (input.action === "review" && Object.keys(input).length === 1) {
    return { action: "review" as const }
  }

  if (
    input.action === "review" &&
    Object.keys(input).length === 2 &&
    typeof input.reviewAt === "string"
  ) {
    const reviewAt = new Date(input.reviewAt)
    assertValidReviewDate(reviewAt, now)
    return { action: "review" as const, reviewAt }
  }

  throw new ChatLegalHoldError("Legal hold update is invalid.", "invalid-request")
}

export async function createChatLegalHold({
  identity,
  input,
  store = getPrisma(),
}: {
  identity: ChatLegalHoldIdentity
  input: CreateChatLegalHoldInput
  store?: ChatLegalHoldStore
}) {
  assertAdmin(identity)

  const activeHold = await store.chatLegalHold.findFirst({
    select: { id: true },
    where: {
      releasedAt: null,
      subjectId: input.subjectId,
      subjectType: input.subjectType,
    },
  })

  if (activeHold) {
    throw new ChatLegalHoldError("That record already has an active legal hold.", "active")
  }

  const hold = await store.chatLegalHold.create({
    data: {
      authorizedByUserId: identity.userId,
      reason: input.reason,
      reviewAt: input.reviewAt,
      subjectId: input.subjectId,
      subjectType: input.subjectType,
    },
    select: legalHoldSelect,
  })

  await writeLegalHoldAudit(store, {
    action: "CHAT_LEGAL_HOLD_CREATED",
    actorUserId: identity.userId,
    hold,
  })

  return hold
}

export async function listActiveChatLegalHolds({
  identity,
  now = new Date(),
  store = getPrisma(),
}: {
  identity: ChatLegalHoldIdentity
  now?: Date
  store?: ChatLegalHoldStore
}) {
  assertAdmin(identity)

  return store.chatLegalHold.findMany({
    orderBy: [{ reviewAt: "asc" }, { createdAt: "asc" }],
    select: legalHoldSelect,
    where: { releasedAt: null },
  }).then((holds) => holds.map((hold) => ({ ...hold, reviewDue: hold.reviewAt <= now })))
}

export async function updateChatLegalHold({
  holdId,
  identity,
  input,
  now = new Date(),
  store = getPrisma(),
}: {
  holdId: string
  identity: ChatLegalHoldIdentity
  input: ReturnType<typeof parseChatLegalHoldUpdateInput>
  now?: Date
  store?: ChatLegalHoldStore
}) {
  assertAdmin(identity)
  const existing = await store.chatLegalHold.findUnique({
    select: legalHoldSelect,
    where: { id: holdId },
  })

  if (!existing || existing.releasedAt) {
    throw new ChatLegalHoldError("That legal hold was not found.", "not-found")
  }

  const hold = await store.chatLegalHold.update({
    data:
      input.action === "release"
        ? { releasedAt: now }
        : {
            reviewAt:
              "reviewAt" in input
                ? input.reviewAt
                : new Date(now.getTime() + DEFAULT_CHAT_LEGAL_HOLD_REVIEW_WINDOW_MS),
          },
    select: legalHoldSelect,
    where: { id: existing.id },
  })

  await writeLegalHoldAudit(store, {
    action: input.action === "release" ? "CHAT_LEGAL_HOLD_RELEASED" : "CHAT_LEGAL_HOLD_REVIEWED",
    actorUserId: identity.userId,
    hold,
  })

  return hold
}

const legalHoldSelect = {
  authorizedByUserId: true,
  createdAt: true,
  id: true,
  reason: true,
  releasedAt: true,
  reviewAt: true,
  startedAt: true,
  subjectId: true,
  subjectType: true,
} as const

function assertAdmin(identity: ChatLegalHoldIdentity) {
  if (identity.role !== "ADMIN") {
    throw new ChatLegalHoldError("Administrator access is required.", "forbidden")
  }
}

function assertValidReviewDate(reviewAt: Date, now: Date) {
  if (
    !Number.isFinite(reviewAt.getTime()) ||
    reviewAt <= now ||
    reviewAt.getTime() > now.getTime() + MAX_REVIEW_WINDOW_MS
  ) {
    throw new ChatLegalHoldError(
      "The legal hold review date must be within the next 90 days.",
      "invalid-request"
    )
  }
}

async function writeLegalHoldAudit(
  store: Pick<ChatLegalHoldStore, "chatAuditLog">,
  {
    action,
    actorUserId,
    hold,
  }: {
    action: "CHAT_LEGAL_HOLD_CREATED" | "CHAT_LEGAL_HOLD_RELEASED" | "CHAT_LEGAL_HOLD_REVIEWED"
    actorUserId: string
    hold: {
      id: string
      reviewAt: Date
      subjectId: string
      subjectType: ChatLegalHoldSubjectType
    }
  }
) {
  await store.chatAuditLog.create({
    data: {
      action,
      actorUserId,
      metadata: {
        holdId: hold.id,
        reviewAt: hold.reviewAt.toISOString(),
        subjectId: hold.subjectId,
        subjectType: hold.subjectType,
      },
    },
  })
}

import type { PrismaClient } from "@/generated/prisma/client"

import { getPrisma } from "@/lib/db"

export type ChatBetaAccessStore = Pick<
  PrismaClient,
  "chatAuditLog" | "chatBetaAccess" | "user"
>

export class ChatBetaAccessError extends Error {
  constructor(
    message: string,
    readonly code: "invalid-email" | "user-not-found"
  ) {
    super(message)
    this.name = "ChatBetaAccessError"
  }
}

export function normalizeChatBetaEmail(value: string) {
  const email = value.trim().toLowerCase()

  if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ChatBetaAccessError("A valid email address is required.", "invalid-email")
  }

  return email
}

export async function hasActiveChatBetaAccess(
  userId: string,
  store: Pick<ChatBetaAccessStore, "chatBetaAccess"> = getPrisma()
) {
  const access = await store.chatBetaAccess.findFirst({
    select: { id: true },
    where: { revokedAt: null, userId },
  })

  return Boolean(access)
}

export async function grantChatBetaAccess({
  email,
  note,
  store = getPrisma(),
}: {
  email: string
  note?: string
  store?: ChatBetaAccessStore
}) {
  const normalizedEmail = normalizeChatBetaEmail(email)
  const normalizedNote = note?.trim() || undefined

  if (normalizedNote && normalizedNote.length > 500) {
    throw new ChatBetaAccessError("The beta access note is too long.", "invalid-email")
  }

  const user = await store.user.findUnique({
    select: { id: true },
    where: { email: normalizedEmail },
  })

  if (!user) {
    throw new ChatBetaAccessError("No Arctic RSS account has that email address.", "user-not-found")
  }

  const existing = await store.chatBetaAccess.findUnique({
    select: { revokedAt: true },
    where: { userId: user.id },
  })

  if (existing && !existing.revokedAt) {
    return { status: "already-granted" as const }
  }

  await store.chatBetaAccess.upsert({
    create: { note: normalizedNote, userId: user.id },
    update: { note: normalizedNote, revokedAt: null },
    where: { userId: user.id },
  })
  await store.chatAuditLog.create({
    data: {
      action: existing ? "chat_beta_access_restored" : "chat_beta_access_granted",
      metadata: { source: "operator-cli" },
      targetUserId: user.id,
    },
  })

  return { status: existing ? ("restored" as const) : ("granted" as const) }
}

export async function revokeChatBetaAccess({
  email,
  store = getPrisma(),
}: {
  email: string
  store?: ChatBetaAccessStore
}) {
  const normalizedEmail = normalizeChatBetaEmail(email)
  const user = await store.user.findUnique({
    select: { id: true },
    where: { email: normalizedEmail },
  })

  if (!user) {
    throw new ChatBetaAccessError("No Arctic RSS account has that email address.", "user-not-found")
  }

  const existing = await store.chatBetaAccess.findUnique({
    select: { revokedAt: true },
    where: { userId: user.id },
  })

  if (!existing || existing.revokedAt) {
    return { status: "not-granted" as const }
  }

  await store.chatBetaAccess.update({
    data: { revokedAt: new Date() },
    where: { userId: user.id },
  })
  await store.chatAuditLog.create({
    data: {
      action: "chat_beta_access_revoked",
      metadata: { source: "operator-cli" },
      targetUserId: user.id,
    },
  })

  return { status: "revoked" as const }
}

import type { PrismaClient } from "@/generated/prisma/client"

import { getPrisma } from "@/lib/db"

import { normalizeChatHandle } from "./normalization"

export type ChatBlockStore = Pick<PrismaClient, "chatBlock" | "chatProfile">

export class ChatBlockError extends Error {
  constructor(
    message: string,
    readonly code: "invalid-request" | "not-found"
  ) {
    super(message)
    this.name = "ChatBlockError"
  }
}

export async function ignoreChatHandle({
  handle,
  store = getPrisma(),
  userId,
}: {
  handle: string
  store?: ChatBlockStore
  userId: string
}) {
  const normalizedHandle = normalizeChatHandle(handle)
  const target = await store.chatProfile.findUnique({
    select: { handle: true, userId: true },
    where: { handleNormalized: normalizedHandle },
  })

  if (!target) {
    throw new ChatBlockError("That chat handle was not found.", "not-found")
  }

  if (target.userId === userId) {
    throw new ChatBlockError("You cannot ignore your own chat handle.", "invalid-request")
  }

  await store.chatBlock.upsert({
    create: { blockedUserId: target.userId, blockerUserId: userId },
    update: {},
    where: {
      blockerUserId_blockedUserId: {
        blockedUserId: target.userId,
        blockerUserId: userId,
      },
    },
  })

  return { handle: target.handle }
}

export async function unignoreChatHandle({
  handle,
  store = getPrisma(),
  userId,
}: {
  handle: string
  store?: ChatBlockStore
  userId: string
}) {
  const normalizedHandle = normalizeChatHandle(handle)
  const target = await store.chatProfile.findUnique({
    select: { handle: true, userId: true },
    where: { handleNormalized: normalizedHandle },
  })

  if (!target) {
    throw new ChatBlockError("That chat handle was not found.", "not-found")
  }

  await store.chatBlock.deleteMany({
    where: { blockedUserId: target.userId, blockerUserId: userId },
  })

  return { handle: target.handle }
}

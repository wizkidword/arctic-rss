import type { PrismaClient } from "@/generated/prisma/client"

import { getPrisma } from "@/lib/db"

import { ChatNormalizationError, normalizeChatHandle } from "./normalization"

const chatProfileSelect = {
  handle: true,
  handleNormalized: true,
  id: true,
  personalizedDiscovery: true,
  userId: true,
} as const

const chatProfileWithHandleChangeSelect = {
  ...chatProfileSelect,
  handleChangedAt: true,
} as const

const HANDLE_CHANGE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1_000

export type ChatProfile = {
  handle: string
  handleNormalized: string
  id: string
  personalizedDiscovery: boolean
  userId: string
}

export function parsePersonalizedDiscoveryInput(value: unknown) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== 1 ||
    typeof (value as { enabled?: unknown }).enabled !== "boolean"
  ) {
    throw new ChatProfileError("Discovery preference input is invalid.", "profile-exists")
  }

  return (value as { enabled: boolean }).enabled
}

export type ChatProfileStore = Pick<PrismaClient, "chatProfile">

export class ChatProfileError extends Error {
  constructor(
    message: string,
    readonly code: "handle-change-cooldown" | "handle-unavailable" | "profile-exists"
  ) {
    super(message)
    this.name = "ChatProfileError"
  }
}

export function parseChatProfileHandle(value: unknown) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== 1 ||
    typeof (value as { handle?: unknown }).handle !== "string"
  ) {
    throw new ChatNormalizationError("Provide a chat handle.")
  }

  const handle = (value as { handle: string }).handle

  if (handle.length > 64) {
    throw new ChatNormalizationError("That chat handle is too long.")
  }

  return normalizeChatHandle(handle)
}

export async function getChatProfileForUser(
  userId: string,
  store: ChatProfileStore = getPrisma()
) {
  return store.chatProfile.findUnique({
    select: chatProfileSelect,
    where: { userId },
  })
}

export async function createChatProfileForUser({
  handle,
  store = getPrisma(),
  userId,
}: {
  handle: string
  store?: ChatProfileStore
  userId: string
}): Promise<{ created: boolean; profile: ChatProfile }> {
  const normalizedHandle = normalizeChatHandle(handle)
  const existing = await getChatProfileForUser(userId, store)

  if (existing) {
    return { created: false, profile: existing }
  }

  try {
    const profile = await store.chatProfile.create({
      data: {
        handle: normalizedHandle,
        handleNormalized: normalizedHandle,
        userId,
      },
      select: chatProfileSelect,
    })

    return { created: true, profile }
  } catch (error) {
    const concurrentProfile = await getChatProfileForUser(userId, store)

    if (concurrentProfile) {
      return { created: false, profile: concurrentProfile }
    }

    if (isUniqueConstraintError(error)) {
      throw new ChatProfileError(
        "That chat handle is not available.",
        "handle-unavailable"
      )
    }

    throw error
  }
}

export async function changeChatProfileHandle({
  handle,
  now = new Date(),
  store = getPrisma(),
  userId,
}: {
  handle: string
  now?: Date
  store?: ChatProfileStore
  userId: string
}): Promise<ChatProfile> {
  const normalizedHandle = normalizeChatHandle(handle)
  const profile = await store.chatProfile.findUnique({
    select: chatProfileWithHandleChangeSelect,
    where: { userId },
  })

  if (!profile) {
    throw new ChatProfileError("Create a chat profile before changing your handle.", "profile-exists")
  }

  if (
    profile.handleChangedAt &&
    now.getTime() - profile.handleChangedAt.getTime() < HANDLE_CHANGE_COOLDOWN_MS
  ) {
    throw new ChatProfileError(
      "Chat handles can be changed once every 30 days.",
      "handle-change-cooldown"
    )
  }

  if (profile.handleNormalized === normalizedHandle) {
    return {
      handle: profile.handle,
      handleNormalized: profile.handleNormalized,
      id: profile.id,
      personalizedDiscovery: profile.personalizedDiscovery,
      userId: profile.userId,
    }
  }

  try {
    return await store.chatProfile.update({
      data: {
        handle: normalizedHandle,
        handleChangedAt: now,
        handleNormalized: normalizedHandle,
      },
      select: chatProfileSelect,
      where: { userId },
    })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ChatProfileError("That chat handle is not available.", "handle-unavailable")
    }

    throw error
  }
}

export async function updateChatPersonalizedDiscovery({
  enabled,
  store = getPrisma(),
  userId,
}: {
  enabled: boolean
  store?: ChatProfileStore
  userId: string
}) {
  const profile = await store.chatProfile.findUnique({
    select: { id: true },
    where: { userId },
  })

  if (!profile) {
    throw new ChatProfileError("Create a chat profile before updating discovery settings.", "profile-exists")
  }

  return store.chatProfile.update({
    data: { personalizedDiscovery: enabled },
    select: { personalizedDiscovery: true },
    where: { userId },
  })
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  )
}

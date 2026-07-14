import type { PrismaClient } from "@/generated/prisma/client"

import { shouldBlockLoginForUnverifiedEmail } from "@/lib/email-verification-policy"

import {
  ChatConnectionTokenError,
  verifyChatConnectionToken,
} from "./session-token"
import {
  ChatTokenReplayError,
  type ChatTokenReplayStore,
  consumeChatConnectionToken,
} from "./token-replay"

const gatewayUserSelect = {
  authVersion: true,
  chatProfile: {
    select: {
      handle: true,
      handleNormalized: true,
      id: true,
    },
  },
  disabledAt: true,
  emailVerified: true,
  id: true,
  plan: true,
  role: true,
} as const

export type ChatGatewayUserStore = Pick<PrismaClient, "user">

export type ChatGatewayIdentity = {
  handle: string
  profileId: string
  role: "USER" | "ADMIN"
  userId: string
}

export class ChatGatewayAuthenticationError extends Error {
  constructor(readonly code: "invalid" | "replayed" | "unavailable") {
    super("Chat gateway authentication failed.")
    this.name = "ChatGatewayAuthenticationError"
  }
}

export async function authenticateChatGatewayConnection({
  expectedOrigin,
  origin,
  replayStore,
  store,
  token,
  tokenSecret,
}: {
  expectedOrigin: string
  origin: string | undefined
  replayStore: ChatTokenReplayStore
  store: ChatGatewayUserStore
  token: unknown
  tokenSecret: string
}): Promise<ChatGatewayIdentity> {
  if (origin !== expectedOrigin || typeof token !== "string") {
    throw new ChatGatewayAuthenticationError("invalid")
  }

  let payload: ReturnType<typeof verifyChatConnectionToken>

  try {
    payload = verifyChatConnectionToken(token, { secret: tokenSecret })
  } catch (error) {
    if (error instanceof ChatConnectionTokenError) {
      throw new ChatGatewayAuthenticationError("invalid")
    }

    throw error
  }

  const user = await store.user.findUnique({
    select: gatewayUserSelect,
    where: { id: payload.userId },
  })

  if (
    !user ||
    user.disabledAt ||
    shouldBlockLoginForUnverifiedEmail(user.emailVerified) ||
    user.authVersion !== payload.authVersion ||
    user.plan !== payload.plan ||
    user.role !== payload.role ||
    !user.chatProfile ||
    user.chatProfile.id !== payload.profileId ||
    user.chatProfile.handle !== payload.handle
  ) {
    throw new ChatGatewayAuthenticationError("invalid")
  }

  try {
    await consumeChatConnectionToken(payload, replayStore)
  } catch (error) {
    if (error instanceof ChatTokenReplayError) {
      throw new ChatGatewayAuthenticationError(error.code)
    }

    throw error
  }

  return {
    handle: user.chatProfile.handle,
    profileId: user.chatProfile.id,
    role: user.role,
    userId: user.id,
  }
}

import type { PrismaClient } from "@/generated/prisma/client"

import { shouldBlockLoginForUnverifiedEmail } from "@/lib/email-verification-policy"

import { getChatFeatureFlags, type ChatFeatureFlagEnvironment } from "./feature-flags"
import { ARCTICIRC_POLICY_VERSION } from "./policy-acceptance"
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
  chatBetaAccess: {
    select: { revokedAt: true },
  },
  chatProfile: {
    select: {
      handle: true,
      handleNormalized: true,
      id: true,
    },
  },
  chatPolicyAcceptance: {
    select: { policyVersion: true },
  },
  disabledAt: true,
  emailVerified: true,
  id: true,
  plan: true,
  role: true,
} as const

export type ChatGatewayUserStore = Pick<PrismaClient, "user">

type GatewayAuthorizationUser = {
  authVersion: number
  chatBetaAccess: { revokedAt: Date | null } | null
  chatPolicyAcceptance: { policyVersion: string } | null
  chatProfile: { handle: string; handleNormalized: string; id: string } | null
  disabledAt: Date | null
  emailVerified: Date | null
  id: string
  plan: "FREE" | "PRO" | "ADMIN"
  role: "USER" | "ADMIN"
}

export type ChatGatewayIdentity = {
  authVersion: number
  authorizedAt: string
  chatEnabled: true
  emailVerified: true
  handle: string
  plan: "FREE" | "PRO" | "ADMIN"
  policyVersion: string
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
  environment = process.env,
  expectedOrigin,
  now = new Date(),
  origin,
  replayStore,
  store,
  token,
  tokenSecret,
}: {
  environment?: ChatFeatureFlagEnvironment
  expectedOrigin: string
  now?: Date
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

  if (!user || !isCurrentGatewayAuthorization({ environment, identity: payload, user })) {
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

  const profile = user.chatProfile
  if (!profile) {
    throw new ChatGatewayAuthenticationError("invalid")
  }

  return {
    authVersion: user.authVersion,
    authorizedAt: now.toISOString(),
    chatEnabled: true,
    emailVerified: true,
    handle: profile.handle,
    plan: user.plan,
    policyVersion: ARCTICIRC_POLICY_VERSION,
    profileId: profile.id,
    role: user.role,
    userId: user.id,
  }
}

export async function revalidateChatGatewayAuthorization({
  environment = process.env,
  identity,
  now = new Date(),
  store,
}: {
  environment?: ChatFeatureFlagEnvironment
  identity: ChatGatewayIdentity
  now?: Date
  store: ChatGatewayUserStore
}): Promise<ChatGatewayIdentity> {
  const user = await store.user.findUnique({
    select: gatewayUserSelect,
    where: { id: identity.userId },
  })

  if (!user || !isCurrentGatewayAuthorization({ environment, identity, user })) {
    throw new ChatGatewayAuthenticationError("invalid")
  }

  return { ...identity, authorizedAt: now.toISOString() }
}

function isCurrentGatewayAuthorization({
  environment,
  identity,
  user,
}: {
  environment: ChatFeatureFlagEnvironment
  identity: {
    authVersion: number
    handle: string
    plan: "FREE" | "PRO" | "ADMIN"
    policyVersion?: string
    profileId: string
    role: "USER" | "ADMIN"
  }
  user: GatewayAuthorizationUser
}) {
  const flags = getChatFeatureFlags(environment)
  const betaEligible =
    !flags.betaAllowlistEnabled || Boolean(user.chatBetaAccess && !user.chatBetaAccess.revokedAt)
  const policyEligible = user.chatPolicyAcceptance?.policyVersion === ARCTICIRC_POLICY_VERSION

  return (
    flags.enabled &&
    betaEligible &&
    policyEligible &&
    !user.disabledAt &&
    !shouldBlockLoginForUnverifiedEmail(user.emailVerified) &&
    user.authVersion === identity.authVersion &&
    user.plan === identity.plan &&
    user.role === identity.role &&
    !!user.chatProfile &&
    user.chatProfile.id === identity.profileId &&
    user.chatProfile.handle === identity.handle &&
    (identity.policyVersion === undefined || identity.policyVersion === ARCTICIRC_POLICY_VERSION)
  )
}

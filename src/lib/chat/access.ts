import type { Session } from "next-auth"

import { requireFreshUser } from "@/lib/authorization"
import { getAppOrigin } from "@/lib/app-origin"
import { getPrisma } from "@/lib/db"
import { shouldBlockLoginForUnverifiedEmail } from "@/lib/email-verification-policy"

import { hasActiveChatBetaAccess, type ChatBetaAccessStore } from "./beta-access"
import { getChatFeatureFlags, isChatEnabled, type ChatFeatureFlagEnvironment } from "./feature-flags"
import {
  hasCurrentChatPolicyAcceptance,
  type ChatPolicyAcceptanceStore,
} from "./policy-acceptance"

type ChatAccessStore = ChatBetaAccessStore & ChatPolicyAcceptanceStore

export class ChatAccessError extends Error {
  constructor(
    message: string,
    readonly code:
      | "beta-access-required"
      | "chat-disabled"
      | "email-unverified"
      | "invalid-origin"
      | "policy-acceptance-required"
  ) {
    super(message)
    this.name = "ChatAccessError"
  }
}

export async function requireChatEligibleUser({
  environment = process.env,
  mutationRequest,
  requirePolicyAcceptance = true,
  session,
  store,
}: {
  environment?: ChatFeatureFlagEnvironment
  mutationRequest?: Request
  requirePolicyAcceptance?: boolean
  session?: Session
  store?: ChatAccessStore
} = {}) {
  if (!isChatEnabled(environment)) {
    throw new ChatAccessError("Chat is not available.", "chat-disabled")
  }

  if (mutationRequest) {
    assertChatMutationOrigin(mutationRequest, environment)
  }

  const user = await requireFreshUser(session)

  if (shouldBlockLoginForUnverifiedEmail(user.emailVerified)) {
    throw new ChatAccessError(
      "Verify your email before using chat.",
      "email-unverified"
    )
  }

  if (
    getChatFeatureFlags(environment).betaAllowlistEnabled &&
    !(await hasActiveChatBetaAccess(user.id, store ?? getPrisma()))
  ) {
    throw new ChatAccessError(
      "Chat is currently limited to invited private-beta participants.",
      "beta-access-required"
    )
  }

  if (
    requirePolicyAcceptance &&
    !(await hasCurrentChatPolicyAcceptance(user.id, store ?? getPrisma()))
  ) {
    throw new ChatAccessError(
      "Accept the ArcticIRC policies and confirm that you are at least 18 before using chat.",
      "policy-acceptance-required"
    )
  }

  return user
}

export function assertChatMutationOrigin(
  request: Request,
  environment: ChatFeatureFlagEnvironment = process.env
) {
  const origin = request.headers.get("origin")
  const expected = getAppOrigin(environment).origin

  if (origin !== expected) {
    throw new ChatAccessError("Chat requests must use the application origin.", "invalid-origin")
  }
}

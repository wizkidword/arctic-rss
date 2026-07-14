import type { PrismaClient } from "@/generated/prisma/client"

import { getPrisma } from "@/lib/db"

export const ARCTICIRC_POLICY_VERSION = "launch-policy-v1"

export type ChatPolicyAcceptanceStore = Pick<
  PrismaClient,
  "chatAuditLog" | "chatPolicyAcceptance"
>

export class ChatPolicyAcceptanceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ChatPolicyAcceptanceError"
  }
}

type PolicyAcceptanceInput = {
  acceptCommunityGuidelines: boolean
  acceptPrivacyPolicy: boolean
  acceptTerms: boolean
  attestAdult: boolean
}

export function parseChatPolicyAcceptance(value: unknown): PolicyAcceptanceInput {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== 4
  ) {
    throw new ChatPolicyAcceptanceError("All ArcticIRC activation confirmations are required.")
  }

  const input = value as Partial<PolicyAcceptanceInput>

  if (
    input.attestAdult !== true ||
    input.acceptTerms !== true ||
    input.acceptPrivacyPolicy !== true ||
    input.acceptCommunityGuidelines !== true
  ) {
    throw new ChatPolicyAcceptanceError("All ArcticIRC activation confirmations are required.")
  }

  return {
    acceptCommunityGuidelines: true,
    acceptPrivacyPolicy: true,
    acceptTerms: true,
    attestAdult: true,
  }
}

export async function hasCurrentChatPolicyAcceptance(
  userId: string,
  store: Pick<ChatPolicyAcceptanceStore, "chatPolicyAcceptance"> = getPrisma()
) {
  const acceptance = await store.chatPolicyAcceptance.findUnique({
    select: { policyVersion: true },
    where: { userId },
  })

  return acceptance?.policyVersion === ARCTICIRC_POLICY_VERSION
}

export async function acceptChatPolicy({
  store = getPrisma(),
  userId,
}: {
  store?: ChatPolicyAcceptanceStore
  userId: string
}) {
  const acceptedAt = new Date()

  await store.chatPolicyAcceptance.upsert({
    create: {
      acceptedAt,
      ageAttestedAt: acceptedAt,
      communityAcceptedAt: acceptedAt,
      policyVersion: ARCTICIRC_POLICY_VERSION,
      privacyAcceptedAt: acceptedAt,
      termsAcceptedAt: acceptedAt,
      userId,
    },
    update: {
      acceptedAt,
      ageAttestedAt: acceptedAt,
      communityAcceptedAt: acceptedAt,
      policyVersion: ARCTICIRC_POLICY_VERSION,
      privacyAcceptedAt: acceptedAt,
      termsAcceptedAt: acceptedAt,
    },
    where: { userId },
  })
  await store.chatAuditLog.create({
    data: {
      action: "chat_policy_accepted",
      metadata: { policyVersion: ARCTICIRC_POLICY_VERSION },
      targetUserId: userId,
    },
  })
}

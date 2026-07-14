import { createHash } from "node:crypto"

import type { PrismaClient } from "@/generated/prisma/client"

import { getPrisma } from "@/lib/db"
import { ARCTICIRC_POLICY_VERSION } from "@/lib/chat/policy-acceptance"
import { verifyPassword } from "@/lib/password"

export const ACCOUNT_DELETION_CONFIRMATION = "DELETE"
export const ACCOUNT_DELETION_SUPPORT_EMAIL = "support@arcticrss.com"

export type AccountDeletionStore = Pick<
  PrismaClient,
  "$transaction" | "accountDeletionRecord" | "user"
>

export class AccountDeletionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AccountDeletionError"
  }
}

export function parseAccountDeletionConfirmation(value: unknown) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== 2 ||
    (value as { confirmation?: unknown }).confirmation !== ACCOUNT_DELETION_CONFIRMATION ||
    typeof (value as { currentPassword?: unknown }).currentPassword !== "string" ||
    !(value as { currentPassword: string }).currentPassword
  ) {
    throw new AccountDeletionError(
      "Type DELETE and enter your current password to confirm account deletion."
    )
  }

  return value as { confirmation: typeof ACCOUNT_DELETION_CONFIRMATION; currentPassword: string }
}

export async function requireAccountDeletionReauthentication({
  currentPassword,
  store = getPrisma(),
  userId,
  verify = verifyPassword,
}: {
  currentPassword: string
  store?: Pick<PrismaClient, "user">
  userId: string
  verify?: typeof verifyPassword
}) {
  const user = await store.user.findUnique({
    select: { authVersion: true, passwordHash: true },
    where: { id: userId },
  })

  if (!user?.passwordHash || !(await verify(currentPassword, user.passwordHash))) {
    throw new AccountDeletionError(
      `Re-enter your current password to delete this account. If you only sign in with Google, request deletion at ${ACCOUNT_DELETION_SUPPORT_EMAIL}.`
    )
  }

  return { authVersion: user.authVersion }
}

export function getDeletionSubjectReference(userId: string) {
  return createHash("sha256").update(`arcticrss-account-deletion:${userId}`).digest("hex")
}

export async function deleteAccount({
  now = new Date(),
  store = getPrisma(),
  expectedAuthVersion,
  userId,
}: {
  expectedAuthVersion: number
  now?: Date
  store?: AccountDeletionStore
  userId: string
}) {
  const subjectReference = getDeletionSubjectReference(userId)

  await store.$transaction(async (transaction) => {
    await transaction.accountDeletionRecord.upsert({
      create: {
        completedAt: now,
        policyVersion: ARCTICIRC_POLICY_VERSION,
        requestedAt: now,
        subjectReference,
      },
      update: { completedAt: now, policyVersion: ARCTICIRC_POLICY_VERSION },
      where: { subjectReference },
    })
    const result = await transaction.user.deleteMany({
      where: { authVersion: expectedAuthVersion, id: userId },
    })
    if (result.count !== 1) {
      throw new AccountDeletionError("Your account changed. Sign in again before deleting it.")
    }
  })
}

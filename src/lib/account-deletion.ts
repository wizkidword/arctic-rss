import { createHash, randomBytes } from "node:crypto"

import type { PrismaClient } from "@/generated/prisma/client"

import { getAppOrigin } from "@/lib/app-origin"
import { getPrisma } from "@/lib/db"
import { ACCOUNT_DELETION_POLICY_VERSION } from "@/lib/legal-policy-versions"
import { sendAccountDeletionConfirmationEmail } from "@/lib/mail"
import { notifyAccountSecurityChange } from "@/lib/chat/security-events"
import { verifyPassword } from "@/lib/password"

export const ACCOUNT_DELETION_CONFIRMATION = "DELETE"
export const ACCOUNT_DELETION_SUPPORT_EMAIL = "support@arcticrss.com"
export const ACCOUNT_DELETION_TOKEN_PURPOSE = "ACCOUNT_DELETION"

const ACCOUNT_DELETION_CONFIRMATION_TOKEN_BYTES = 32
const ACCOUNT_DELETION_CONFIRMATION_TOKEN_TTL_MS = 15 * 60 * 1000
const INVALID_CONFIRMATION_MESSAGE =
  "This deletion confirmation is invalid or expired. Request a new one from Settings."

export type AccountDeletionStore = Pick<
  PrismaClient,
  "$transaction" | "accountDeletionConfirmationToken" | "accountDeletionRecord" | "user"
>

type AccountDeletionTransactionStore = Pick<
  PrismaClient,
  "accountDeletionConfirmationToken" | "accountDeletionRecord" | "user"
>

type AccountDeletionConfirmationDependencies = {
  now?: Date
  sendConfirmationEmail?: typeof sendAccountDeletionConfirmationEmail
  store?: AccountDeletionStore
}

type OAuthAccountDeletionConfirmationToken = {
  expiresAt: Date
  tokenHash: string
}

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

export function parseOAuthAccountDeletionConfirmation(value: unknown) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== 2 ||
    (value as { confirmation?: unknown }).confirmation !== ACCOUNT_DELETION_CONFIRMATION ||
    typeof (value as { token?: unknown }).token !== "string"
  ) {
    throw new AccountDeletionError(
      "Type DELETE and use a valid account deletion confirmation link."
    )
  }

  const token = (value as { token: string }).token.trim()

  if (token.length < 32 || token.length > 512) {
    throw new AccountDeletionError(INVALID_CONFIRMATION_MESSAGE)
  }

  return { confirmation: ACCOUNT_DELETION_CONFIRMATION, token }
}

export function parseOAuthAccountDeletionHandoff(value: unknown) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== 1 ||
    typeof (value as { token?: unknown }).token !== "string"
  ) {
    throw new AccountDeletionError(INVALID_CONFIRMATION_MESSAGE)
  }

  const token = (value as { token: string }).token.trim()

  if (token.length < 32 || token.length > 512) {
    throw new AccountDeletionError(INVALID_CONFIRMATION_MESSAGE)
  }

  return { token }
}

export function parseOAuthAccountDeletionConfirmationRequest(value: unknown) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== 1 ||
    (value as { confirmation?: unknown }).confirmation !== ACCOUNT_DELETION_CONFIRMATION
  ) {
    throw new AccountDeletionError(
      "Type DELETE to request an account deletion confirmation email."
    )
  }

  return { confirmation: ACCOUNT_DELETION_CONFIRMATION }
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
      "Re-enter your current password to delete this account. If you only sign in with Google, request an email confirmation from Settings."
    )
  }

  return { authVersion: user.authVersion }
}

export function getDeletionSubjectReference(userId: string) {
  return createHash("sha256").update(`arcticrss-account-deletion:${userId}`).digest("hex")
}

export function hashAccountDeletionConfirmationToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export function createAccountDeletionConfirmationToken() {
  const token = randomBytes(ACCOUNT_DELETION_CONFIRMATION_TOKEN_BYTES).toString("base64url")

  return { token, tokenHash: hashAccountDeletionConfirmationToken(token) }
}

export function getAccountDeletionConfirmationExpiresAt(now = new Date()) {
  return new Date(now.getTime() + ACCOUNT_DELETION_CONFIRMATION_TOKEN_TTL_MS)
}

export function buildAccountDeletionConfirmationUrl(token: string) {
  const url = new URL("/delete-account", getAppOrigin().origin)

  // The fragment stays in the browser, so the secret does not reach request
  // logs, application analytics, or third-party referrers.
  return `${url.toString()}#token=${encodeURIComponent(token)}`
}

async function deleteAccountInTransaction({
  expectedAuthVersion,
  now,
  requestedAt = now,
  transaction,
  userId,
}: {
  expectedAuthVersion: number
  now: Date
  requestedAt?: Date
  transaction: AccountDeletionTransactionStore
  userId: string
}) {
  const subjectReference = getDeletionSubjectReference(userId)

  await transaction.accountDeletionRecord.upsert({
    create: {
      completedAt: now,
      policyVersion: ACCOUNT_DELETION_POLICY_VERSION,
      requestedAt,
      subjectReference,
    },
    update: { completedAt: now, policyVersion: ACCOUNT_DELETION_POLICY_VERSION },
    where: { subjectReference },
  })
  const result = await transaction.user.deleteMany({
    where: { authVersion: expectedAuthVersion, id: userId },
  })
  if (result.count !== 1) {
    throw new AccountDeletionError("Your account changed. Sign in again before deleting it.")
  }
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
  await store.$transaction((transaction) =>
    deleteAccountInTransaction({
      expectedAuthVersion,
      now,
      transaction,
      userId,
    })
  )

  await notifyAccountSecurityChange({ reason: "account_disabled", userId })
}

export async function requestOAuthAccountDeletionConfirmation(
  { userId }: { userId: string },
  dependencies: AccountDeletionConfirmationDependencies = {}
) {
  const now = dependencies.now ?? new Date()
  const store = dependencies.store ?? getPrisma()
  const { token, tokenHash } = createAccountDeletionConfirmationToken()
  let email: string

  // Lock the user row before replacing an existing confirmation. PostgreSQL
  // serializes concurrent requests for the same user, so the invalidate and
  // create operations are one reliable state transition rather than two
  // independent writes that can leave multiple usable tokens behind.
  await store.$transaction(async (transaction) => {
    const user = await transaction.user.update({
      data: { updatedAt: now },
      select: {
        authVersion: true,
        disabledAt: true,
        email: true,
        emailVerified: true,
        id: true,
        passwordHash: true,
      },
      where: { id: userId },
    })

    if (user.disabledAt || user.passwordHash || !user.emailVerified) {
      throw new AccountDeletionError(
        "Email confirmation is only available for active Google-only accounts with a verified email address."
      )
    }

    email = user.email
    await transaction.accountDeletionConfirmationToken.updateMany({
      data: { usedAt: now },
      where: { userId: user.id, usedAt: null },
    })
    await transaction.accountDeletionConfirmationToken.create({
      data: {
        authVersion: user.authVersion,
        expiresAt: getAccountDeletionConfirmationExpiresAt(now),
        purpose: ACCOUNT_DELETION_TOKEN_PURPOSE,
        tokenHash,
        userId: user.id,
      },
    })
  })

  try {
    const result = await (
      dependencies.sendConfirmationEmail ?? sendAccountDeletionConfirmationEmail
    )({
      confirmationUrl: buildAccountDeletionConfirmationUrl(token),
      to: email!,
    })

    if (result.status !== "sent") {
      throw new Error("Account deletion confirmation email is not configured.")
    }
  } catch {
    await store.accountDeletionConfirmationToken.updateMany({
      data: { usedAt: now },
      where: { tokenHash, usedAt: null },
    })
    throw new AccountDeletionError(
      `Unable to send the account deletion confirmation email. Please contact ${ACCOUNT_DELETION_SUPPORT_EMAIL}.`
    )
  }

  return { status: "sent" as const }
}

export function parseOAuthAccountDeletionFinalConfirmation(value: unknown) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== 1 ||
    (value as { confirmation?: unknown }).confirmation !== ACCOUNT_DELETION_CONFIRMATION
  ) {
    throw new AccountDeletionError(
      "Type DELETE and use a valid account deletion confirmation link."
    )
  }

  return { confirmation: ACCOUNT_DELETION_CONFIRMATION }
}

export async function getOAuthAccountDeletionHandoff(
  { token }: { token: string },
  { now = new Date(), store = getPrisma() }: Pick<AccountDeletionConfirmationDependencies, "now" | "store"> = {}
): Promise<OAuthAccountDeletionConfirmationToken> {
  const tokenHash = hashAccountDeletionConfirmationToken(token)
  const confirmationToken = await store.accountDeletionConfirmationToken.findUnique({
    select: {
      expiresAt: true,
      purpose: true,
      usedAt: true,
    },
    where: { tokenHash },
  })

  if (
    !confirmationToken ||
    confirmationToken.purpose !== ACCOUNT_DELETION_TOKEN_PURPOSE ||
    confirmationToken.usedAt ||
    confirmationToken.expiresAt <= now
  ) {
    throw new AccountDeletionError(INVALID_CONFIRMATION_MESSAGE)
  }

  return { expiresAt: confirmationToken.expiresAt, tokenHash }
}

export async function confirmOAuthAccountDeletion(
  { token, userId }: { token: string; userId: string },
  dependencies: AccountDeletionConfirmationDependencies = {}
) {
  return confirmOAuthAccountDeletionByTokenHash(
    { tokenHash: hashAccountDeletionConfirmationToken(token), userId },
    dependencies
  )
}

export async function confirmOAuthAccountDeletionByTokenHash(
  { tokenHash, userId }: { tokenHash: string; userId: string },
  dependencies: AccountDeletionConfirmationDependencies = {}
) {
  const now = dependencies.now ?? new Date()
  const store = dependencies.store ?? getPrisma()

  await store.$transaction(async (transaction) => {
    const confirmationToken = await transaction.accountDeletionConfirmationToken.findUnique({
      select: {
        authVersion: true,
        createdAt: true,
        expiresAt: true,
        id: true,
        purpose: true,
        usedAt: true,
        user: {
          select: {
            authVersion: true,
            disabledAt: true,
            emailVerified: true,
            passwordHash: true,
          },
        },
        userId: true,
      },
      where: { tokenHash },
    })

    if (
      !confirmationToken ||
      confirmationToken.userId !== userId ||
      confirmationToken.purpose !== ACCOUNT_DELETION_TOKEN_PURPOSE ||
      confirmationToken.usedAt ||
      confirmationToken.expiresAt <= now ||
      confirmationToken.user.disabledAt ||
      confirmationToken.user.passwordHash ||
      !confirmationToken.user.emailVerified ||
      confirmationToken.user.authVersion !== confirmationToken.authVersion
    ) {
      throw new AccountDeletionError(INVALID_CONFIRMATION_MESSAGE)
    }

    const claim = await transaction.accountDeletionConfirmationToken.updateMany({
      data: { usedAt: now },
      where: {
        expiresAt: { gt: now },
        id: confirmationToken.id,
        purpose: ACCOUNT_DELETION_TOKEN_PURPOSE,
        tokenHash,
        usedAt: null,
        user: {
          is: {
            authVersion: confirmationToken.authVersion,
            disabledAt: null,
            emailVerified: { not: null },
            id: userId,
            passwordHash: null,
          },
        },
      },
    })

    if (claim.count !== 1) {
      throw new AccountDeletionError(INVALID_CONFIRMATION_MESSAGE)
    }

    await deleteAccountInTransaction({
      expectedAuthVersion: confirmationToken.authVersion,
      now,
      requestedAt: confirmationToken.createdAt,
      transaction,
      userId,
    })
  })

  await notifyAccountSecurityChange({ reason: "account_disabled", userId })
}

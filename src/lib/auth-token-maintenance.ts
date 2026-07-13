import type { PrismaClient } from "../generated/prisma/client"

import { getPrisma } from "@/lib/db"

export const DEFAULT_AUTH_TOKEN_CLEANUP_BATCH_SIZE = 100

type AuthTokenMaintenanceStore = Pick<
  PrismaClient,
  "emailVerificationToken" | "passwordResetToken"
>

type AuthTokenMaintenanceDeps = {
  batchSize?: number
  now?: Date
  store?: unknown
}

function getStore(store?: unknown) {
  return (store ?? getPrisma()) as AuthTokenMaintenanceStore
}

function getBatchSize(value?: number) {
  if (!Number.isInteger(value) || !value || value < 1) {
    return DEFAULT_AUTH_TOKEN_CLEANUP_BATCH_SIZE
  }

  return Math.min(value, 1_000)
}

export async function cleanupExpiredAuthTokens(
  deps: AuthTokenMaintenanceDeps = {}
) {
  const store = getStore(deps.store)
  const now = deps.now ?? new Date()
  const take = getBatchSize(deps.batchSize)

  const [passwordResetTokens, emailVerificationTokens] = await Promise.all([
    store.passwordResetToken.findMany({
      orderBy: { expiresAt: "asc" },
      select: { id: true },
      take,
      where: { expiresAt: { lt: now } },
    }),
    store.emailVerificationToken.findMany({
      orderBy: { expiresAt: "asc" },
      select: { id: true },
      take,
      where: { expiresAt: { lt: now } },
    }),
  ])

  const [passwordResetResult, emailVerificationResult] = await Promise.all([
    passwordResetTokens.length
      ? store.passwordResetToken.deleteMany({
          where: {
            expiresAt: { lt: now },
            id: { in: passwordResetTokens.map((token) => token.id) },
          },
        })
      : Promise.resolve({ count: 0 }),
    emailVerificationTokens.length
      ? store.emailVerificationToken.deleteMany({
          where: {
            expiresAt: { lt: now },
            id: { in: emailVerificationTokens.map((token) => token.id) },
          },
        })
      : Promise.resolve({ count: 0 }),
  ])

  return {
    emailVerificationTokensDeleted: emailVerificationResult.count,
    passwordResetTokensDeleted: passwordResetResult.count,
  }
}

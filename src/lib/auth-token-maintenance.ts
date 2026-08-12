import type { PrismaClient } from "../generated/prisma/client"

import { getPrisma } from "@/lib/db"

import { MOBILE_MUTATION_RECEIPT_RETENTION_DAYS } from "./mobile-sync"

export const DEFAULT_AUTH_TOKEN_CLEANUP_BATCH_SIZE = 100

type AuthTokenMaintenanceStore = Pick<
  PrismaClient,
  | "accountDeletionConfirmationToken"
  | "deviceAuthorizationCode"
  | "deviceMutationReceipt"
  | "deviceSession"
  | "emailVerificationToken"
  | "mobileAuthorizationRequest"
  | "passwordResetToken"
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

  const expiredMutationReceiptCutoff = new Date(
    now.getTime() - MOBILE_MUTATION_RECEIPT_RETENTION_DAYS * 24 * 60 * 60 * 1_000
  )
  const expiredSessionWhere = {
    OR: [
      { refreshExpiresAt: { lt: now } },
      { revokedAt: { not: null } },
    ],
  }
  const [
    passwordResetTokens,
    emailVerificationTokens,
    accountDeletionConfirmationTokens,
    authorizationCodes,
    authorizationRequests,
    expiredSessions,
    expiredMutationReceipts,
  ] = await Promise.all([
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
    store.accountDeletionConfirmationToken.findMany({
      orderBy: { expiresAt: "asc" },
      select: { id: true },
      take,
      where: { expiresAt: { lt: now } },
    }),
    store.deviceAuthorizationCode.findMany({
      orderBy: { expiresAt: "asc" },
      select: { id: true },
      take,
      where: { expiresAt: { lt: now } },
    }),
    store.mobileAuthorizationRequest.findMany({
      orderBy: { expiresAt: "asc" },
      select: { id: true },
      take,
      where: { expiresAt: { lt: now } },
    }),
    store.deviceSession.findMany({
      orderBy: [{ refreshExpiresAt: "asc" }, { id: "asc" }],
      select: { id: true },
      take,
      where: expiredSessionWhere,
    }),
    store.deviceMutationReceipt.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true },
      take,
      where: { createdAt: { lt: expiredMutationReceiptCutoff } },
    }),
  ])

  const [
    passwordResetResult,
    emailVerificationResult,
    accountDeletionConfirmationResult,
    authorizationCodeResult,
    authorizationRequestResult,
    expiredSessionResult,
    expiredMutationReceiptResult,
  ] = await Promise.all([
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
    accountDeletionConfirmationTokens.length
      ? store.accountDeletionConfirmationToken.deleteMany({
          where: {
            expiresAt: { lt: now },
            id: { in: accountDeletionConfirmationTokens.map((token) => token.id) },
          },
        })
      : Promise.resolve({ count: 0 }),
    authorizationCodes.length
      ? store.deviceAuthorizationCode.deleteMany({
          where: {
            expiresAt: { lt: now },
            id: { in: authorizationCodes.map((token) => token.id) },
          },
        })
      : Promise.resolve({ count: 0 }),
    authorizationRequests.length
      ? store.mobileAuthorizationRequest.deleteMany({
          where: {
            expiresAt: { lt: now },
            id: { in: authorizationRequests.map((request) => request.id) },
          },
        })
      : Promise.resolve({ count: 0 }),
    expiredSessions.length
      ? store.deviceSession.deleteMany({
          where: {
            ...expiredSessionWhere,
            id: { in: expiredSessions.map((session) => session.id) },
          },
        })
      : Promise.resolve({ count: 0 }),
    expiredMutationReceipts.length
      ? store.deviceMutationReceipt.deleteMany({
          where: {
            createdAt: { lt: expiredMutationReceiptCutoff },
            id: { in: expiredMutationReceipts.map((receipt) => receipt.id) },
          },
        })
      : Promise.resolve({ count: 0 }),
  ])

  return {
    accountDeletionConfirmationTokensDeleted: accountDeletionConfirmationResult.count,
    authorizationCodesDeleted: authorizationCodeResult.count,
    authorizationRequestsDeleted: authorizationRequestResult.count,
    expiredMutationReceiptsDeleted: expiredMutationReceiptResult.count,
    expiredSessionsDeleted: expiredSessionResult.count,
    emailVerificationTokensDeleted: emailVerificationResult.count,
    passwordResetTokensDeleted: passwordResetResult.count,
  }
}

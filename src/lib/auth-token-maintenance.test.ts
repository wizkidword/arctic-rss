import { describe, expect, it, vi } from "vitest"

import {
  cleanupExpiredAuthTokens,
  DEFAULT_AUTH_TOKEN_CLEANUP_BATCH_SIZE,
} from "./auth-token-maintenance"

describe("auth token maintenance", () => {
  it("deletes only a bounded batch of tokens that are still expired", async () => {
    const now = new Date("2026-06-26T12:00:00.000Z")
    const store = {
      accountDeletionConfirmationToken: {
        deleteMany: vi.fn(async () => ({ count: 3 })),
        findMany: vi.fn(async () => [{ id: "deletion-1" }, { id: "deletion-2" }, { id: "deletion-3" }]),
      },
      deviceAuthorizationCode: {
        deleteMany: vi.fn(async () => ({ count: 4 })),
        findMany: vi.fn(async () => [{ id: "code-1" }, { id: "code-2" }]),
      },
      deviceMutationReceipt: {
        deleteMany: vi.fn(async () => ({ count: 5 })),
        findMany: vi.fn(async () => [{ id: "receipt-1" }]),
      },
      deviceSession: {
        deleteMany: vi.fn(async () => ({ count: 6 })),
        findMany: vi.fn(async () => [{ id: "session-1" }]),
      },
      emailVerificationToken: {
        deleteMany: vi.fn(async () => ({ count: 1 })),
        findMany: vi.fn(async () => [{ id: "verify-1" }]),
      },
      mobileAuthorizationRequest: {
        deleteMany: vi.fn(async () => ({ count: 7 })),
        findMany: vi.fn(async () => [{ id: "request-1" }]),
      },
      passwordResetToken: {
        deleteMany: vi.fn(async () => ({ count: 2 })),
        findMany: vi.fn(async () => [{ id: "reset-1" }, { id: "reset-2" }]),
      },
    }

    await expect(
      cleanupExpiredAuthTokens({ batchSize: 25, now, store })
    ).resolves.toEqual({
      accountDeletionConfirmationTokensDeleted: 3,
      authorizationCodesDeleted: 4,
      authorizationRequestsDeleted: 7,
      emailVerificationTokensDeleted: 1,
      expiredMutationReceiptsDeleted: 5,
      expiredSessionsDeleted: 6,
      passwordResetTokensDeleted: 2,
    })

    expect(store.passwordResetToken.findMany).toHaveBeenCalledWith({
      orderBy: { expiresAt: "asc" },
      select: { id: true },
      take: 25,
      where: { expiresAt: { lt: now } },
    })
    expect(store.passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: {
        expiresAt: { lt: now },
        id: { in: ["reset-1", "reset-2"] },
      },
    })
    expect(store.emailVerificationToken.deleteMany).toHaveBeenCalledWith({
      where: {
        expiresAt: { lt: now },
        id: { in: ["verify-1"] },
      },
    })
    expect(store.accountDeletionConfirmationToken.deleteMany).toHaveBeenCalledWith({
      where: {
        expiresAt: { lt: now },
        id: { in: ["deletion-1", "deletion-2", "deletion-3"] },
      },
    })
    expect(store.deviceAuthorizationCode.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: now }, id: { in: ["code-1", "code-2"] } },
    })
    expect(store.mobileAuthorizationRequest.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: now }, id: { in: ["request-1"] } },
    })
    expect(store.deviceSession.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [{ refreshExpiresAt: { lt: now } }, { revokedAt: { not: null } }],
        id: { in: ["session-1"] },
      },
    })
  })

  it("does not issue deletes when the selected batches are empty", async () => {
    const store = {
      accountDeletionConfirmationToken: {
        deleteMany: vi.fn(),
        findMany: vi.fn(async () => []),
      },
      deviceAuthorizationCode: { deleteMany: vi.fn(), findMany: vi.fn(async () => []) },
      deviceMutationReceipt: { deleteMany: vi.fn(), findMany: vi.fn(async () => []) },
      deviceSession: { deleteMany: vi.fn(), findMany: vi.fn(async () => []) },
      emailVerificationToken: {
        deleteMany: vi.fn(),
        findMany: vi.fn(async () => []),
      },
      mobileAuthorizationRequest: { deleteMany: vi.fn(), findMany: vi.fn(async () => []) },
      passwordResetToken: {
        deleteMany: vi.fn(),
        findMany: vi.fn(async () => []),
      },
    }

    await expect(cleanupExpiredAuthTokens({ batchSize: 0, store })).resolves.toEqual({
      accountDeletionConfirmationTokensDeleted: 0,
      authorizationCodesDeleted: 0,
      authorizationRequestsDeleted: 0,
      emailVerificationTokensDeleted: 0,
      expiredMutationReceiptsDeleted: 0,
      expiredSessionsDeleted: 0,
      passwordResetTokensDeleted: 0,
    })

    expect(store.passwordResetToken.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: DEFAULT_AUTH_TOKEN_CLEANUP_BATCH_SIZE })
    )
    expect(store.passwordResetToken.deleteMany).not.toHaveBeenCalled()
    expect(store.emailVerificationToken.deleteMany).not.toHaveBeenCalled()
    expect(store.accountDeletionConfirmationToken.deleteMany).not.toHaveBeenCalled()
    expect(store.deviceAuthorizationCode.deleteMany).not.toHaveBeenCalled()
    expect(store.mobileAuthorizationRequest.deleteMany).not.toHaveBeenCalled()
    expect(store.deviceSession.deleteMany).not.toHaveBeenCalled()
    expect(store.deviceMutationReceipt.deleteMany).not.toHaveBeenCalled()
  })
})

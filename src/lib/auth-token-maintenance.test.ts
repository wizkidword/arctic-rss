import { describe, expect, it, vi } from "vitest"

import {
  cleanupExpiredAuthTokens,
  DEFAULT_AUTH_TOKEN_CLEANUP_BATCH_SIZE,
} from "./auth-token-maintenance"

describe("auth token maintenance", () => {
  it("deletes only a bounded batch of tokens that are still expired", async () => {
    const now = new Date("2026-06-26T12:00:00.000Z")
    const store = {
      emailVerificationToken: {
        deleteMany: vi.fn(async () => ({ count: 1 })),
        findMany: vi.fn(async () => [{ id: "verify-1" }]),
      },
      passwordResetToken: {
        deleteMany: vi.fn(async () => ({ count: 2 })),
        findMany: vi.fn(async () => [{ id: "reset-1" }, { id: "reset-2" }]),
      },
    }

    await expect(
      cleanupExpiredAuthTokens({ batchSize: 25, now, store })
    ).resolves.toEqual({
      emailVerificationTokensDeleted: 1,
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
  })

  it("does not issue deletes when the selected batches are empty", async () => {
    const store = {
      emailVerificationToken: {
        deleteMany: vi.fn(),
        findMany: vi.fn(async () => []),
      },
      passwordResetToken: {
        deleteMany: vi.fn(),
        findMany: vi.fn(async () => []),
      },
    }

    await expect(cleanupExpiredAuthTokens({ batchSize: 0, store })).resolves.toEqual({
      emailVerificationTokensDeleted: 0,
      passwordResetTokensDeleted: 0,
    })

    expect(store.passwordResetToken.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: DEFAULT_AUTH_TOKEN_CLEANUP_BATCH_SIZE })
    )
    expect(store.passwordResetToken.deleteMany).not.toHaveBeenCalled()
    expect(store.emailVerificationToken.deleteMany).not.toHaveBeenCalled()
  })
})

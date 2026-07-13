import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getPrisma: vi.fn(),
  hashPassword: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  getPrisma: mocks.getPrisma,
}))

vi.mock("@/lib/password", () => ({
  hashPassword: mocks.hashPassword,
}))

import {
  buildPasswordResetUrl,
  createPasswordResetToken,
  getPasswordResetExpiresAt,
  hashPasswordResetToken,
  normalizePasswordResetEmail,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  resetPasswordWithToken,
} from "./password-reset"

const now = new Date("2026-06-26T12:00:00.000Z")
const future = new Date("2026-06-26T13:00:00.000Z")

describe("password reset helpers", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    vi.spyOn(console, "info").mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it("normalizes and validates request emails", () => {
    expect(normalizePasswordResetEmail("  READER@EXAMPLE.COM ")).toBe(
      "reader@example.com"
    )

    expect(
      passwordResetRequestSchema.safeParse({
        email: "reader@example.com",
      }).success
    ).toBe(true)

    expect(
      passwordResetRequestSchema.safeParse({
        email: "not-an-email",
      }).success
    ).toBe(false)
  })

  it("requires matching reset passwords", () => {
    expect(
      passwordResetConfirmSchema.safeParse({
        token: "x".repeat(40),
        password: "long-enough",
        confirmPassword: "long-enough",
      }).success
    ).toBe(true)

    expect(
      passwordResetConfirmSchema.safeParse({
        token: "x".repeat(40),
        password: "long-enough",
        confirmPassword: "different",
      }).success
    ).toBe(false)
  })

  it("creates reset tokens and stores only a stable hash", () => {
    const { token, tokenHash } = createPasswordResetToken()

    expect(token).not.toBe(tokenHash)
    expect(token.length).toBeGreaterThanOrEqual(32)
    expect(tokenHash).toBe(hashPasswordResetToken(token))
    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it("builds reset URLs from the public app URL", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://arcticrss.com/")

    expect(buildPasswordResetUrl("reset-token")).toBe(
      "https://arcticrss.com/reset-password?token=reset-token"
    )
  })

  it("expires reset links one hour from creation", () => {
    expect(getPasswordResetExpiresAt(now).toISOString()).toBe(
      "2026-06-26T13:00:00.000Z"
    )
  })

  it("claims a reset token before changing the password and revoking sessions", async () => {
    const tokenUpdateMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValue({ count: 0 })
    const userUpdateMany = vi.fn().mockResolvedValue({ count: 1 })
    const securityEventCreate = vi.fn().mockResolvedValue({ id: "event-1" })
    const transactionClient = {
      passwordResetToken: {
        findUnique: vi.fn().mockResolvedValue({
          expiresAt: future,
          id: "reset-1",
          usedAt: null,
          user: { disabledAt: null, passwordHash: "old-password-hash" },
          userId: "user-1",
        }),
        updateMany: tokenUpdateMany,
      },
      securityEvent: { create: securityEventCreate },
      user: { updateMany: userUpdateMany },
    }
    const store = {
      $transaction: vi.fn(
        async (
          callback: (client: typeof transactionClient) => Promise<unknown>
        ) => callback(transactionClient)
      ),
    }
    mocks.hashPassword.mockResolvedValue("new-password-hash")

    await expect(
      resetPasswordWithToken(
        { password: "new password", token: "x".repeat(40) },
        { now, store }
      )
    ).resolves.toEqual({ status: "reset" })

    expect(transactionClient.passwordResetToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashPasswordResetToken("x".repeat(40)) },
      select: {
        expiresAt: true,
        id: true,
        usedAt: true,
        user: { select: { disabledAt: true, passwordHash: true } },
        userId: true,
      },
    })
    expect(tokenUpdateMany).toHaveBeenNthCalledWith(1, {
      where: {
        expiresAt: { gt: now },
        id: "reset-1",
        tokenHash: hashPasswordResetToken("x".repeat(40)),
        usedAt: null,
        user: {
          is: {
            disabledAt: null,
            id: "user-1",
            passwordHash: { not: null },
          },
        },
      },
      data: { usedAt: now },
    })
    expect(userUpdateMany).toHaveBeenCalledWith({
      data: {
        authVersion: { increment: 1 },
        passwordHash: "new-password-hash",
      },
      where: {
        disabledAt: null,
        id: "user-1",
        passwordHash: { not: null },
      },
    })
    expect(securityEventCreate).toHaveBeenCalledWith({
      data: {
        eventType: "PASSWORD_RESET_COMPLETED",
        userId: "user-1",
      },
    })
  })

  it("allows exactly one of 100 concurrent password reset submissions", async () => {
    let claimed = false
    const tokenUpdateMany = vi.fn(
      async ({ where }: { where: { id?: unknown } }) => {
        if (where.id === "reset-1") {
          if (claimed) {
            return { count: 0 }
          }

          claimed = true
          return { count: 1 }
        }

        return { count: 0 }
      }
    )
    const userUpdateMany = vi.fn().mockResolvedValue({ count: 1 })
    const securityEventCreate = vi.fn().mockResolvedValue({ id: "event-1" })
    const transactionClient = {
      passwordResetToken: {
        findUnique: vi.fn().mockResolvedValue({
          expiresAt: future,
          id: "reset-1",
          usedAt: null,
          user: { disabledAt: null, passwordHash: "old-password-hash" },
          userId: "user-1",
        }),
        updateMany: tokenUpdateMany,
      },
      securityEvent: { create: securityEventCreate },
      user: { updateMany: userUpdateMany },
    }
    const store = {
      $transaction: vi.fn(
        async (
          callback: (client: typeof transactionClient) => Promise<unknown>
        ) => callback(transactionClient)
      ),
    }
    mocks.hashPassword.mockResolvedValue("new-password-hash")

    const results = await Promise.all(
      Array.from({ length: 100 }, () =>
        resetPasswordWithToken(
          { password: "new password", token: "x".repeat(40) },
          { now, store }
        )
      )
    )

    expect(results.filter((result) => result.status === "reset")).toHaveLength(1)
    expect(
      results.filter((result) => result.status === "invalid-token")
    ).toHaveLength(99)
    expect(userUpdateMany).toHaveBeenCalledTimes(1)
    expect(securityEventCreate).toHaveBeenCalledTimes(1)
  })

  it("rejects expired and already-used reset tokens before claiming them", async () => {
    for (const resetToken of [
      { expiresAt: new Date(now.getTime() - 1), usedAt: null },
      { expiresAt: future, usedAt: now },
    ]) {
      const tokenUpdateMany = vi.fn().mockResolvedValue({ count: 1 })
      const transactionClient = {
        passwordResetToken: {
          findUnique: vi.fn().mockResolvedValue({
            ...resetToken,
            id: "reset-1",
            user: { disabledAt: null, passwordHash: "old-password-hash" },
            userId: "user-1",
          }),
          updateMany: tokenUpdateMany,
        },
        securityEvent: { create: vi.fn() },
        user: { updateMany: vi.fn() },
      }
      const store = {
        $transaction: vi.fn(
          async (
            callback: (client: typeof transactionClient) => Promise<unknown>
          ) => callback(transactionClient)
        ),
      }
      mocks.hashPassword.mockResolvedValue("new-password-hash")

      await expect(
        resetPasswordWithToken(
          { password: "new password", token: "x".repeat(40) },
          { now, store }
        )
      ).resolves.toEqual({ status: "invalid-token" })

      expect(tokenUpdateMany).not.toHaveBeenCalled()
    }
  })

  it("returns a generic error when the transaction cannot complete", async () => {
    const transactionClient = {
      passwordResetToken: {
        findUnique: vi.fn().mockResolvedValue({
          expiresAt: future,
          id: "reset-1",
          usedAt: null,
          user: { disabledAt: null, passwordHash: "old-password-hash" },
          userId: "user-1",
        }),
        updateMany: vi
          .fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValue({ count: 0 }),
      },
      securityEvent: {
        create: vi.fn().mockRejectedValue(new Error("simulated database error")),
      },
      user: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    }
    const store = {
      $transaction: vi.fn(
        async (
          callback: (client: typeof transactionClient) => Promise<unknown>
        ) => callback(transactionClient)
      ),
    }
    mocks.hashPassword.mockResolvedValue("new-password-hash")

    await expect(
      resetPasswordWithToken(
        { password: "new password", token: "x".repeat(40) },
        { now, store }
      )
    ).resolves.toEqual({ status: "error" })
  })
})

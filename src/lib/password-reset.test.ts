import { afterEach, describe, expect, it, vi } from "vitest"

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

describe("password reset helpers", () => {
  afterEach(() => {
    vi.clearAllMocks()
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
    const now = new Date("2026-06-26T12:00:00.000Z")

    expect(getPasswordResetExpiresAt(now).toISOString()).toBe(
      "2026-06-26T13:00:00.000Z"
    )
  })

  it("revokes prior sessions when a password reset succeeds", async () => {
    const userUpdate = vi.fn().mockReturnValue({ type: "user-update" })
    const tokenUpdate = vi.fn().mockReturnValue({ type: "token-update" })
    const tokenUpdateMany = vi
      .fn()
      .mockReturnValue({ type: "token-update-many" })
    const transaction = vi.fn().mockResolvedValue([])

    mocks.getPrisma.mockReturnValue({
      $transaction: transaction,
      passwordResetToken: {
        findUnique: vi.fn().mockResolvedValue({
          expiresAt: new Date(Date.now() + 60_000),
          id: "reset-1",
          usedAt: null,
          user: {
            disabledAt: null,
            id: "user-1",
          },
          userId: "user-1",
        }),
        update: tokenUpdate,
        updateMany: tokenUpdateMany,
      },
      user: {
        update: userUpdate,
      },
    })
    mocks.hashPassword.mockResolvedValue("new-password-hash")

    await expect(
      resetPasswordWithToken({
        password: "new password",
        token: "x".repeat(40),
      })
    ).resolves.toEqual({ status: "reset" })

    expect(userUpdate).toHaveBeenCalledWith({
      data: {
        authVersion: { increment: 1 },
        passwordHash: "new-password-hash",
      },
      where: { id: "user-1" },
    })
  })
})

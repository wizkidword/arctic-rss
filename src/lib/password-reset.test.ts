import { afterEach, describe, expect, it, vi } from "vitest"

import {
  buildPasswordResetUrl,
  createPasswordResetToken,
  getPasswordResetExpiresAt,
  hashPasswordResetToken,
  normalizePasswordResetEmail,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
} from "./password-reset"

describe("password reset helpers", () => {
  afterEach(() => {
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
})

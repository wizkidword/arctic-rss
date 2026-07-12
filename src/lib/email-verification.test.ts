import { afterEach, describe, expect, it, vi } from "vitest"

import {
  buildEmailVerificationUrl,
  buildEmailVerificationLoginUrl,
  createEmailVerificationToken,
  getEmailVerificationExpiresAt,
  hashEmailVerificationToken,
  requestEmailVerification,
  verifyEmailWithToken,
} from "./email-verification"

describe("email verification helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("creates verification tokens and stores only a stable hash", () => {
    const { token, tokenHash } = createEmailVerificationToken()

    expect(token).not.toBe(tokenHash)
    expect(token.length).toBeGreaterThanOrEqual(32)
    expect(tokenHash).toBe(hashEmailVerificationToken(token))
    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it("builds verification URLs from the public app URL", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://arcticrss.com/")

    expect(buildEmailVerificationUrl("verify-token")).toBe(
      "https://arcticrss.com/verify-email?token=verify-token"
    )

    expect(buildEmailVerificationLoginUrl("verifyError")).toBe(
      "https://arcticrss.com/login?verifyError=1"
    )
  })

  it("expires verification links twenty-four hours from creation", () => {
    const now = new Date("2026-06-26T12:00:00.000Z")

    expect(getEmailVerificationExpiresAt(now).toISOString()).toBe(
      "2026-06-27T12:00:00.000Z"
    )
  })

  it("creates a fresh verification request and emails the link", async () => {
    const now = new Date("2026-06-26T12:00:00.000Z")
    const store = {
      emailVerificationToken: {
        deleteMany: vi.fn(async () => ({ count: 0 })),
        updateMany: vi.fn(async () => ({ count: 1 })),
        create: vi.fn(async () => ({ id: "token-1" })),
      },
    }
    const sendVerificationEmail = vi.fn(async () => ({ status: "sent" as const }))

    const result = await requestEmailVerification(
      { userId: "user-1", email: "reader@example.com" },
      { now, sendVerificationEmail, store }
    )

    expect(result).toEqual({ status: "sent" })
    expect(store.emailVerificationToken.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: now } },
    })
    expect(store.emailVerificationToken.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", usedAt: null },
      data: { usedAt: now },
    })
    expect(store.emailVerificationToken.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        expiresAt: new Date("2026-06-27T12:00:00.000Z"),
      },
    })
    expect(sendVerificationEmail).toHaveBeenCalledWith({
      to: "reader@example.com",
      verificationUrl: expect.stringContaining("/verify-email?token="),
    })
  })

  it("verifies a valid token, consumes open tokens, and sends welcome mail", async () => {
    const now = new Date("2026-06-26T12:00:00.000Z")
    const { token, tokenHash } = createEmailVerificationToken()
    const store = {
      emailVerificationToken: {
        findUnique: vi.fn(async () => ({
          id: "token-1",
          userId: "user-1",
          usedAt: null,
          expiresAt: new Date("2026-06-27T12:00:00.000Z"),
          user: {
            id: "user-1",
            email: "reader@example.com",
            emailVerified: null,
            disabledAt: null,
          },
        })),
        update: vi.fn(async () => ({ id: "token-1" })),
        updateMany: vi.fn(async () => ({ count: 2 })),
      },
      user: {
        update: vi.fn(async () => ({ id: "user-1" })),
      },
      $transaction: vi.fn(async (operations: unknown[]) => operations),
    }
    const sendWelcomeEmail = vi.fn(async () => ({ status: "sent" as const }))

    const result = await verifyEmailWithToken(token, {
      now,
      sendWelcomeEmail,
      store,
    })

    expect(result).toEqual({ status: "verified" })
    expect(store.emailVerificationToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            emailVerified: true,
            disabledAt: true,
          },
        },
      },
    })
    expect(store.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { emailVerified: now },
    })
    expect(store.emailVerificationToken.update).toHaveBeenCalledWith({
      where: { id: "token-1" },
      data: { usedAt: now },
    })
    expect(store.emailVerificationToken.updateMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        usedAt: null,
        id: { not: "token-1" },
      },
      data: { usedAt: now },
    })
    expect(sendWelcomeEmail).toHaveBeenCalledWith({ to: "reader@example.com" })
  })
})

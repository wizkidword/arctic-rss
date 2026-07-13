import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  buildEmailVerificationUrl,
  buildEmailVerificationLoginUrl,
  createEmailVerificationToken,
  getEmailVerificationExpiresAt,
  hashEmailVerificationToken,
  requestEmailVerification,
  verifyEmailWithToken,
} from "./email-verification"

const now = new Date("2026-06-26T12:00:00.000Z")
const future = new Date("2026-06-27T12:00:00.000Z")

describe("email verification helpers", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    vi.spyOn(console, "info").mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
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
    expect(getEmailVerificationExpiresAt(now).toISOString()).toBe(
      "2026-06-27T12:00:00.000Z"
    )
  })

  it("creates a fresh verification request without unbounded expired-token cleanup", async () => {
    const store = {
      emailVerificationToken: {
        create: vi.fn(async () => ({ id: "token-1" })),
        deleteMany: vi.fn(async () => ({ count: 0 })),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
    }
    const sendVerificationEmail = vi.fn(async () => ({ status: "sent" as const }))

    const result = await requestEmailVerification(
      { userId: "user-1", email: "reader@example.com" },
      { now, sendVerificationEmail, store }
    )

    expect(result).toEqual({ status: "sent" })
    expect(store.emailVerificationToken.deleteMany).not.toHaveBeenCalled()
    expect(store.emailVerificationToken.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", usedAt: null },
      data: { usedAt: now },
    })
    expect(store.emailVerificationToken.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        expiresAt: future,
      },
    })
    expect(sendVerificationEmail).toHaveBeenCalledWith({
      to: "reader@example.com",
      verificationUrl: expect.stringContaining("/verify-email?token="),
    })
  })

  it("claims a verification token atomically and sends one welcome message", async () => {
    const { token, tokenHash } = createEmailVerificationToken()
    const tokenUpdateMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValue({ count: 0 })
    const userUpdateMany = vi.fn().mockResolvedValue({ count: 1 })
    const securityEventCreate = vi.fn().mockResolvedValue({ id: "event-1" })
    const transactionClient = {
      emailVerificationToken: {
        findUnique: vi.fn(async () => ({
          expiresAt: future,
          id: "token-1",
          usedAt: null,
          user: {
            disabledAt: null,
            email: "reader@example.com",
            emailVerified: null,
            id: "user-1",
          },
          userId: "user-1",
        })),
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
    const sendWelcomeEmail = vi.fn(async () => ({ status: "sent" as const }))

    await expect(
      verifyEmailWithToken(token, { now, sendWelcomeEmail, store })
    ).resolves.toEqual({ status: "verified" })

    expect(transactionClient.emailVerificationToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash },
      select: {
        expiresAt: true,
        id: true,
        usedAt: true,
        user: {
          select: {
            disabledAt: true,
            email: true,
            emailVerified: true,
            id: true,
          },
        },
        userId: true,
      },
    })
    expect(tokenUpdateMany).toHaveBeenNthCalledWith(1, {
      where: {
        expiresAt: { gt: now },
        id: "token-1",
        tokenHash,
        usedAt: null,
        user: { is: { disabledAt: null, id: "user-1" } },
      },
      data: { usedAt: now },
    })
    expect(userUpdateMany).toHaveBeenCalledWith({
      where: { disabledAt: null, id: "user-1" },
      data: { emailVerified: now },
    })
    expect(securityEventCreate).toHaveBeenCalledWith({
      data: {
        eventType: "EMAIL_VERIFICATION_COMPLETED",
        userId: "user-1",
      },
    })
    expect(sendWelcomeEmail).toHaveBeenCalledWith({ to: "reader@example.com" })
  })

  it("allows exactly one of 100 concurrent verification submissions", async () => {
    const { token } = createEmailVerificationToken()
    let claimed = false
    const tokenUpdateMany = vi.fn(
      async ({ where }: { where: { id?: unknown } }) => {
        if (where.id === "token-1") {
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
      emailVerificationToken: {
        findUnique: vi.fn(async () => ({
          expiresAt: future,
          id: "token-1",
          usedAt: null,
          user: {
            disabledAt: null,
            email: "reader@example.com",
            emailVerified: null,
            id: "user-1",
          },
          userId: "user-1",
        })),
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
    const sendWelcomeEmail = vi.fn(async () => ({ status: "sent" as const }))

    const results = await Promise.all(
      Array.from({ length: 100 }, () =>
        verifyEmailWithToken(token, { now, sendWelcomeEmail, store })
      )
    )

    expect(results.filter((result) => result.status === "verified")).toHaveLength(1)
    expect(
      results.filter((result) => result.status === "invalid-token")
    ).toHaveLength(99)
    expect(userUpdateMany).toHaveBeenCalledTimes(1)
    expect(securityEventCreate).toHaveBeenCalledTimes(1)
    expect(sendWelcomeEmail).toHaveBeenCalledTimes(1)
  })

  it("rejects expired and already-used verification tokens before claiming them", async () => {
    for (const verificationToken of [
      { expiresAt: new Date(now.getTime() - 1), usedAt: null },
      { expiresAt: future, usedAt: now },
    ]) {
      const tokenUpdateMany = vi.fn().mockResolvedValue({ count: 1 })
      const transactionClient = {
        emailVerificationToken: {
          findUnique: vi.fn(async () => ({
            ...verificationToken,
            id: "token-1",
            user: {
              disabledAt: null,
              email: "reader@example.com",
              emailVerified: null,
              id: "user-1",
            },
            userId: "user-1",
          })),
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

      await expect(
        verifyEmailWithToken("x".repeat(40), { now, store })
      ).resolves.toEqual({ status: "invalid-token" })

      expect(tokenUpdateMany).not.toHaveBeenCalled()
    }
  })

  it("does not send welcome mail when a verification transaction fails", async () => {
    const { token } = createEmailVerificationToken()
    const transactionClient = {
      emailVerificationToken: {
        findUnique: vi.fn(async () => ({
          expiresAt: future,
          id: "token-1",
          usedAt: null,
          user: {
            disabledAt: null,
            email: "reader@example.com",
            emailVerified: null,
            id: "user-1",
          },
          userId: "user-1",
        })),
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
    const sendWelcomeEmail = vi.fn(async () => ({ status: "sent" as const }))

    await expect(
      verifyEmailWithToken(token, { now, sendWelcomeEmail, store })
    ).resolves.toEqual({ status: "invalid-token" })

    expect(sendWelcomeEmail).not.toHaveBeenCalled()
  })
})

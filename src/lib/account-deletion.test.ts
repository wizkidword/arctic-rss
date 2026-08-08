import { describe, expect, it, vi } from "vitest"

import {
  AccountDeletionError,
  ACCOUNT_DELETION_TOKEN_PURPOSE,
  buildAccountDeletionConfirmationUrl,
  confirmOAuthAccountDeletion,
  createAccountDeletionConfirmationToken,
  deleteAccount,
  getAccountDeletionConfirmationExpiresAt,
  getDeletionSubjectReference,
  hashAccountDeletionConfirmationToken,
  getOAuthAccountDeletionHandoff,
  parseAccountDeletionConfirmation,
  parseOAuthAccountDeletionConfirmation,
  parseOAuthAccountDeletionHandoff,
  parseOAuthAccountDeletionConfirmationRequest,
  requestOAuthAccountDeletionConfirmation,
  requireAccountDeletionReauthentication,
} from "./account-deletion"
import { ACCOUNT_DELETION_POLICY_VERSION } from "./legal-policy-versions"

describe("account deletion", () => {
  it("requires an explicit DELETE confirmation and current password", () => {
    expect(() => parseAccountDeletionConfirmation({ confirmation: "delete", currentPassword: "secret" })).toThrow(
      AccountDeletionError
    )
    expect(() => parseAccountDeletionConfirmation({ confirmation: "DELETE" })).toThrow(
      AccountDeletionError
    )
    expect(() => parseAccountDeletionConfirmation({ confirmation: "DELETE", currentPassword: "secret" })).not.toThrow()
  })

  it("requires an explicit DELETE confirmation for the email request and completion", () => {
    expect(() => parseOAuthAccountDeletionConfirmationRequest({ confirmation: "delete" })).toThrow(
      AccountDeletionError
    )
    expect(() => parseOAuthAccountDeletionConfirmation({ confirmation: "DELETE", token: "short" })).toThrow(
      AccountDeletionError
    )
    expect(() =>
      parseOAuthAccountDeletionConfirmation({ confirmation: "DELETE", token: "x".repeat(43) })
    ).not.toThrow()
    expect(() => parseOAuthAccountDeletionHandoff({ token: "short" })).toThrow(AccountDeletionError)
    expect(() => parseOAuthAccountDeletionHandoff({ token: "x".repeat(43) })).not.toThrow()
  })

  it("creates a short-lived, hashed email confirmation token whose secret stays in the URL fragment", () => {
    const now = new Date("2026-08-02T12:00:00.000Z")
    const { token, tokenHash } = createAccountDeletionConfirmationToken()

    expect(token).not.toBe(tokenHash)
    expect(tokenHash).toBe(hashAccountDeletionConfirmationToken(token))
    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/)
    expect(getAccountDeletionConfirmationExpiresAt(now).toISOString()).toBe(
      "2026-08-02T12:15:00.000Z"
    )

    vi.stubEnv("APP_ORIGIN", "https://arcticrss.com/")
    expect(buildAccountDeletionConfirmationUrl("email-token")).toBe(
      "https://arcticrss.com/delete-account#token=email-token"
    )
    vi.unstubAllEnvs()
  })

  it("requires the current local password before deleting an account", async () => {
    const findUnique = vi.fn().mockResolvedValue({ passwordHash: "stored-hash" })
    const verify = vi.fn().mockResolvedValue(false)

    await expect(
      requireAccountDeletionReauthentication({
        currentPassword: "incorrect",
        store: { user: { findUnique } } as never,
        userId: "user-1",
        verify,
      })
    ).rejects.toThrow(AccountDeletionError)
    expect(verify).toHaveBeenCalledWith("incorrect", "stored-hash")
  })

  it("does not allow a passwordless account through the self-service route", async () => {
    const verify = vi.fn()

    await expect(
      requireAccountDeletionReauthentication({
        currentPassword: "not-used",
        store: { user: { findUnique: vi.fn().mockResolvedValue({ passwordHash: null }) } } as never,
        userId: "user-1",
        verify,
      })
    ).rejects.toThrow(AccountDeletionError)
    expect(verify).not.toHaveBeenCalled()
  })

  it("records only the one-way completion reference before deleting the user", async () => {
    const transaction = {
      accountDeletionRecord: { upsert: vi.fn().mockResolvedValue({ id: "deletion-1" }) },
      user: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    }
    const store = {
      $transaction: async (work: (client: typeof transaction) => Promise<unknown>) => work(transaction),
    }
    const completedAt = new Date("2026-07-14T12:00:00.000Z")

    await deleteAccount({
      expectedAuthVersion: 7,
      now: completedAt,
      store: store as never,
      userId: "user-1",
    })

    expect(transaction.accountDeletionRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          completedAt,
          policyVersion: ACCOUNT_DELETION_POLICY_VERSION,
          subjectReference: getDeletionSubjectReference("user-1"),
        }),
      })
    )
    expect(transaction.user.deleteMany).toHaveBeenCalledWith({
      where: { authVersion: 7, id: "user-1" },
    })
  })

  it("does not complete deletion if the account changes after reauthentication", async () => {
    const transaction = {
      accountDeletionRecord: { upsert: vi.fn().mockResolvedValue({ id: "deletion-1" }) },
      user: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    }
    const store = {
      $transaction: async (work: (client: typeof transaction) => Promise<unknown>) => work(transaction),
    }

    await expect(
      deleteAccount({ expectedAuthVersion: 7, store: store as never, userId: "user-1" })
    ).rejects.toThrow("Your account changed")
  })

  it("issues a token only for a verified Google-only account and stores its digest", async () => {
    const now = new Date("2026-08-02T12:00:00.000Z")
    vi.stubEnv("APP_ORIGIN", "https://arcticrss.com")
    const tokenStore = {
      create: vi.fn().mockResolvedValue({ id: "deletion-token-1" }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    }
    const sendConfirmationEmail = vi.fn().mockResolvedValue({ status: "sent" })
    const transaction = {
      accountDeletionConfirmationToken: tokenStore,
      user: {
        update: vi.fn().mockResolvedValue({
          authVersion: 4,
          disabledAt: null,
          email: "reader@example.test",
          emailVerified: now,
          id: "user-1",
          passwordHash: null,
        }),
      },
    }
    const store = {
      $transaction: async (work: (client: typeof transaction) => Promise<unknown>) => work(transaction),
      accountDeletionConfirmationToken: tokenStore,
    }

    await expect(
      requestOAuthAccountDeletionConfirmation(
        { userId: "user-1" },
        { now, sendConfirmationEmail, store: store as never }
      )
    ).resolves.toEqual({ status: "sent" })

    expect(tokenStore.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        authVersion: 4,
        expiresAt: new Date("2026-08-02T12:15:00.000Z"),
        purpose: ACCOUNT_DELETION_TOKEN_PURPOSE,
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        userId: "user-1",
      }),
    })
    expect(sendConfirmationEmail).toHaveBeenCalledWith({
      confirmationUrl: expect.stringMatching(/^https:\/\/arcticrss\.com\/delete-account#token=/),
      to: "reader@example.test",
    })
    expect(transaction.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { updatedAt: now }, where: { id: "user-1" } })
    )
    vi.unstubAllEnvs()
  })

  it("checks a current token for a handoff without consuming it", async () => {
    const now = new Date("2026-08-02T12:00:00.000Z")
    const token = "x".repeat(43)
    const findUnique = vi.fn().mockResolvedValue({
      expiresAt: new Date("2026-08-02T12:15:00.000Z"),
      purpose: ACCOUNT_DELETION_TOKEN_PURPOSE,
      usedAt: null,
    })

    await expect(
      getOAuthAccountDeletionHandoff({ token }, { now, store: { accountDeletionConfirmationToken: { findUnique } } as never })
    ).resolves.toEqual({
      expiresAt: new Date("2026-08-02T12:15:00.000Z"),
      tokenHash: hashAccountDeletionConfirmationToken(token),
    })
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: hashAccountDeletionConfirmationToken(token) } })
    )
  })

  it("does not leave its own active token behind when email delivery fails", async () => {
    const now = new Date("2026-08-02T12:00:00.000Z")
    const updateMany = vi.fn().mockResolvedValue({ count: 1 })
    const tokenStore = { create: vi.fn(), updateMany }
    const transaction = {
      accountDeletionConfirmationToken: tokenStore,
      user: {
        update: vi.fn().mockResolvedValue({
          authVersion: 4,
          disabledAt: null,
          email: "reader@example.test",
          emailVerified: now,
          id: "user-1",
          passwordHash: null,
        }),
      },
    }
    const store = {
      $transaction: async (work: (client: typeof transaction) => Promise<unknown>) => work(transaction),
      accountDeletionConfirmationToken: tokenStore,
    }

    await expect(
      requestOAuthAccountDeletionConfirmation(
        { userId: "user-1" },
        { now, sendConfirmationEmail: vi.fn().mockRejectedValue(new Error("mail unavailable")), store: store as never }
      )
    ).rejects.toThrow("Unable to send")

    expect(updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tokenHash: expect.any(String), usedAt: null }) })
    )
  })

  it("serializes simultaneous requests so only the final email token remains usable", async () => {
    const now = new Date("2026-08-02T12:00:00.000Z")
    const tokens: Array<{
      expiresAt: Date
      purpose: string
      tokenHash: string
      usedAt: Date | null
      userId: string
    }> = []
    const sentUrls: string[] = []
    const tokenStore = {
      create: vi.fn(async ({ data }: { data: (typeof tokens)[number] }) => {
        tokens.push({ ...data, usedAt: null })
      }),
      findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) =>
        tokens.find((token) => token.tokenHash === where.tokenHash) ?? null
      ),
      updateMany: vi.fn(async ({ data, where }: { data: { usedAt: Date }; where: { userId?: string; usedAt: null } }) => {
        let count = 0
        for (const token of tokens) {
          if ((!where.userId || token.userId === where.userId) && token.usedAt === where.usedAt) {
            token.usedAt = data.usedAt
            count += 1
          }
        }
        return { count }
      }),
    }
    const transaction = {
      accountDeletionConfirmationToken: tokenStore,
      user: {
        update: vi.fn().mockResolvedValue({
          authVersion: 4,
          disabledAt: null,
          email: "reader@example.test",
          emailVerified: now,
          id: "user-1",
          passwordHash: null,
        }),
      },
    }
    let previousTransaction = Promise.resolve()
    const store = {
      $transaction: async (work: (client: typeof transaction) => Promise<unknown>) => {
        const predecessor = previousTransaction
        let release!: () => void
        previousTransaction = new Promise<void>((resolve) => {
          release = resolve
        })
        await predecessor
        try {
          return await work(transaction)
        } finally {
          release()
        }
      },
      accountDeletionConfirmationToken: tokenStore,
    }
    const sendConfirmationEmail = vi.fn(async ({ confirmationUrl }: { confirmationUrl: string }) => {
      sentUrls.push(confirmationUrl)
      return { status: "sent" as const }
    })
    vi.stubEnv("APP_ORIGIN", "https://arcticrss.com")

    await Promise.all([
      requestOAuthAccountDeletionConfirmation(
        { userId: "user-1" },
        { now, sendConfirmationEmail, store: store as never }
      ),
      requestOAuthAccountDeletionConfirmation(
        { userId: "user-1" },
        { now, sendConfirmationEmail, store: store as never }
      ),
    ])

    expect(tokens.filter((token) => !token.usedAt)).toHaveLength(1)
    expect(sentUrls).toHaveLength(2)
    const rawTokens = sentUrls.map((url) => new URL(url).hash.slice("#token=".length))
    const activeToken = rawTokens.find(
      (token) => hashAccountDeletionConfirmationToken(token) === tokens.find((item) => !item.usedAt)?.tokenHash
    )
    const replacedToken = rawTokens.find((token) => token !== activeToken)

    await expect(
      getOAuthAccountDeletionHandoff({ token: activeToken! }, { now, store: store as never })
    ).resolves.toEqual(expect.objectContaining({ tokenHash: expect.any(String) }))
    await expect(
      getOAuthAccountDeletionHandoff({ token: replacedToken! }, { now, store: store as never })
    ).rejects.toThrow("invalid or expired")
    vi.unstubAllEnvs()
  })

  it("atomically claims a current, account-bound email token before deleting the account", async () => {
    const now = new Date("2026-08-02T12:00:00.000Z")
    const token = "x".repeat(43)
    const transaction = {
      accountDeletionConfirmationToken: {
        findUnique: vi.fn().mockResolvedValue({
          authVersion: 4,
          createdAt: new Date("2026-08-02T11:58:00.000Z"),
          expiresAt: new Date("2026-08-02T12:15:00.000Z"),
          id: "deletion-token-1",
          purpose: ACCOUNT_DELETION_TOKEN_PURPOSE,
          usedAt: null,
          user: {
            authVersion: 4,
            disabledAt: null,
            emailVerified: now,
            passwordHash: null,
          },
          userId: "user-1",
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      accountDeletionRecord: { upsert: vi.fn().mockResolvedValue({ id: "deletion-1" }) },
      user: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    }
    const store = {
      $transaction: async (work: (client: typeof transaction) => Promise<unknown>) => work(transaction),
    }

    await expect(
      confirmOAuthAccountDeletion({ token, userId: "user-1" }, { now, store: store as never })
    ).resolves.toBeUndefined()

    expect(transaction.accountDeletionConfirmationToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { usedAt: now },
        where: expect.objectContaining({
          id: "deletion-token-1",
          purpose: ACCOUNT_DELETION_TOKEN_PURPOSE,
          tokenHash: hashAccountDeletionConfirmationToken(token),
          usedAt: null,
        }),
      })
    )
    expect(transaction.accountDeletionRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          policyVersion: ACCOUNT_DELETION_POLICY_VERSION,
          requestedAt: new Date("2026-08-02T11:58:00.000Z"),
        }),
      })
    )
  })

  it("rejects a token when the account auth version changed after the email was sent", async () => {
    const token = "x".repeat(43)
    const tokenUpdateMany = vi.fn()
    const transaction = {
      accountDeletionConfirmationToken: {
        findUnique: vi.fn().mockResolvedValue({
          authVersion: 4,
          createdAt: new Date("2026-08-02T11:58:00.000Z"),
          expiresAt: new Date("2026-08-02T12:15:00.000Z"),
          id: "deletion-token-1",
          purpose: ACCOUNT_DELETION_TOKEN_PURPOSE,
          usedAt: null,
          user: {
            authVersion: 5,
            disabledAt: null,
            emailVerified: new Date("2026-08-02T11:00:00.000Z"),
            passwordHash: null,
          },
          userId: "user-1",
        }),
        updateMany: tokenUpdateMany,
      },
      accountDeletionRecord: { upsert: vi.fn() },
      user: { deleteMany: vi.fn() },
    }
    const store = {
      $transaction: async (work: (client: typeof transaction) => Promise<unknown>) => work(transaction),
    }

    await expect(
      confirmOAuthAccountDeletion(
        { token, userId: "user-1" },
        { now: new Date("2026-08-02T12:00:00.000Z"), store: store as never }
      )
    ).rejects.toThrow("invalid or expired")
    expect(tokenUpdateMany).not.toHaveBeenCalled()
  })

  it("allows exactly one concurrent use of an email deletion confirmation", async () => {
    const now = new Date("2026-08-02T12:00:00.000Z")
    const token = "x".repeat(43)
    let claimed = false
    const recordUpsert = vi.fn().mockResolvedValue({ id: "deletion-1" })
    const transaction = {
      accountDeletionConfirmationToken: {
        findUnique: vi.fn().mockResolvedValue({
          authVersion: 4,
          createdAt: new Date("2026-08-02T11:58:00.000Z"),
          expiresAt: new Date("2026-08-02T12:15:00.000Z"),
          id: "deletion-token-1",
          purpose: ACCOUNT_DELETION_TOKEN_PURPOSE,
          usedAt: null,
          user: {
            authVersion: 4,
            disabledAt: null,
            emailVerified: now,
            passwordHash: null,
          },
          userId: "user-1",
        }),
        updateMany: vi.fn(async ({ where }: { where: { id?: string } }) => {
          if (where.id !== "deletion-token-1" || claimed) {
            return { count: 0 }
          }

          claimed = true
          return { count: 1 }
        }),
      },
      accountDeletionRecord: { upsert: recordUpsert },
      user: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    }
    const store = {
      $transaction: async (work: (client: typeof transaction) => Promise<unknown>) => work(transaction),
    }

    const results = await Promise.all(
      Array.from({ length: 25 }, async () => {
        try {
          await confirmOAuthAccountDeletion(
            { token, userId: "user-1" },
            { now, store: store as never }
          )
          return "deleted"
        } catch {
          return "rejected"
        }
      })
    )

    expect(results.filter((result) => result === "deleted")).toHaveLength(1)
    expect(recordUpsert).toHaveBeenCalledTimes(1)
  })
})

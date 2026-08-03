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
  parseAccountDeletionConfirmation,
  parseOAuthAccountDeletionConfirmation,
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
    const store = {
      accountDeletionConfirmationToken: tokenStore,
      user: {
        findUnique: vi.fn().mockResolvedValue({
          authVersion: 4,
          disabledAt: null,
          email: "reader@example.test",
          emailVerified: now,
          id: "user-1",
          passwordHash: null,
        }),
      },
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

import { describe, expect, it, vi } from "vitest"

import {
  AccountDeletionError,
  deleteAccount,
  getDeletionSubjectReference,
  parseAccountDeletionConfirmation,
  requireAccountDeletionReauthentication,
} from "./account-deletion"

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
})

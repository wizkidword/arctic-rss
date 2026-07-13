import { describe, expect, it, vi } from "vitest"

import type { PrismaClient } from "../generated/prisma/client"

import {
  AdminBootstrapError,
  promoteVerifiedUserToAdmin,
} from "./admin-bootstrap"

function createStore({
  disabledAt = null,
  emailVerified = new Date("2026-07-12T12:00:00.000Z"),
  matches,
  role = "USER",
  updateCount = 1,
}: {
  disabledAt?: Date | null
  emailVerified?: Date | null
  matches?: unknown[]
  role?: "ADMIN" | "USER"
  updateCount?: number
} = {}) {
  const transaction = {
    adminAuditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
    user: {
      findMany: vi
        .fn()
        .mockResolvedValue(
          matches ?? [{ disabledAt, emailVerified, id: "user-1", role }]
        ),
      updateMany: vi.fn().mockResolvedValue({ count: updateCount }),
    },
  }

  return {
    $transaction: vi.fn(async (callback) => callback(transaction)),
    transaction,
  } as unknown as Pick<PrismaClient, "$transaction"> & {
    transaction: typeof transaction
  }
}

describe("local administrator bootstrap", () => {
  it("promotes one active, verified user and writes an audit record", async () => {
    const store = createStore()

    await expect(
      promoteVerifiedUserToAdmin({
        email: "  OWNER@example.com ",
        store,
      })
    ).resolves.toEqual({ status: "promoted" })

    expect(store.transaction.user.findMany).toHaveBeenCalledWith({
      select: {
        disabledAt: true,
        emailVerified: true,
        id: true,
        role: true,
      },
      where: {
        email: {
          equals: "owner@example.com",
          mode: "insensitive",
        },
      },
    })
    expect(store.transaction.user.updateMany).toHaveBeenCalledWith({
      data: {
        authVersion: { increment: 1 },
        plan: "ADMIN",
        role: "ADMIN",
      },
      where: {
        disabledAt: null,
        emailVerified: { not: null },
        id: "user-1",
        role: "USER",
      },
    })
    expect(store.transaction.adminAuditLog.create).toHaveBeenCalledWith({
      data: {
        action: "ADMIN_BOOTSTRAP_PROMOTE",
        adminUserId: "user-1",
        metadata: { source: "local-cli" },
        targetId: "user-1",
        targetType: "User",
      },
    })
  })

  it("is idempotent for an existing active, verified administrator", async () => {
    const store = createStore({ role: "ADMIN" })

    await expect(
      promoteVerifiedUserToAdmin({ email: "owner@example.com", store })
    ).resolves.toEqual({ status: "already-admin" })

    expect(store.transaction.user.updateMany).not.toHaveBeenCalled()
    expect(store.transaction.adminAuditLog.create).not.toHaveBeenCalled()
  })

  it.each([
    ["does not exist", { matches: [] }, "No account matched"],
    [
      "is ambiguous",
      {
        matches: [
          {
            disabledAt: null,
            emailVerified: new Date(),
            id: "user-1",
            role: "USER",
          },
          {
            disabledAt: null,
            emailVerified: new Date(),
            id: "user-2",
            role: "USER",
          },
        ],
      },
      "matched multiple",
    ],
    ["is unverified", { emailVerified: null }, "must have a verified email"],
    ["is disabled", { disabledAt: new Date() }, "account is disabled"],
    ["changes during validation", { updateCount: 0 }, "changed during validation"],
  ])("refuses promotion when the target %s", async (_label, options, message) => {
    const store = createStore(options)
    const promotion = promoteVerifiedUserToAdmin({
      email: "owner@example.com",
      store,
    })

    await expect(promotion).rejects.toBeInstanceOf(AdminBootstrapError)
    await expect(promotion).rejects.toThrow(message)

    expect(store.transaction.adminAuditLog.create).not.toHaveBeenCalled()
  })
})

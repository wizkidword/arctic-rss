import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getPrisma: vi.fn(),
}))

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}))

vi.mock("@/lib/db", () => ({
  getPrisma: mocks.getPrisma,
}))

import {
  AuthorizationError,
  requireAuthenticatedUser,
  requireFreshAdmin,
  requireFreshUser,
} from "./authorization"

function session({
  authVersion = 0,
  plan = "FREE",
  role = "USER",
}: {
  authVersion?: number
  plan?: "FREE" | "PRO" | "ADMIN"
  role?: "USER" | "ADMIN"
} = {}) {
  return {
    user: {
      authVersion,
      id: "user-1",
      plan,
      role,
    },
  }
}

function currentUser({
  authVersion = 0,
  disabledAt = null,
  plan = "FREE",
  role = "USER",
}: {
  authVersion?: number
  disabledAt?: Date | null
  plan?: "FREE" | "PRO" | "ADMIN"
  role?: "USER" | "ADMIN"
} = {}) {
  return {
    authVersion,
    disabledAt,
    id: "user-1",
    plan,
    role,
  }
}

describe("fresh authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("rejects old-format sessions that lack an authorization version", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } })

    await expect(requireAuthenticatedUser()).rejects.toBeInstanceOf(
      AuthorizationError
    )
  })

  it("rejects a stale token after sessions are revoked", async () => {
    mocks.auth.mockResolvedValue(session({ authVersion: 0 }))
    mocks.getPrisma.mockReturnValue({
      user: {
        findUnique: vi.fn().mockResolvedValue(currentUser({ authVersion: 1 })),
      },
    })

    await expect(requireFreshUser()).rejects.toThrow(
      "Your session is no longer valid."
    )
  })

  it("rejects a token after an administrator has been demoted", async () => {
    mocks.auth.mockResolvedValue(session({ plan: "ADMIN", role: "ADMIN" }))
    mocks.getPrisma.mockReturnValue({
      user: {
        findUnique: vi
          .fn()
          .mockResolvedValue(currentUser({ plan: "FREE", role: "USER" })),
      },
    })

    await expect(requireFreshAdmin()).rejects.toThrow(
      "Your session is no longer valid."
    )
  })

  it("rejects a suspended account even when the token otherwise matches", async () => {
    mocks.auth.mockResolvedValue(session())
    mocks.getPrisma.mockReturnValue({
      user: {
        findUnique: vi
          .fn()
          .mockResolvedValue(currentUser({ disabledAt: new Date() })),
      },
    })

    await expect(requireFreshUser()).rejects.toThrow(
      "Your session is no longer valid."
    )
  })

  it("allows a current administrator token", async () => {
    mocks.auth.mockResolvedValue(session({ plan: "ADMIN", role: "ADMIN" }))
    mocks.getPrisma.mockReturnValue({
      user: {
        findUnique: vi
          .fn()
          .mockResolvedValue(currentUser({ plan: "ADMIN", role: "ADMIN" })),
      },
    })

    await expect(requireFreshAdmin()).resolves.toEqual(
      currentUser({ plan: "ADMIN", role: "ADMIN" })
    )
  })
})

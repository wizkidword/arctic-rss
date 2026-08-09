import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUnique: vi.fn(),
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
  withAuthenticatedRequestScope,
} from "./authorization"
import { getFreshUserState } from "./fresh-user"

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
  emailVerified = new Date("2026-01-01T00:00:00.000Z"),
  plan = "FREE",
  role = "USER",
}: {
  authVersion?: number
  disabledAt?: Date | null
  emailVerified?: Date | null
  plan?: "FREE" | "PRO" | "ADMIN"
  role?: "USER" | "ADMIN"
} = {}) {
  return {
    authVersion,
    disabledAt,
    emailVerified,
    id: "user-1",
    plan,
    role,
  }
}

describe("fresh authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getPrisma.mockReturnValue({
      user: { findUnique: mocks.findUnique },
    })
  })

  it("rejects old-format sessions that lack an authorization version", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } })

    await expect(requireAuthenticatedUser()).rejects.toBeInstanceOf(
      AuthorizationError
    )
  })

  it("rejects a stale token after sessions are revoked", async () => {
    mocks.auth.mockResolvedValue(session({ authVersion: 0 }))
    mocks.findUnique.mockResolvedValue(currentUser({ authVersion: 1 }))

    await expect(requireFreshUser()).rejects.toThrow(
      "Your session is no longer valid."
    )
  })

  it("rejects a token after an administrator has been demoted", async () => {
    mocks.auth.mockResolvedValue(session({ plan: "ADMIN", role: "ADMIN" }))
    mocks.findUnique.mockResolvedValue(
      currentUser({ plan: "FREE", role: "USER" })
    )

    await expect(requireFreshAdmin()).rejects.toThrow(
      "Your session is no longer valid."
    )
  })

  it("rejects a suspended account even when the token otherwise matches", async () => {
    mocks.auth.mockResolvedValue(session())
    mocks.findUnique.mockResolvedValue(
      currentUser({ disabledAt: new Date("2026-08-08T00:00:00.000Z") })
    )

    await expect(requireFreshUser()).rejects.toThrow(
      "Your session is no longer valid."
    )
  })

  it("allows a current administrator token", async () => {
    mocks.auth.mockResolvedValue(session({ plan: "ADMIN", role: "ADMIN" }))
    mocks.findUnique.mockResolvedValue(
      currentUser({ plan: "ADMIN", role: "ADMIN" })
    )

    await expect(requireFreshAdmin()).resolves.toEqual(
      currentUser({ plan: "ADMIN", role: "ADMIN" })
    )
  })

  it("uses one authoritative current-user query for Auth.js and a protected render", async () => {
    mocks.auth.mockImplementation(async () => {
      await getFreshUserState("user-1")
      return session()
    })
    mocks.findUnique.mockResolvedValue(currentUser())

    await expect(
      withAuthenticatedRequestScope((authenticatedSession) =>
        requireFreshUser(authenticatedSession)
      )
    ).resolves.toEqual(currentUser())

    expect(mocks.findUnique).toHaveBeenCalledTimes(1)
  })
})

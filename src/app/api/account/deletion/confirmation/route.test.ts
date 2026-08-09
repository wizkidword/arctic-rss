import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  AccountDeletionError: class AccountDeletionError extends Error {},
  AccountDeletionHandoffError: class AccountDeletionHandoffError extends Error {},
  AuthorizationError: class AuthorizationError extends Error {},
  clearAccountDeletionHandoffCookie: vi.fn(),
  confirmOAuthAccountDeletionByTokenHash: vi.fn(),
  enforceRateLimit: vi.fn(),
  getAccountDeletionHandoffSecret: vi.fn(),
  getAppOrigin: vi.fn(),
  getCookieValue: vi.fn(),
  getTrustedClientIp: vi.fn(),
  parseOAuthAccountDeletionFinalConfirmation: vi.fn(),
  requireFreshUser: vi.fn(),
  verifyAccountDeletionHandoff: vi.fn(),
}))

vi.mock("@/lib/authorization", () => ({
  AuthorizationError: mocks.AuthorizationError,
  requireFreshUser: mocks.requireFreshUser,
}))

vi.mock("@/lib/account-deletion", () => ({
  AccountDeletionError: mocks.AccountDeletionError,
  confirmOAuthAccountDeletionByTokenHash: mocks.confirmOAuthAccountDeletionByTokenHash,
  parseOAuthAccountDeletionFinalConfirmation: mocks.parseOAuthAccountDeletionFinalConfirmation,
}))

vi.mock("@/lib/account-deletion-handoff", () => ({
  ACCOUNT_DELETION_HANDOFF_COOKIE: "arcticrss-account-deletion-handoff",
  ACCOUNT_DELETION_HANDOFF_MAX_COOKIE_BYTES: 512,
  AccountDeletionHandoffError: mocks.AccountDeletionHandoffError,
  clearAccountDeletionHandoffCookie: mocks.clearAccountDeletionHandoffCookie,
  getAccountDeletionHandoffSecret: mocks.getAccountDeletionHandoffSecret,
  getCookieValue: mocks.getCookieValue,
  verifyAccountDeletionHandoff: mocks.verifyAccountDeletionHandoff,
}))

vi.mock("@/lib/app-origin", () => ({ getAppOrigin: mocks.getAppOrigin }))
vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  getTrustedClientIp: mocks.getTrustedClientIp,
}))

import { POST } from "./route"

function deletionRequest(body: unknown) {
  return new Request("https://arcticrss.com/api/account/deletion/confirmation", {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      cookie: "arcticrss-account-deletion-handoff=signed-handoff",
      origin: "https://arcticrss.com",
    },
    method: "POST",
  })
}

describe("POST /api/account/deletion/confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAppOrigin.mockReturnValue(new URL("https://arcticrss.com"))
    mocks.getTrustedClientIp.mockReturnValue("198.51.100.8")
    mocks.requireFreshUser.mockResolvedValue({ id: "user-1" })
    mocks.enforceRateLimit.mockResolvedValue({ allowed: true })
    mocks.parseOAuthAccountDeletionFinalConfirmation.mockReturnValue({ confirmation: "DELETE" })
    mocks.getCookieValue.mockReturnValue("signed-handoff")
    mocks.getAccountDeletionHandoffSecret.mockReturnValue("handoff-secret")
    mocks.verifyAccountDeletionHandoff.mockResolvedValue({ tokenHash: "a".repeat(64) })
    mocks.clearAccountDeletionHandoffCookie.mockReturnValue("handoff=; Max-Age=0")
    mocks.confirmOAuthAccountDeletionByTokenHash.mockResolvedValue(undefined)
  })

  it("rejects a request from another origin before authentication or rate limiting", async () => {
    const response = await POST(
      new Request("https://arcticrss.com/api/account/deletion/confirmation", {
        body: JSON.stringify({ confirmation: "DELETE" }),
        headers: { origin: "https://attacker.example" },
        method: "POST",
      })
    )

    expect(response.status).toBe(403)
    expect(mocks.requireFreshUser).not.toHaveBeenCalled()
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled()
  })

  it("requires a fresh session before rate limiting or signature verification", async () => {
    mocks.requireFreshUser.mockRejectedValue(new mocks.AuthorizationError("expired"))

    const response = await POST(deletionRequest({ confirmation: "DELETE" }))

    expect(response.status).toBe(401)
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled()
    expect(mocks.verifyAccountDeletionHandoff).not.toHaveBeenCalled()
  })

  it("requires a fresh session, literal DELETE, limited request, and signed handoff", async () => {
    const response = await POST(deletionRequest({ confirmation: "DELETE" }))

    expect(response.status).toBe(200)
    expect(mocks.parseOAuthAccountDeletionFinalConfirmation).toHaveBeenCalledWith({
      confirmation: "DELETE",
    })
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith({
      action: "account_deletion_confirmation",
      ip: "198.51.100.8",
      userId: "user-1",
    })
    expect(mocks.confirmOAuthAccountDeletionByTokenHash).toHaveBeenCalledWith({
      tokenHash: "a".repeat(64),
      userId: "user-1",
    })
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0")
  })

  it("fails closed when the confirmation rate limit is unavailable", async () => {
    mocks.enforceRateLimit.mockResolvedValue({ allowed: false, reason: "unavailable" })

    const response = await POST(deletionRequest({ confirmation: "DELETE" }))

    expect(response.status).toBe(429)
    expect(mocks.verifyAccountDeletionHandoff).not.toHaveBeenCalled()
    expect(mocks.confirmOAuthAccountDeletionByTokenHash).not.toHaveBeenCalled()
  })

  it("rate-limits before parsing or verifying the handoff", async () => {
    const calls: string[] = []
    mocks.enforceRateLimit.mockImplementation(async () => {
      calls.push("rate-limit")
      return { allowed: true }
    })
    mocks.verifyAccountDeletionHandoff.mockImplementation(async () => {
      calls.push("verify")
      return { tokenHash: "a".repeat(64) }
    })

    const response = await POST(deletionRequest({ confirmation: "DELETE" }))

    expect(response.status).toBe(200)
    expect(calls).toEqual(["rate-limit", "verify"])
  })

  it("rejects an oversized handoff before signature verification", async () => {
    mocks.getCookieValue.mockReturnValue("x".repeat(513))

    const response = await POST(deletionRequest({ confirmation: "DELETE" }))

    expect(response.status).toBe(400)
    expect(mocks.enforceRateLimit).toHaveBeenCalledTimes(1)
    expect(mocks.verifyAccountDeletionHandoff).not.toHaveBeenCalled()
  })

  it("rejects a missing handoff before signature verification", async () => {
    mocks.getCookieValue.mockReturnValue(null)

    const response = await POST(deletionRequest({ confirmation: "DELETE" }))

    expect(response.status).toBe(400)
    expect(mocks.verifyAccountDeletionHandoff).not.toHaveBeenCalled()
  })

  it("bounds the confirmation JSON body after rate limiting", async () => {
    const response = await POST(deletionRequest({ confirmation: "DELETE", padding: "x".repeat(2_000) }))

    expect(response.status).toBe(400)
    expect(mocks.enforceRateLimit).toHaveBeenCalledTimes(1)
    expect(mocks.parseOAuthAccountDeletionFinalConfirmation).not.toHaveBeenCalled()
    expect(mocks.verifyAccountDeletionHandoff).not.toHaveBeenCalled()
  })

  it("clears a tampered or expired handoff instead of accepting a raw browser token", async () => {
    mocks.verifyAccountDeletionHandoff.mockImplementation(() => {
      throw new mocks.AccountDeletionHandoffError("Account deletion confirmation is invalid or expired.")
    })

    const response = await POST(deletionRequest({ confirmation: "DELETE" }))

    expect(response.status).toBe(400)
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0")
    expect(mocks.confirmOAuthAccountDeletionByTokenHash).not.toHaveBeenCalled()
  })
})

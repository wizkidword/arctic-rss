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
    mocks.verifyAccountDeletionHandoff.mockReturnValue({ tokenHash: "a".repeat(64) })
    mocks.clearAccountDeletionHandoffCookie.mockReturnValue("handoff=; Max-Age=0")
    mocks.confirmOAuthAccountDeletionByTokenHash.mockResolvedValue(undefined)
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
    expect(mocks.confirmOAuthAccountDeletionByTokenHash).not.toHaveBeenCalled()
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

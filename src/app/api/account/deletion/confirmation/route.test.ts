import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  AccountDeletionError: class AccountDeletionError extends Error {},
  AuthorizationError: class AuthorizationError extends Error {},
  confirmOAuthAccountDeletion: vi.fn(),
  enforceRateLimit: vi.fn(),
  getAppOrigin: vi.fn(),
  getTrustedClientIp: vi.fn(),
  parseOAuthAccountDeletionConfirmation: vi.fn(),
  requireFreshUser: vi.fn(),
}))

vi.mock("@/lib/authorization", () => ({
  AuthorizationError: mocks.AuthorizationError,
  requireFreshUser: mocks.requireFreshUser,
}))

vi.mock("@/lib/account-deletion", () => ({
  AccountDeletionError: mocks.AccountDeletionError,
  confirmOAuthAccountDeletion: mocks.confirmOAuthAccountDeletion,
  parseOAuthAccountDeletionConfirmation: mocks.parseOAuthAccountDeletionConfirmation,
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
    headers: { "content-type": "application/json", origin: "https://arcticrss.com" },
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
    mocks.parseOAuthAccountDeletionConfirmation.mockReturnValue({ token: "x".repeat(43) })
    mocks.confirmOAuthAccountDeletion.mockResolvedValue(undefined)
  })

  it("requires a fresh session, literal DELETE, and a limited final confirmation", async () => {
    const response = await POST(deletionRequest({ confirmation: "DELETE", token: "x".repeat(43) }))

    expect(response.status).toBe(200)
    expect(mocks.parseOAuthAccountDeletionConfirmation).toHaveBeenCalledWith({
      confirmation: "DELETE",
      token: "x".repeat(43),
    })
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith({
      action: "account_deletion_confirmation",
      ip: "198.51.100.8",
      userId: "user-1",
    })
    expect(mocks.confirmOAuthAccountDeletion).toHaveBeenCalledWith({
      token: "x".repeat(43),
      userId: "user-1",
    })
    expect(response.headers.get("cache-control")).toBe("no-store")
  })

  it("fails closed when the confirmation rate limit is unavailable", async () => {
    mocks.enforceRateLimit.mockResolvedValue({ allowed: false, reason: "unavailable" })

    const response = await POST(deletionRequest({ confirmation: "DELETE", token: "x".repeat(43) }))

    expect(response.status).toBe(429)
    expect(mocks.confirmOAuthAccountDeletion).not.toHaveBeenCalled()
  })
})

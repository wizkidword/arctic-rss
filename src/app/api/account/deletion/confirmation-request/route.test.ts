import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  AccountDeletionError: class AccountDeletionError extends Error {},
  AuthorizationError: class AuthorizationError extends Error {},
  enforceRateLimit: vi.fn(),
  getAppOrigin: vi.fn(),
  getTrustedClientIp: vi.fn(),
  parseOAuthAccountDeletionConfirmationRequest: vi.fn(),
  requestOAuthAccountDeletionConfirmation: vi.fn(),
  requireFreshUser: vi.fn(),
}))

vi.mock("@/lib/authorization", () => ({
  AuthorizationError: mocks.AuthorizationError,
  requireFreshUser: mocks.requireFreshUser,
}))

vi.mock("@/lib/account-deletion", () => ({
  AccountDeletionError: mocks.AccountDeletionError,
  parseOAuthAccountDeletionConfirmationRequest: mocks.parseOAuthAccountDeletionConfirmationRequest,
  requestOAuthAccountDeletionConfirmation: mocks.requestOAuthAccountDeletionConfirmation,
}))

vi.mock("@/lib/app-origin", () => ({ getAppOrigin: mocks.getAppOrigin }))
vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  getTrustedClientIp: mocks.getTrustedClientIp,
}))

import { POST } from "./route"

function deletionRequest(body: unknown, origin = "https://arcticrss.com") {
  return new Request("https://arcticrss.com/api/account/deletion/confirmation-request", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", origin },
    method: "POST",
  })
}

describe("POST /api/account/deletion/confirmation-request", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAppOrigin.mockReturnValue(new URL("https://arcticrss.com"))
    mocks.getTrustedClientIp.mockReturnValue("198.51.100.8")
    mocks.requireFreshUser.mockResolvedValue({ id: "user-1" })
    mocks.enforceRateLimit.mockResolvedValue({ allowed: true })
    mocks.parseOAuthAccountDeletionConfirmationRequest.mockReturnValue({ confirmation: "DELETE" })
    mocks.requestOAuthAccountDeletionConfirmation.mockResolvedValue({ status: "sent" })
  })

  it("requires the application origin before issuing an email confirmation", async () => {
    const response = await POST(deletionRequest({ confirmation: "DELETE" }, "https://attacker.test"))

    expect(response.status).toBe(403)
    expect(mocks.requireFreshUser).not.toHaveBeenCalled()
    expect(mocks.requestOAuthAccountDeletionConfirmation).not.toHaveBeenCalled()
  })

  it("uses a fresh user, literal DELETE, and a bounded request limit", async () => {
    const response = await POST(deletionRequest({ confirmation: "DELETE" }))

    expect(response.status).toBe(200)
    expect(mocks.parseOAuthAccountDeletionConfirmationRequest).toHaveBeenCalledWith({
      confirmation: "DELETE",
    })
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith({
      action: "account_deletion_confirmation_request",
      ip: "198.51.100.8",
      userId: "user-1",
    })
    expect(mocks.requestOAuthAccountDeletionConfirmation).toHaveBeenCalledWith({ userId: "user-1" })
    expect(response.headers.get("cache-control")).toBe("no-store")
  })
})

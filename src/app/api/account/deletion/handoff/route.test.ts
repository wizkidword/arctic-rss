import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  AccountDeletionError: class AccountDeletionError extends Error {},
  clearAccountDeletionHandoffCookie: vi.fn(),
  createAccountDeletionHandoff: vi.fn(),
  enforceRateLimit: vi.fn(),
  getAccountDeletionHandoffSecret: vi.fn(),
  getAppOrigin: vi.fn(),
  getOAuthAccountDeletionHandoff: vi.fn(),
  getTrustedClientIp: vi.fn(),
  makeAccountDeletionHandoffCookie: vi.fn(),
  parseOAuthAccountDeletionHandoff: vi.fn(),
}))

vi.mock("@/lib/account-deletion", () => ({
  AccountDeletionError: mocks.AccountDeletionError,
  getOAuthAccountDeletionHandoff: mocks.getOAuthAccountDeletionHandoff,
  parseOAuthAccountDeletionHandoff: mocks.parseOAuthAccountDeletionHandoff,
}))

vi.mock("@/lib/account-deletion-handoff", () => ({
  clearAccountDeletionHandoffCookie: mocks.clearAccountDeletionHandoffCookie,
  createAccountDeletionHandoff: mocks.createAccountDeletionHandoff,
  getAccountDeletionHandoffSecret: mocks.getAccountDeletionHandoffSecret,
  makeAccountDeletionHandoffCookie: mocks.makeAccountDeletionHandoffCookie,
}))

vi.mock("@/lib/app-origin", () => ({ getAppOrigin: mocks.getAppOrigin }))
vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  getTrustedClientIp: mocks.getTrustedClientIp,
}))

import { DELETE, POST } from "./route"

function handoffRequest(body: unknown, origin = "https://arcticrss.com") {
  return new Request("https://arcticrss.com/api/account/deletion/handoff", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", origin },
    method: "POST",
  })
}

describe("/api/account/deletion/handoff", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAppOrigin.mockReturnValue(new URL("https://arcticrss.com"))
    mocks.getTrustedClientIp.mockReturnValue("198.51.100.8")
    mocks.parseOAuthAccountDeletionHandoff.mockReturnValue({ token: "x".repeat(43) })
    mocks.enforceRateLimit.mockResolvedValue({ allowed: true })
    mocks.getOAuthAccountDeletionHandoff.mockResolvedValue({
      expiresAt: new Date("2026-08-08T12:15:00.000Z"),
      tokenHash: "a".repeat(64),
    })
    mocks.getAccountDeletionHandoffSecret.mockReturnValue("handoff-secret")
    mocks.createAccountDeletionHandoff.mockReturnValue("signed-handoff")
    mocks.makeAccountDeletionHandoffCookie.mockReturnValue("handoff=signed-handoff; HttpOnly")
    mocks.clearAccountDeletionHandoffCookie.mockReturnValue("handoff=; Max-Age=0")
  })

  it("accepts a fragment token only through a same-origin, rate-limited POST", async () => {
    const response = await POST(handoffRequest({ token: "x".repeat(43) }))

    expect(response.status).toBe(200)
    expect(mocks.parseOAuthAccountDeletionHandoff).toHaveBeenCalledWith({ token: "x".repeat(43) })
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith({
      action: "account_deletion_handoff",
      ip: "198.51.100.8",
      token: "x".repeat(43),
    })
    expect(mocks.getOAuthAccountDeletionHandoff).toHaveBeenCalledWith({ token: "x".repeat(43) })
    expect(response.headers.get("set-cookie")).toContain("HttpOnly")
    expect(response.headers.get("cache-control")).toBe("no-store")
  })

  it("rejects a cross-origin exchange before parsing the token", async () => {
    const response = await POST(handoffRequest({ token: "x".repeat(43) }, "https://attacker.test"))

    expect(response.status).toBe(403)
    expect(mocks.parseOAuthAccountDeletionHandoff).not.toHaveBeenCalled()
  })

  it("clears a rejected token handoff", async () => {
    mocks.getOAuthAccountDeletionHandoff.mockRejectedValue(
      new mocks.AccountDeletionError("This deletion confirmation is invalid or expired.")
    )

    const response = await POST(handoffRequest({ token: "x".repeat(43) }))

    expect(response.status).toBe(400)
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0")
  })

  it("clears the handoff on same-origin cancellation", async () => {
    const request = new Request("https://arcticrss.com/api/account/deletion/handoff", {
      headers: { origin: "https://arcticrss.com" },
      method: "DELETE",
    })
    const response = await DELETE(request)

    expect(response.status).toBe(200)
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0")
  })
})

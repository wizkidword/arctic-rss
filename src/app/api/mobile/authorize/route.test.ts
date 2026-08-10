import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  class AuthorizationError extends Error {}
  class MobileAuthError extends Error {}

  return {
    AuthorizationError,
    MobileAuthError,
    auth: vi.fn(),
    enforceRateLimit: vi.fn(),
    getAppOrigin: vi.fn(),
    getTrustedClientIp: vi.fn(),
    issueDeviceAuthorizationCode: vi.fn(),
    parseBrowserDeviceAuthorizationRequest: vi.fn(),
    requireFreshUser: vi.fn(),
  }
})

vi.mock("@/auth", () => ({ auth: mocks.auth }))
vi.mock("@/lib/authorization", () => ({
  AuthorizationError: mocks.AuthorizationError,
  requireFreshUser: mocks.requireFreshUser,
}))
vi.mock("@/lib/app-origin", () => ({ getAppOrigin: mocks.getAppOrigin }))
vi.mock("@/lib/mobile-auth", () => ({
  issueDeviceAuthorizationCode: mocks.issueDeviceAuthorizationCode,
  MobileAuthError: mocks.MobileAuthError,
  parseBrowserDeviceAuthorizationRequest: mocks.parseBrowserDeviceAuthorizationRequest,
}))
vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  getTrustedClientIp: mocks.getTrustedClientIp,
}))

import { GET } from "./route"

describe("GET /api/mobile/authorize", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAppOrigin.mockReturnValue(new URL("https://arcticrss.example"))
    mocks.parseBrowserDeviceAuthorizationRequest.mockReturnValue(authorizationRequest)
    mocks.auth.mockResolvedValue({
      user: { authVersion: 2, id: "user-1", plan: "FREE", role: "USER" },
    })
    mocks.requireFreshUser.mockResolvedValue({ authVersion: 2, id: "user-1" })
    mocks.enforceRateLimit.mockResolvedValue({ allowed: true })
    mocks.getTrustedClientIp.mockReturnValue("198.51.100.24")
    mocks.issueDeviceAuthorizationCode.mockResolvedValue({ code: "one-time-code" })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("uses an existing fresh browser login to issue a no-store PKCE code redirect", async () => {
    const response = await GET(authorizeRequest())

    expect(response.status).toBe(303)
    expect(response.headers.get("location")).toBe(
      "arcticrss://auth/callback?code=one-time-code&state=state-for-test-request"
    )
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0")
    expect(response.headers.get("referrer-policy")).toBe("no-referrer")
    expect(mocks.issueDeviceAuthorizationCode).toHaveBeenCalledWith({
      authVersion: 2,
      request: authorizationRequest,
      userId: "user-1",
    })
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith({
      action: "mobile_device_authorization",
      ip: "198.51.100.24",
      userId: "user-1",
    })
  })

  it("returns to the exact local authorization URL after browser login", async () => {
    mocks.auth.mockResolvedValue(null)

    const response = await GET(authorizeRequest("?nonce=one&state=two"))

    expect(response.status).toBe(303)
    const redirect = new URL(response.headers.get("location") ?? "")
    expect(redirect.origin).toBe("https://arcticrss.example")
    expect(redirect.pathname).toBe("/login")
    expect(redirect.searchParams.get("callbackUrl")).toBe(
      "/api/mobile/authorize?nonce=one&state=two"
    )
    expect(mocks.issueDeviceAuthorizationCode).not.toHaveBeenCalled()
  })

  it("rejects malformed requests before invoking browser authentication", async () => {
    mocks.parseBrowserDeviceAuthorizationRequest.mockImplementation(() => {
      throw new mocks.MobileAuthError()
    })

    const response = await GET(authorizeRequest())

    expect(response.status).toBe(400)
    expect(mocks.auth).not.toHaveBeenCalled()
    expect(mocks.issueDeviceAuthorizationCode).not.toHaveBeenCalled()
  })
})

const authorizationRequest = {
  appVersion: "0.1.0-test",
  codeChallenge: "a".repeat(43),
  codeChallengeMethod: "S256",
  deviceName: "Test Android",
  nonce: "nonce-for-test-request",
  platform: "android",
  redirectUri: "arcticrss://auth/callback",
  state: "state-for-test-request",
}

function authorizeRequest(query = "") {
  return new Request(`https://arcticrss.example/api/mobile/authorize${query}`)
}

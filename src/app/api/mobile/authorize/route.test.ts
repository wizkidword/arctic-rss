import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  class AuthorizationError extends Error {}
  class MobileAuthError extends Error {}

  return {
    approveMobileAuthorizationRequest: vi.fn(),
    AuthorizationError,
    auth: vi.fn(),
    cancelMobileAuthorizationRequest: vi.fn(),
    createMobileAuthorizationRequest: vi.fn(),
    enforceRateLimit: vi.fn(),
    getMobileAuthorizationBrowserSessionHash: vi.fn(),
    getAppOrigin: vi.fn(),
    getTrustedClientIp: vi.fn(),
    isNativeMobileAuthorizationEnabled: vi.fn(),
    MobileAuthError,
    parseBrowserDeviceAuthorizationRequest: vi.fn(),
    requireMobileAuthorizationReauthentication: vi.fn(),
    requireFreshUser: vi.fn(),
  }
})

vi.mock("@/auth", () => ({ auth: mocks.auth }))
vi.mock("@/lib/authorization", () => ({
  AuthorizationError: mocks.AuthorizationError,
  requireFreshUser: mocks.requireFreshUser,
}))
vi.mock("@/lib/app-origin", () => ({ getAppOrigin: mocks.getAppOrigin }))
vi.mock("@/lib/mobile-auth-configuration", () => ({
  isNativeMobileAuthorizationEnabled: mocks.isNativeMobileAuthorizationEnabled,
}))
vi.mock("@/lib/mobile-auth", () => ({
  approveMobileAuthorizationRequest: mocks.approveMobileAuthorizationRequest,
  cancelMobileAuthorizationRequest: mocks.cancelMobileAuthorizationRequest,
  createMobileAuthorizationRequest: mocks.createMobileAuthorizationRequest,
  getMobileAuthorizationBrowserSessionHash: mocks.getMobileAuthorizationBrowserSessionHash,
  MobileAuthError: mocks.MobileAuthError,
  parseBrowserDeviceAuthorizationRequest: mocks.parseBrowserDeviceAuthorizationRequest,
  requireMobileAuthorizationReauthentication: mocks.requireMobileAuthorizationReauthentication,
}))
vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  getTrustedClientIp: mocks.getTrustedClientIp,
}))

import { GET, POST } from "./route"

describe("/api/mobile/authorize", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAppOrigin.mockReturnValue(new URL("https://arcticrss.example"))
    mocks.isNativeMobileAuthorizationEnabled.mockReturnValue(true)
    mocks.parseBrowserDeviceAuthorizationRequest.mockReturnValue(authorizationRequest)
    mocks.auth.mockResolvedValue({
      user: { authVersion: 2, email: "reader@example.test", id: "user-1", plan: "FREE", role: "USER" },
    })
    mocks.requireFreshUser.mockResolvedValue({ authVersion: 2, id: "user-1" })
    mocks.enforceRateLimit.mockResolvedValue({ allowed: true })
    mocks.getTrustedClientIp.mockReturnValue("198.51.100.24")
    mocks.getMobileAuthorizationBrowserSessionHash.mockReturnValue("browser-session-hash")
    mocks.createMobileAuthorizationRequest.mockResolvedValue({
      approvalToken: "approval-token",
      id: "request-1",
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders a no-store approval page and never issues a code from GET", async () => {
    const response = await GET(authorizeRequest())

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("text/html")
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0")
    await expect(response.text()).resolves.toContain("Authorize Arctic RSS for Android")
    expect(mocks.createMobileAuthorizationRequest).toHaveBeenCalledWith({
      authVersion: 2,
      browserSessionHash: "browser-session-hash",
      request: authorizationRequest,
      userId: "user-1",
    })
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith({
      action: "mobile_device_authorization",
      ip: "198.51.100.24",
      userId: "user-1",
    })
    expect(mocks.approveMobileAuthorizationRequest).not.toHaveBeenCalled()
  })

  it("fails closed before parsing or authenticating when native authorization is disabled", async () => {
    mocks.isNativeMobileAuthorizationEnabled.mockReturnValue(false)

    const response = await GET(authorizeRequest())

    expect(response.status).toBe(404)
    expect(mocks.parseBrowserDeviceAuthorizationRequest).not.toHaveBeenCalled()
    expect(mocks.auth).not.toHaveBeenCalled()
    expect(mocks.createMobileAuthorizationRequest).not.toHaveBeenCalled()
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
    expect(mocks.createMobileAuthorizationRequest).not.toHaveBeenCalled()
  })

  it("rejects malformed requests before invoking browser authentication", async () => {
    mocks.parseBrowserDeviceAuthorizationRequest.mockImplementation(() => {
      throw new mocks.MobileAuthError()
    })

    const response = await GET(authorizeRequest())

    expect(response.status).toBe(400)
    expect(mocks.auth).not.toHaveBeenCalled()
    expect(mocks.createMobileAuthorizationRequest).not.toHaveBeenCalled()
  })

  it("issues a code only after an explicit approval POST", async () => {
    mocks.approveMobileAuthorizationRequest.mockResolvedValue({
      code: "one-time-code",
      redirectUri: "https://arcticrss.com/mobile/auth/callback",
      state: "state-for-test-request",
    })

    const response = await POST(approvalRequest("approve"))

    expect(response.status).toBe(303)
    expect(response.headers.get("location")).toBe(
      "https://arcticrss.com/mobile/auth/callback?state=state-for-test-request&code=one-time-code"
    )
    expect(mocks.approveMobileAuthorizationRequest).toHaveBeenCalledWith({
      approvalToken: "approval-token",
      browserSessionHash: "browser-session-hash",
      requestId: "request-1",
      userId: "user-1",
    })
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith({
      action: "mobile_device_authorization_approval",
      ip: "198.51.100.24",
      userId: "user-1",
    })
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith({
      action: "mobile_device_authorization_approval_prebody",
      ip: "198.51.100.24",
    })
    expect(mocks.requireMobileAuthorizationReauthentication).toHaveBeenCalledWith({
      currentPassword: "correct horse battery staple",
      expectedAuthVersion: 2,
      userId: "user-1",
    })
    expect(mocks.cancelMobileAuthorizationRequest).not.toHaveBeenCalled()
  })

  it("returns a registered-client cancellation without issuing a code", async () => {
    mocks.cancelMobileAuthorizationRequest.mockResolvedValue({
      redirectUri: "https://arcticrss.com/mobile/auth/callback",
      state: "state-for-test-request",
    })

    const response = await POST(approvalRequest("cancel"))

    expect(response.status).toBe(303)
    expect(response.headers.get("location")).toBe(
      "https://arcticrss.com/mobile/auth/callback?state=state-for-test-request&error=access_denied"
    )
    expect(mocks.cancelMobileAuthorizationRequest).toHaveBeenCalledWith({
      approvalToken: "approval-token",
      browserSessionHash: "browser-session-hash",
      requestId: "request-1",
      userId: "user-1",
    })
    expect(mocks.approveMobileAuthorizationRequest).not.toHaveBeenCalled()
  })

  it("fails closed for disabled approval POSTs", async () => {
    mocks.isNativeMobileAuthorizationEnabled.mockReturnValue(false)

    const response = await POST(approvalRequest("approve"))

    expect(response.status).toBe(404)
    expect(mocks.auth).not.toHaveBeenCalled()
    expect(mocks.approveMobileAuthorizationRequest).not.toHaveBeenCalled()
  })

  it("rejects cross-origin, multipart, and duplicate approval forms before authentication", async () => {
    const crossOrigin = await POST(approvalRequest("approve", { origin: "https://attacker.example" }))
    expect(crossOrigin.status).toBe(400)
    expect(mocks.auth).not.toHaveBeenCalled()

    const missingOrigin = await POST(new Request("https://arcticrss.example/api/mobile/authorize", {
      body: "approval_token=one&current_password=p&decision=approve&request_id=request-1",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
    }))
    expect(missingOrigin.status).toBe(400)
    expect(mocks.auth).not.toHaveBeenCalled()

    const multipart = new Request("https://arcticrss.example/api/mobile/authorize", {
      body: new FormData(),
      headers: { Origin: "https://arcticrss.example" },
      method: "POST",
    })
    const multipartResponse = await POST(multipart)
    expect(multipartResponse.status).toBe(400)

    const duplicate = new Request("https://arcticrss.example/api/mobile/authorize", {
      body: "approval_token=one&approval_token=two&current_password=p&decision=approve&request_id=request-1",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: "https://arcticrss.example",
      },
      method: "POST",
    })
    const duplicateResponse = await POST(duplicate)
    expect(duplicateResponse.status).toBe(400)
    expect(mocks.auth).not.toHaveBeenCalled()
  })
})

const authorizationRequest = {
  appVersion: "0.1.0-test",
  clientId: "android:com.arcticrss.reader",
  codeChallenge: "a".repeat(43),
  codeChallengeMethod: "S256",
  deviceName: "Test Android",
  nonce: "nonce-for-test-request",
  platform: "android",
  redirectUri: "https://arcticrss.com/mobile/auth/callback",
  state: "state-for-test-request",
}

function authorizeRequest(query = "") {
  return new Request(`https://arcticrss.example/api/mobile/authorize${query}`)
}

function approvalRequest(
  decision: "approve" | "cancel",
  { origin = "https://arcticrss.example" }: { origin?: string } = {}
) {
  const form = new URLSearchParams({
    approval_token: "approval-token",
    current_password: decision === "approve" ? "correct horse battery staple" : "",
    decision,
    request_id: "request-1",
  })
  return new Request("https://arcticrss.example/api/mobile/authorize", {
    body: form.toString(),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: "authjs.session-token=browser-session-token",
      Origin: origin,
    },
    method: "POST",
  })
}

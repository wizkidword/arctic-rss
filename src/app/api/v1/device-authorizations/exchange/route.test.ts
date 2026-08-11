import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  class MobileAuthError extends Error {
    constructor(readonly code: string) {
      super(code)
    }
  }
  class BoundedJsonBodyError extends Error {
    constructor(readonly code: string) {
      super(code)
    }
  }

  return {
    BoundedJsonBodyError,
    enforceRateLimit: vi.fn(),
    exchangeDeviceAuthorizationCode: vi.fn(),
    getTrustedClientIp: vi.fn(),
    isNativeMobileAuthorizationEnabled: vi.fn(),
    MobileAuthError,
    parseDeviceAuthorizationExchangeRequest: vi.fn(),
    readBoundedJsonBody: vi.fn(),
  }
})

vi.mock("@/lib/mobile-auth", () => ({
  exchangeDeviceAuthorizationCode: mocks.exchangeDeviceAuthorizationCode,
  MobileAuthError: mocks.MobileAuthError,
  parseDeviceAuthorizationExchangeRequest: mocks.parseDeviceAuthorizationExchangeRequest,
}))
vi.mock("@/lib/api-v1/route", () => ({
  apiV1ErrorResponse: ({ code, retryable, status }: { code: string; retryable: boolean; status: number }) =>
    Response.json({ error: { code, retryable } }, { status }),
  apiV1SuccessResponse: ({ data }: { data: unknown }) =>
    Response.json({ data }, { headers: { "Cache-Control": "private, no-store, max-age=0" } }),
}))
vi.mock("@/lib/api-v1/bounded-json", () => ({
  BoundedJsonBodyError: mocks.BoundedJsonBodyError,
  readBoundedJsonBody: mocks.readBoundedJsonBody,
}))
vi.mock("@/lib/mobile-auth-configuration", () => ({
  isNativeMobileAuthorizationEnabled: mocks.isNativeMobileAuthorizationEnabled,
}))
vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  getTrustedClientIp: mocks.getTrustedClientIp,
}))

import { POST } from "./route"

describe("POST /api/v1/device-authorizations/exchange", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.parseDeviceAuthorizationExchangeRequest.mockReturnValue(exchangeRequest)
    mocks.readBoundedJsonBody.mockResolvedValue(exchangeRequest)
    mocks.enforceRateLimit.mockResolvedValue({ allowed: true })
    mocks.getTrustedClientIp.mockReturnValue("198.51.100.24")
    mocks.isNativeMobileAuthorizationEnabled.mockReturnValue(true)
    mocks.exchangeDeviceAuthorizationCode.mockResolvedValue({
      accessToken: "access-token",
      accessTokenExpiresIn: 900,
      refreshToken: "refresh-token",
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns no-store device tokens only after pre-body and code-specific limits", async () => {
    const response = await POST(exchangeHttpRequest())

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0")
    await expect(response.json()).resolves.toMatchObject({
      data: { accessToken: "access-token", accessTokenExpiresIn: 900, refreshToken: "refresh-token" },
    })
    expect(mocks.enforceRateLimit).toHaveBeenNthCalledWith(1, {
      action: "mobile_token_exchange_prebody",
      ip: "198.51.100.24",
    })
    expect(mocks.enforceRateLimit).toHaveBeenNthCalledWith(2, {
      action: "mobile_token_exchange",
      token: exchangeRequest.code,
    })
  })

  it("fails closed before reading a token request when native authorization is disabled", async () => {
    mocks.isNativeMobileAuthorizationEnabled.mockReturnValue(false)

    const response = await POST(exchangeHttpRequest())

    expect(response.status).toBe(404)
    expect(mocks.readBoundedJsonBody).not.toHaveBeenCalled()
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled()
  })

  it("returns a bounded body error without logging the request body", async () => {
    const error = new mocks.BoundedJsonBodyError("request-too-large")
    mocks.readBoundedJsonBody.mockRejectedValue(error)
    const consoleError = vi.spyOn(console, "error")

    const response = await POST(exchangeHttpRequest())

    expect(response.status).toBe(413)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "REQUEST_TOO_LARGE", retryable: false },
    })
    expect(consoleError).not.toHaveBeenCalled()
  })

  it("does not disclose why an authorization code is rejected", async () => {
    mocks.exchangeDeviceAuthorizationCode.mockRejectedValue(
      new mocks.MobileAuthError("authorization-invalid")
    )

    const response = await POST(exchangeHttpRequest())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "DEVICE_AUTHORIZATION_INVALID", retryable: false },
    })
  })
})

const exchangeRequest = {
  code: "c".repeat(43),
  codeVerifier: "v".repeat(43),
  nonce: "nonce-for-exchange-route-test",
  redirectUri: "arcticrss://auth/callback",
}

function exchangeHttpRequest() {
  return new Request("https://arcticrss.example/api/v1/device-authorizations/exchange", {
    body: JSON.stringify(exchangeRequest),
    headers: { "content-type": "application/json" },
    method: "POST",
  })
}

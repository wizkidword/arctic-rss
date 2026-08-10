import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  class MobileAuthError extends Error {
    constructor(readonly code: string) {
      super(code)
    }
  }

  return {
    enforceRateLimit: vi.fn(),
    exchangeDeviceAuthorizationCode: vi.fn(),
    getTrustedClientIp: vi.fn(),
    MobileAuthError,
    parseDeviceAuthorizationExchangeRequest: vi.fn(),
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
vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  getTrustedClientIp: mocks.getTrustedClientIp,
}))

import { POST } from "./route"

describe("POST /api/v1/device-authorizations/exchange", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.parseDeviceAuthorizationExchangeRequest.mockReturnValue(exchangeRequest)
    mocks.enforceRateLimit.mockResolvedValue({ allowed: true })
    mocks.getTrustedClientIp.mockReturnValue("198.51.100.24")
    mocks.exchangeDeviceAuthorizationCode.mockResolvedValue({
      accessToken: "access-token",
      accessTokenExpiresIn: 900,
      refreshToken: "refresh-token",
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns no-store device tokens only after the code-specific limit", async () => {
    const response = await POST(exchangeHttpRequest())

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0")
    await expect(response.json()).resolves.toMatchObject({
      data: { accessToken: "access-token", accessTokenExpiresIn: 900, refreshToken: "refresh-token" },
    })
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith({
      action: "mobile_token_exchange",
      ip: "198.51.100.24",
      token: exchangeRequest.code,
    })
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

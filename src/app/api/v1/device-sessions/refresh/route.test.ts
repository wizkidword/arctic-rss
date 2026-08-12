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
    getTrustedClientIp: vi.fn(),
    isNativeMobileAuthorizationEnabled: vi.fn(),
    MobileAuthError,
    parseMobileRefreshRequest: vi.fn(),
    readBoundedJsonBody: vi.fn(),
    refreshMobileDeviceSession: vi.fn(),
  }
})

vi.mock("@/lib/mobile-auth", () => ({
  MobileAuthError: mocks.MobileAuthError,
  parseMobileRefreshRequest: mocks.parseMobileRefreshRequest,
  refreshMobileDeviceSession: mocks.refreshMobileDeviceSession,
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

describe("POST /api/v1/device-sessions/refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.parseMobileRefreshRequest.mockReturnValue(refreshRequest)
    mocks.readBoundedJsonBody.mockResolvedValue(refreshRequest)
    mocks.enforceRateLimit.mockResolvedValue({ allowed: true })
    mocks.getTrustedClientIp.mockReturnValue("198.51.100.24")
    mocks.isNativeMobileAuthorizationEnabled.mockReturnValue(true)
    mocks.refreshMobileDeviceSession.mockResolvedValue({
      accessToken: "next-access-token",
      accessTokenExpiresIn: 900,
      refreshToken: "next-refresh-token",
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("rotates only through a no-store response after pre-body and secret-specific limits", async () => {
    const response = await POST(refreshHttpRequest())

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0")
    expect(mocks.enforceRateLimit).toHaveBeenNthCalledWith(1, {
      action: "mobile_token_refresh_prebody",
      ip: "198.51.100.24",
    })
    expect(mocks.enforceRateLimit).toHaveBeenNthCalledWith(2, {
      action: "mobile_token_refresh",
      token: refreshRequest.refreshToken,
    })
  })

  it("does not log a malformed token body", async () => {
    mocks.readBoundedJsonBody.mockRejectedValue(new mocks.BoundedJsonBodyError("invalid-body"))
    const consoleError = vi.spyOn(console, "error")

    const response = await POST(refreshHttpRequest())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "MOBILE_REFRESH_INVALID", retryable: false },
    })
    expect(consoleError).not.toHaveBeenCalled()
  })

  it("fails closed before reading, rate limiting, or rotating when native authorization is disabled", async () => {
    mocks.isNativeMobileAuthorizationEnabled.mockReturnValue(false)

    const response = await POST(refreshHttpRequest())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "RESOURCE_NOT_FOUND", retryable: false },
    })
    expect(mocks.readBoundedJsonBody).not.toHaveBeenCalled()
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled()
    expect(mocks.refreshMobileDeviceSession).not.toHaveBeenCalled()
  })

  it("returns one invalid-refresh shape for replay and expiration", async () => {
    mocks.refreshMobileDeviceSession.mockRejectedValue(new mocks.MobileAuthError("refresh-invalid"))

    const response = await POST(refreshHttpRequest())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "MOBILE_REFRESH_INVALID", retryable: false },
    })
  })
})

const refreshRequest = { refreshToken: "r".repeat(43) }

function refreshHttpRequest() {
  return new Request("https://arcticrss.example/api/v1/device-sessions/refresh", {
    body: JSON.stringify(refreshRequest),
    headers: { "content-type": "application/json" },
    method: "POST",
  })
}

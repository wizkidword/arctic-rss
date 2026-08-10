import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  class MobileAuthError extends Error {
    constructor(readonly code: string) {
      super(code)
    }
  }

  return {
    enforceRateLimit: vi.fn(),
    getTrustedClientIp: vi.fn(),
    MobileAuthError,
    parseMobileRefreshRequest: vi.fn(),
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
vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  getTrustedClientIp: mocks.getTrustedClientIp,
}))

import { POST } from "./route"

describe("POST /api/v1/device-sessions/refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.parseMobileRefreshRequest.mockReturnValue(refreshRequest)
    mocks.enforceRateLimit.mockResolvedValue({ allowed: true })
    mocks.getTrustedClientIp.mockReturnValue("198.51.100.24")
    mocks.refreshMobileDeviceSession.mockResolvedValue({
      accessToken: "next-access-token",
      accessTokenExpiresIn: 900,
      refreshToken: "next-refresh-token",
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("rotates only through a no-store response and limits by the supplied refresh secret", async () => {
    const response = await POST(refreshHttpRequest())

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0")
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith({
      action: "mobile_token_refresh",
      ip: "198.51.100.24",
      token: refreshRequest.refreshToken,
    })
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

import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  class MobileAuthError extends Error {
    constructor(readonly code: string) {
      super(code)
    }
  }

  class MobileSyncError extends Error {
    constructor(readonly code: string, message: string) {
      super(message)
    }
  }

  return {
    authenticateMobileAccessToken: vi.fn(),
    enforceRateLimit: vi.fn(),
    getTrustedClientIp: vi.fn(),
    MobileAuthError,
    MobileSyncError,
    recordApiV1Request: vi.fn(),
  }
})

vi.mock("@/lib/authorization", () => ({
  AuthorizationError: class AuthorizationError extends Error {},
  requireFreshUser: vi.fn(),
  withAuthenticatedRequestScope: vi.fn(),
}))
vi.mock("@/lib/mobile-auth", () => ({
  authenticateMobileAccessToken: mocks.authenticateMobileAccessToken,
  MobileAuthError: mocks.MobileAuthError,
}))
vi.mock("@/lib/mobile-sync", () => ({ MobileSyncError: mocks.MobileSyncError }))
vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  getTrustedClientIp: mocks.getTrustedClientIp,
}))
vi.mock("./telemetry", () => ({ recordApiV1Request: mocks.recordApiV1Request }))

import { handleApiV1DeviceSession } from "./route"

describe("handleApiV1DeviceSession", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.authenticateMobileAccessToken.mockResolvedValue({
      deviceSessionId: "device-session-1",
      userId: "user-1",
    })
    mocks.enforceRateLimit.mockResolvedValue({ allowed: true })
    mocks.getTrustedClientIp.mockReturnValue("198.51.100.24")
  })

  it("requires a mobile bearer token and never falls back to a browser session", async () => {
    const run = vi.fn()

    const response = await handleApiV1DeviceSession({
      endpoint: "sync",
      request: request(),
      run,
    })

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "MOBILE_DEVICE_SESSION_REQUIRED", retryable: false },
    })
    expect(mocks.authenticateMobileAccessToken).not.toHaveBeenCalled()
    expect(run).not.toHaveBeenCalled()
  })

  it("fails closed when the mobile-write rate limiter is unavailable", async () => {
    mocks.enforceRateLimit.mockRejectedValue(new Error("limiter unavailable"))
    const run = vi.fn()

    const response = await handleApiV1DeviceSession({
      endpoint: "article-state",
      request: request({ authorization: "Bearer device-access-token" }),
      run,
    })

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "RATE_LIMIT_UNAVAILABLE", retryable: true },
    })
    expect(run).not.toHaveBeenCalled()
    expect(mocks.recordApiV1Request).toHaveBeenCalledWith(
      expect.objectContaining({ rateLimitResult: "unavailable", statusCode: 503 })
    )
  })

  it("uses the authenticated device session, returns no-store data, and maps a stale cursor", async () => {
    const response = await handleApiV1DeviceSession({
      endpoint: "sync",
      request: request({ authorization: "Bearer device-access-token" }),
      run: async (context) => {
        expect(context).toEqual({ deviceSessionId: "device-session-1", userId: "user-1" })
        throw new mocks.MobileSyncError(
          "full-resync-required",
          "Perform a full resync."
        )
      },
    })

    expect(response.status).toBe(409)
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0")
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "FULL_RESYNC_REQUIRED", retryable: false },
    })
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith({
      action: "mobile_api_write",
      ip: "198.51.100.24",
      userId: "user-1",
    })
  })
})

function request(headers: Record<string, string> = {}) {
  return new Request("https://arcticrss.example/api/v1/sync", {
    headers: { "cf-connecting-ip": "198.51.100.24", ...headers },
  })
}

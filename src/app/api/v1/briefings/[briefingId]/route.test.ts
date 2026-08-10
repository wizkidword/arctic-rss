import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  class AuthorizationError extends Error {}
  class MobileAuthError extends Error {}

  return {
    AuthorizationError,
    authenticateMobileAccessToken: vi.fn(),
    enforceRateLimit: vi.fn(),
    getApiV1Briefing: vi.fn(),
    getTrustedClientIp: vi.fn(),
    MobileAuthError,
    requireFreshUser: vi.fn(),
    withAuthenticatedRequestScope: vi.fn(),
  }
})

vi.mock("@/lib/authorization", () => ({
  AuthorizationError: mocks.AuthorizationError,
  requireFreshUser: mocks.requireFreshUser,
  withAuthenticatedRequestScope: mocks.withAuthenticatedRequestScope,
}))

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  getTrustedClientIp: mocks.getTrustedClientIp,
}))

vi.mock("@/lib/mobile-auth", () => ({
  authenticateMobileAccessToken: mocks.authenticateMobileAccessToken,
  MobileAuthError: mocks.MobileAuthError,
}))

vi.mock("@/lib/api-v1/read-service", () => ({ getApiV1Briefing: mocks.getApiV1Briefing }))

import { GET } from "./route"

describe("GET /api/v1/briefings/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, "info").mockImplementation(() => {})
    vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.withAuthenticatedRequestScope.mockImplementation(async (callback) => callback({ user: { id: "user-1" } }))
    mocks.requireFreshUser.mockResolvedValue({ id: "user-1" })
    mocks.getTrustedClientIp.mockReturnValue("198.51.100.24")
    mocks.enforceRateLimit.mockResolvedValue({ allowed: true })
    mocks.getApiV1Briefing.mockResolvedValue({ id: "briefing_1", items: [], title: "Morning" })
  })

  afterEach(() => vi.restoreAllMocks())

  it("uses the private no-store read envelope and scopes the briefing to the authenticated user", async () => {
    const response = await GET(new Request("https://arcticrss.com/api/v1/briefings/briefing_1"), {
      params: Promise.resolve({ briefingId: "briefing_1" }),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0")
    await expect(response.json()).resolves.toMatchObject({ data: { id: "briefing_1", title: "Morning" } })
    expect(mocks.getApiV1Briefing).toHaveBeenCalledWith({ briefingId: "briefing_1", userId: "user-1" })
  })

  it("rejects invalid identifiers before loading briefing data", async () => {
    const response = await GET(new Request("https://arcticrss.com/api/v1/briefings/%24bad"), {
      params: Promise.resolve({ briefingId: "$bad" }),
    })

    expect(response.status).toBe(400)
    expect(mocks.getApiV1Briefing).not.toHaveBeenCalled()
  })
})

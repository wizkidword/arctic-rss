import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  class AuthorizationError extends Error {}
  class MobileAuthError extends Error {}

  return {
    AuthorizationError,
    authenticateMobileAccessToken: vi.fn(),
    enforceRateLimit: vi.fn(),
    getTrustedClientIp: vi.fn(),
    listApiV1Reader: vi.fn(),
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

vi.mock("@/lib/api-v1/read-service", () => ({
  listApiV1Reader: mocks.listApiV1Reader,
}))

import { GET } from "./route"

describe("GET /api/v1/reader", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, "info").mockImplementation(() => {})
    vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.withAuthenticatedRequestScope.mockImplementation(async (callback) =>
      callback({ user: { id: "user-1" } })
    )
    mocks.requireFreshUser.mockResolvedValue({ id: "user-1" })
    mocks.authenticateMobileAccessToken.mockResolvedValue({
      authVersion: 2,
      deviceSessionId: "device-session-1",
      userId: "user-2",
    })
    mocks.getTrustedClientIp.mockReturnValue("198.51.100.24")
    mocks.enforceRateLimit.mockResolvedValue({ allowed: true })
    mocks.listApiV1Reader.mockResolvedValue({
      articles: [
        {
          feed: { faviconUrl: null, id: "feed_1", title: "Example Feed" },
          id: "article_1",
          imageUrl: null,
          isRead: false,
          isStarred: false,
          publishedAt: "2026-08-10T12:00:00.000Z",
          summary: "A bounded summary.",
          title: "An example article",
          url: "https://example.test/articles/1",
        },
      ],
      nextCursor: "cursor_2",
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("requires fresh authentication before rate limiting or data access", async () => {
    mocks.withAuthenticatedRequestScope.mockRejectedValue(
      new mocks.AuthorizationError("Authentication is required.")
    )

    const response = await GET(readerRequest())

    expect(response.status).toBe(401)
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0")
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "AUTHENTICATION_REQUIRED", retryable: false },
    })
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled()
    expect(mocks.listApiV1Reader).not.toHaveBeenCalled()
  })

  it("fails closed on the shared private-read limit before loading data", async () => {
    mocks.enforceRateLimit.mockResolvedValue({
      allowed: false,
      reason: "limited",
      retryAfterSeconds: 60,
    })

    const response = await GET(readerRequest())

    expect(response.status).toBe(429)
    expect(response.headers.get("retry-after")).toBe("60")
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "RATE_LIMITED", retryable: true },
    })
    expect(mocks.listApiV1Reader).not.toHaveBeenCalled()
  })

  it("returns a no-store envelope with a request ID and never puts bodies in reader lists", async () => {
    const response = await GET(readerRequest("?limit=2&state=unread"))

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0")
    expect(response.headers.get("x-request-id")).toMatch(
      /^[0-9a-f-]{36}$/
    )
    await expect(response.json()).resolves.toMatchObject({
      data: {
        articles: [
          {
            id: "article_1",
            title: "An example article",
          },
        ],
      },
      meta: { nextCursor: "cursor_2" },
    })
    expect(mocks.listApiV1Reader).toHaveBeenCalledWith({
      limit: 2,
      state: "unread",
      userId: "user-1",
    })
    expect(mocks.listApiV1Reader.mock.calls[0][0]).not.toHaveProperty("contentHtml")
  })

  it("accepts a fresh device-session bearer token without falling back to browser cookies", async () => {
    const response = await GET(readerRequest("", { authorization: "Bearer device-access-token" }))

    expect(response.status).toBe(200)
    expect(mocks.authenticateMobileAccessToken).toHaveBeenCalledWith({
      accessToken: "device-access-token",
    })
    expect(mocks.withAuthenticatedRequestScope).not.toHaveBeenCalled()
    expect(mocks.listApiV1Reader).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-2" })
    )
  })

  it("rejects duplicate query parameters with bounded validation details", async () => {
    const response = await GET(readerRequest("?limit=1&limit=2"))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          code: "REQUEST_VALIDATION_FAILED",
          issues: [{ field: "limit", message: "Provide this query parameter only once." }],
        }),
      })
    )
    expect(mocks.listApiV1Reader).not.toHaveBeenCalled()
  })
})

function readerRequest(query = "", headers: Record<string, string> = {}) {
  return new Request(`https://arcticrss.com/api/v1/reader${query}`, {
    headers: { "cf-connecting-ip": "198.51.100.24", ...headers },
  })
}

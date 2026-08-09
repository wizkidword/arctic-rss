import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  class AuthorizationError extends Error {}
  class AccountExportError extends Error {}

  return {
    AccountExportError,
    AuthorizationError,
    buildAccountExport: vi.fn(),
    enforceRateLimit: vi.fn(),
    getTrustedClientIp: vi.fn(),
    requireFreshUser: vi.fn(),
    serializeAccountExport: vi.fn(),
  }
})

vi.mock("@/lib/authorization", () => ({
  AuthorizationError: mocks.AuthorizationError,
  requireFreshUser: mocks.requireFreshUser,
}))

vi.mock("@/lib/account-export", () => ({
  AccountExportError: mocks.AccountExportError,
  buildAccountExport: mocks.buildAccountExport,
  serializeAccountExport: mocks.serializeAccountExport,
}))

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  getTrustedClientIp: mocks.getTrustedClientIp,
}))

import { GET } from "./route"

function exportRequest() {
  return new Request("https://arcticrss.com/api/account/export", {
    headers: { "cf-connecting-ip": "198.51.100.24" },
  })
}

describe("GET /api/account/export", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireFreshUser.mockResolvedValue({ id: "user-1" })
    mocks.getTrustedClientIp.mockReturnValue("198.51.100.24")
    mocks.enforceRateLimit.mockResolvedValue({ allowed: true })
    mocks.buildAccountExport.mockResolvedValue({ schemaVersion: 1 })
    mocks.serializeAccountExport.mockReturnValue('{"schemaVersion":1}')
  })

  it("requires a fresh authenticated account before rate limiting or exporting", async () => {
    mocks.requireFreshUser.mockRejectedValue(new mocks.AuthorizationError())

    const response = await GET(exportRequest())

    expect(response.status).toBe(401)
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0")
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled()
    expect(mocks.buildAccountExport).not.toHaveBeenCalled()
  })

  it("rate-limits the authenticated account before creating private data", async () => {
    mocks.enforceRateLimit.mockResolvedValue({
      allowed: false,
      reason: "limited",
      retryAfterSeconds: 300,
    })

    const response = await GET(exportRequest())

    expect(response.status).toBe(429)
    expect(response.headers.get("retry-after")).toBe("300")
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith({
      action: "account_export",
      ip: "198.51.100.24",
      userId: "user-1",
    })
    expect(mocks.buildAccountExport).not.toHaveBeenCalled()
  })

  it("fails closed when export rate limiting is unavailable", async () => {
    mocks.enforceRateLimit.mockResolvedValue({ allowed: false, reason: "unavailable" })

    const response = await GET(exportRequest())

    expect(response.status).toBe(503)
    expect(mocks.buildAccountExport).not.toHaveBeenCalled()
  })

  it("returns a private attachment only after authorization and rate limiting", async () => {
    const response = await GET(exportRequest())

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0")
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="arctic-rss-account-export.json"'
    )
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8")
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    await expect(response.text()).resolves.toBe('{"schemaVersion":1}')
    expect(mocks.buildAccountExport).toHaveBeenCalledWith({ userId: "user-1" })
  })

  it("reports a bounded export refusal without starting a download", async () => {
    mocks.buildAccountExport.mockRejectedValue(
      new mocks.AccountExportError("The export is too large.")
    )

    const response = await GET(exportRequest())

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toEqual({ error: "The export is too large." })
  })
})

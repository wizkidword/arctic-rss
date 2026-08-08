import { beforeEach, describe, expect, it, vi } from "vitest"

const { enforceRateLimit, getTrustedClientIp, readPublicHealthSnapshot } = vi.hoisted(() => ({
  enforceRateLimit: vi.fn(),
  getTrustedClientIp: vi.fn(),
  readPublicHealthSnapshot: vi.fn(),
}))

vi.mock("@/lib/health-snapshot", () => ({
  healthSnapshotAgeMs: vi.fn(() => 12),
  readPublicHealthSnapshot,
}))

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit,
  getTrustedClientIp,
}))

import { GET } from "./route"

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getTrustedClientIp.mockReturnValue(null)
    readPublicHealthSnapshot.mockResolvedValue({
      snapshot: { status: "ok" },
      source: "fresh",
    })
  })

  it("returns a minimal 200 response from a cached healthy snapshot", async () => {
    const response = await GET(new Request("https://arcticrss.test/api/health"))

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.get("content-type")).toContain("application/json")
    await expect(response.json()).resolves.toEqual({ status: "ok" })
  })

  it("does not disclose failed dependencies from a degraded snapshot", async () => {
    readPublicHealthSnapshot.mockResolvedValue({
      snapshot: {
        checks: { database: "failed", durableRedis: "failed" },
        status: "degraded",
      },
      source: "stale",
    })

    const response = await GET(new Request("https://arcticrss.test/api/health"))

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({ status: "degraded" })
  })

  it("rate limits only a trusted client IP and keeps the response public-safe", async () => {
    getTrustedClientIp.mockReturnValue("198.51.100.40")
    enforceRateLimit.mockResolvedValue({
      allowed: false,
      reason: "limited",
      retryAfterSeconds: 15,
    })

    const response = await GET(new Request("https://arcticrss.test/api/health"))

    expect(enforceRateLimit).toHaveBeenCalledWith({
      action: "public_health",
      ip: "198.51.100.40",
    })
    expect(readPublicHealthSnapshot).not.toHaveBeenCalled()
    expect(response.status).toBe(429)
    expect(response.headers.get("retry-after")).toBe("15")
    await expect(response.json()).resolves.toEqual({ status: "degraded" })
  })
})

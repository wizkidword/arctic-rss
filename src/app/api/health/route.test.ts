import { beforeEach, describe, expect, it, vi } from "vitest"

const { checkSystemHealth } = vi.hoisted(() => ({
  checkSystemHealth: vi.fn(),
}))

vi.mock("@/lib/system-health", () => ({
  checkSystemHealth,
}))

import { GET } from "./route"

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns a non-cacheable, minimal 200 response when dependencies are healthy", async () => {
    checkSystemHealth.mockResolvedValue({
      checks: {
        database: "ok",
        redis: "ok",
      },
      status: "ok",
    })

    const response = await GET()

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.get("content-type")).toContain("application/json")
    await expect(response.json()).resolves.toEqual({ status: "ok" })
  })

  it("does not disclose the failed dependency in a degraded response", async () => {
    checkSystemHealth.mockResolvedValue({
      checks: {
        database: "ok",
        redis: "failed",
      },
      status: "degraded",
    })

    const response = await GET()

    expect(response.status).toBe(503)
    expect(response.headers.get("cache-control")).toBe("no-store")
    await expect(response.json()).resolves.toEqual({ status: "degraded" })
  })
})

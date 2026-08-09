import { beforeEach, describe, expect, it, vi } from "vitest"

const { checkSystemHealth, requireFreshAdmin } = vi.hoisted(() => ({
  checkSystemHealth: vi.fn(),
  requireFreshAdmin: vi.fn(),
}))

vi.mock("@/lib/authorization", () => ({
  AuthorizationError: class AuthorizationError extends Error {},
  requireFreshAdmin,
}))

vi.mock("@/lib/system-health", () => ({
  checkSystemHealth,
}))

import { GET } from "./route"

describe("GET /api/internal/health", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("rejects an ordinary unauthenticated request", async () => {
    const { AuthorizationError } = await import("@/lib/authorization")
    requireFreshAdmin.mockRejectedValue(new AuthorizationError("Authentication is required."))

    const response = await GET()

    expect(response.status).toBe(403)
    expect(checkSystemHealth).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({ error: "Administrator access is required." })
  })

  it("returns detailed dependency checks only after fresh administrator authorization", async () => {
    requireFreshAdmin.mockResolvedValue({ id: "admin-1" })
    checkSystemHealth.mockResolvedValue({
      checks: {
        chatGateway: "disabled",
        database: "ok",
        durableRedis: "ok",
        ephemeralRedis: "ok",
        maintenance: "ok",
        queues: "ok",
        workers: { all: "ok", health: "ok" },
      },
      status: "ok",
    })

    const response = await GET()

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    const body = await response.json()

    expect(body).toMatchObject({
      checks: {
        chatGateway: "disabled",
        database: "ok",
        durableRedis: "ok",
        ephemeralRedis: "ok",
        maintenance: "ok",
        queues: "ok",
        workers: { all: "ok", health: "ok" },
      },
      status: "ok",
    })
    expect(body.checkDurationMs).toEqual(expect.any(Number))
  })
})

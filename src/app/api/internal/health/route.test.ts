import { beforeEach, describe, expect, it, vi } from "vitest"

const { requireFreshAdmin, refreshDetailedHealthSnapshot } = vi.hoisted(() => ({
  refreshDetailedHealthSnapshot: vi.fn(),
  requireFreshAdmin: vi.fn(),
}))

vi.mock("@/lib/authorization", () => ({
  AuthorizationError: class AuthorizationError extends Error {},
  requireFreshAdmin,
}))

vi.mock("@/lib/health-snapshot", () => ({
  healthSnapshotAgeMs: vi.fn(() => 20),
  refreshDetailedHealthSnapshot,
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
    expect(refreshDetailedHealthSnapshot).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({ error: "Administrator access is required." })
  })

  it("returns detailed dependency checks only after fresh administrator authorization", async () => {
    requireFreshAdmin.mockResolvedValue({ id: "admin-1" })
    refreshDetailedHealthSnapshot.mockResolvedValue({
      checkedAt: 100,
      durationMs: 13,
      result: {
        checks: {
          chatGateway: "disabled",
          database: "ok",
          durableRedis: "ok",
          ephemeralRedis: "ok",
          maintenance: "ok",
          queues: "ok",
          workers: { all: "ok" },
        },
      },
      status: "ok",
    })

    const response = await GET()

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    await expect(response.json()).resolves.toEqual({
      checkDurationMs: 13,
      checks: {
        chatGateway: "disabled",
        database: "ok",
        durableRedis: "ok",
        ephemeralRedis: "ok",
        maintenance: "ok",
        queues: "ok",
        workers: { all: "ok" },
      },
      snapshotAgeMs: 20,
      status: "ok",
    })
  })
})

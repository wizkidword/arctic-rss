import { describe, expect, it, vi } from "vitest"

import { checkSystemHealthWithClients } from "./system-health"

function healthyClients() {
  return {
    database: {
      countUsers: vi.fn().mockResolvedValue(3),
    },
    queue: {
      checkConnection: vi.fn().mockResolvedValue(undefined),
    },
  }
}

describe("system health", () => {
  it("reports healthy when PostgreSQL and Redis respond", async () => {
    const clients = healthyClients()

    const result = await checkSystemHealthWithClients(clients)

    expect(result).toEqual({
      checks: {
        database: "ok",
        redis: "ok",
      },
      status: "ok",
    })
    expect(clients.database.countUsers).toHaveBeenCalledOnce()
    expect(clients.queue.checkConnection).toHaveBeenCalledOnce()
  })

  it("reports a sanitized degraded state when PostgreSQL fails", async () => {
    const clients = healthyClients()
    clients.database.countUsers.mockRejectedValue(
      new Error("password authentication failed for postgres")
    )

    const result = await checkSystemHealthWithClients(clients)

    expect(result).toEqual({
      checks: {
        database: "failed",
        redis: "ok",
      },
      status: "degraded",
    })
    expect(JSON.stringify(result)).not.toContain("password")
  })

  it("reports a sanitized degraded state when Redis fails", async () => {
    const clients = healthyClients()
    clients.queue.checkConnection.mockRejectedValue(
      new Error("connect ECONNREFUSED redis:6379")
    )

    const result = await checkSystemHealthWithClients(clients)

    expect(result).toEqual({
      checks: {
        database: "ok",
        redis: "failed",
      },
      status: "degraded",
    })
    expect(JSON.stringify(result)).not.toContain("redis:6379")
  })
})

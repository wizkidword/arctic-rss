import { describe, expect, it, vi } from "vitest"

import { checkSystemHealthWithClients } from "./system-health"

const now = () => 1_752_428_800_000

function healthyClients() {
  return {
    chatGateway: {
      checkConnection: vi.fn().mockResolvedValue(undefined),
    },
    database: {
      checkConnection: vi.fn().mockResolvedValue(undefined),
    },
    durableRedis: {
      checkConnection: vi.fn().mockResolvedValue(undefined),
    },
    ephemeralRedis: {
      checkConnection: vi.fn().mockResolvedValue(undefined),
    },
    queueReadiness: {
      checkConnection: vi.fn().mockResolvedValue(undefined),
    },
    workerHeartbeats: {
      readMaintenanceTick: vi.fn().mockResolvedValue({
        instanceId: "maintenance-1",
        mode: "maintenance",
        timestamp: now(),
        version: "test",
      }),
      readWorkerHeartbeats: vi.fn().mockImplementation(async (modes: readonly string[]) =>
        Object.fromEntries(
          modes.map((mode) => [
            mode,
            { instanceId: `${mode}-1`, mode, timestamp: now(), version: "test" },
          ])
        )
      ),
    },
  }
}

describe("system health", () => {
  it("reports healthy for all-in-one when PostgreSQL, both Redis workloads, and its worker respond", async () => {
    const clients = healthyClients()

    const result = await checkSystemHealthWithClients({ ...clients, now })

    expect(result).toEqual({
      checks: {
        chatGateway: "disabled",
        database: "ok",
        durableRedis: "ok",
        ephemeralRedis: "ok",
        maintenance: "ok",
        queues: "ok",
        workers: { all: "ok" },
      },
      status: "ok",
    })
    expect(clients.workerHeartbeats.readWorkerHeartbeats).toHaveBeenCalledWith(["all"])
    expect(clients.chatGateway.checkConnection).not.toHaveBeenCalled()
  })

  it("reports a sanitized degraded state when PostgreSQL fails", async () => {
    const clients = healthyClients()
    clients.database.checkConnection.mockRejectedValue(
      new Error("password authentication failed for postgres")
    )

    const result = await checkSystemHealthWithClients({ ...clients, now })

    expect(result.status).toBe("degraded")
    expect(result.checks.database).toBe("failed")
    expect(JSON.stringify(result)).not.toContain("password")
  })

  it("reports degraded when durable Redis fails", async () => {
    const clients = healthyClients()
    clients.durableRedis.checkConnection.mockRejectedValue(
      new Error("connect ECONNREFUSED redis:6379")
    )

    const result = await checkSystemHealthWithClients({ ...clients, now })

    expect(result.status).toBe("degraded")
    expect(result.checks.durableRedis).toBe("failed")
    expect(JSON.stringify(result)).not.toContain("redis:6379")
  })

  it("reports degraded when ephemeral Redis fails", async () => {
    const clients = healthyClients()
    clients.ephemeralRedis.checkConnection.mockRejectedValue(
      new Error("connect ECONNREFUSED redis-ephemeral:6379")
    )

    const result = await checkSystemHealthWithClients({ ...clients, now })

    expect(result.status).toBe("degraded")
    expect(result.checks.ephemeralRedis).toBe("failed")
  })

  it("reports degraded when queue lag, suspected stalls, or failures exceed readiness limits", async () => {
    const clients = healthyClients()
    clients.queueReadiness.checkConnection.mockRejectedValue(
      new Error("Queue readiness check failed.")
    )

    const result = await checkSystemHealthWithClients({ ...clients, now })

    expect(result).toMatchObject({ checks: { queues: "failed" }, status: "degraded" })
  })

  it("reports degraded when a required worker heartbeat is missing", async () => {
    const clients = healthyClients()
    clients.workerHeartbeats.readWorkerHeartbeats.mockResolvedValue({})

    const result = await checkSystemHealthWithClients({
      ...clients,
      now,
      topology: {
        chatEnabled: false,
        name: "split",
        workerModes: ["ingestion", "ai-mail", "imports", "maintenance"],
      },
    })

    expect(result).toMatchObject({
      checks: {
        workers: {
          "ai-mail": "failed",
          imports: "failed",
          ingestion: "failed",
          maintenance: "failed",
        },
      },
      status: "degraded",
    })
  })

  it("reports degraded when a worker heartbeat is stale", async () => {
    const clients = healthyClients()
    clients.workerHeartbeats.readWorkerHeartbeats.mockResolvedValue({
      all: {
        instanceId: "worker-1",
        mode: "all",
        timestamp: now() - 90_000,
        version: "test",
      },
    })

    const result = await checkSystemHealthWithClients({ ...clients, now })

    expect(result).toMatchObject({ checks: { workers: { all: "failed" } }, status: "degraded" })
  })

  it("reports degraded when the last successful maintenance tick is stale", async () => {
    const clients = healthyClients()
    clients.workerHeartbeats.readMaintenanceTick.mockResolvedValue({
      instanceId: "worker-1",
      mode: "maintenance",
      timestamp: now() - 180_000,
      version: "test",
    })

    const result = await checkSystemHealthWithClients({ ...clients, now })

    expect(result).toMatchObject({ checks: { maintenance: "failed" }, status: "degraded" })
  })

  it("checks the chat gateway only for a chat-enabled topology", async () => {
    const clients = healthyClients()
    clients.chatGateway.checkConnection.mockRejectedValue(new Error("gateway unavailable"))

    const result = await checkSystemHealthWithClients({
      ...clients,
      now,
      topology: {
        chatEnabled: true,
        name: "all-in-one-with-chat",
        workerModes: ["all"],
      },
    })

    expect(result).toMatchObject({ checks: { chatGateway: "failed" }, status: "degraded" })
    expect(clients.chatGateway.checkConnection).toHaveBeenCalledOnce()
  })

  it("reports degraded when a dependency misses its deadline", async () => {
    const clients = healthyClients()
    clients.database.checkConnection.mockImplementation(
      () => new Promise<void>(() => undefined)
    )

    const result = await checkSystemHealthWithClients({
      ...clients,
      now,
      timeoutMs: 1,
    })

    expect(result).toMatchObject({ checks: { database: "failed" }, status: "degraded" })
  })
})

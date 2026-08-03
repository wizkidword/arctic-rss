import { describe, expect, it, vi } from "vitest"

const redisInstances = vi.hoisted(() => [] as Array<{ options: Record<string, unknown> }>)

vi.mock("ioredis", () => {
  class MockRedis {
    readonly options: Record<string, unknown>

    constructor(_url: string, options: Record<string, unknown>) {
      this.options = options
      redisInstances.push(this)
    }

    disconnect = vi.fn()
    get = vi.fn(async () =>
      JSON.stringify({
        instanceId: "worker-1",
        mode: "all",
        timestamp: Date.now(),
        version: "test",
      })
    )
    on = vi.fn()
    ping = vi.fn(async () => {
      if (this.options.enableOfflineQueue === false) {
        throw new Error("Stream isn't writeable and enableOfflineQueue is false")
      }
    })
    mget = vi.fn(async (...keys: string[]) =>
      keys.map((key) =>
        JSON.stringify({
          instanceId: "worker-1",
          mode: "all",
          timestamp: Date.now(),
          version: "test",
        })
      )
    )
  }

  return { default: MockRedis }
})

vi.mock("bullmq", () => {
  class MockQueue {
    constructor(readonly name: string) {}

    close = vi.fn(async () => undefined)
    getJobCounts = vi.fn(async () => ({ active: 0, failed: 0, waiting: 0 }))
    getJobs = vi.fn(async () => [])
  }

  return { Queue: MockQueue }
})

vi.mock("./db", () => ({
  getPrisma: () => ({ $queryRaw: vi.fn(async () => 1) }),
}))

vi.mock("./redis-config", () => ({
  durableRedisConnectionOptions: () => ({ url: "redis://durable" }),
  ephemeralRedisConnectionOptions: () => ({ url: "redis://ephemeral" }),
}))

vi.mock("./runtime-topology", () => ({
  getRuntimeTopology: () => ({
    chatEnabled: false,
    name: "all-in-one",
    workerModes: ["all"],
  }),
}))

import { checkSystemHealth } from "./system-health"

describe("initial Redis health connections", () => {
  it("allows initial health and queue commands to wait for their connection", async () => {
    const result = await checkSystemHealth()

    expect(result.status).toBe("ok")
    expect(redisInstances).toHaveLength(3)
    expect(redisInstances.every((instance) => instance.options.enableOfflineQueue !== false)).toBe(
      true
    )
  })
})

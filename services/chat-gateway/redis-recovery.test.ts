import { EventEmitter } from "node:events"

import { io as createSocketClient } from "socket.io-client"
import { describe, expect, it, vi } from "vitest"

import {
  createRedisRecoverySupervisor,
  type GatewayRedisClient,
} from "./redis-recovery"
import { createChatGateway } from "./gateway"

class FakeRedisClient extends EventEmitter implements GatewayRedisClient {
  connect = vi.fn().mockResolvedValue(undefined)
  disconnect = vi.fn()
  ping = vi.fn().mockResolvedValue("PONG")
  quit = vi.fn().mockResolvedValue(undefined)
}

function clients() {
  return {
    adapterPublisher: new FakeRedisClient(),
    adapterSubscriber: new FakeRedisClient(),
    blockEvents: new FakeRedisClient(),
    command: new FakeRedisClient(),
    roomEvents: new FakeRedisClient(),
    securityEvents: new FakeRedisClient(),
  }
}

describe("chat gateway Redis recovery", () => {
  it("recovers a gateway with active clients after a Redis restart", async () => {
    const redis = clients()
    const resubscribe = vi.fn().mockResolvedValue(undefined)
    const supervisor = createRedisRecoverySupervisor({
      clients: redis,
      gracePeriodMs: 1_000,
      onDegradedTimeout: vi.fn(),
      resubscribe,
    })
    await supervisor.start()
    const gateway = createChatGateway({
      authenticateConnection: async () => identity(),
      isConnectionReady: supervisor.isReady,
      logger: { info: vi.fn(), warn: vi.fn() },
      readiness: async () => {
        if (!supervisor.isReady()) {
          throw new Error("Redis unavailable")
        }
      },
    })
    const port = await gateway.start(0)
    const first = connect(port)
    const second = connect(port)

    try {
      await Promise.all([once(first, "session:ready"), once(second, "session:ready")])
      redis.command.emit("close")
      expect((await fetch(`http://127.0.0.1:${port}/ready`)).status).toBe(503)

      const blocked = connect(port)
      await expect(once(blocked, "connect_error")).resolves.toBeInstanceOf(Error)
      blocked.disconnect()

      Object.values(redis).forEach((client) => client.emit("ready"))
      await vi.waitFor(() => expect(supervisor.isReady()).toBe(true))
      expect(resubscribe).toHaveBeenCalledTimes(2)

      const recovered = connect(port)
      await expect(once(recovered, "session:ready")).resolves.toMatchObject({
        handle: "reader",
      })
      recovered.disconnect()

      const resumedMessage = once(first, "recovery:message")
      gateway.io.emit("recovery:message", { status: "resumed" })
      await expect(resumedMessage).resolves.toEqual({ status: "resumed" })
    } finally {
      first.disconnect()
      second.disconnect()
      await gateway.close()
      await supervisor.close()
    }
  })

  it("becomes unavailable during an interruption and returns ready after all clients reconnect", async () => {
    const redis = clients()
    const resubscribe = vi.fn().mockResolvedValue(undefined)
    const supervisor = createRedisRecoverySupervisor({
      clients: redis,
      gracePeriodMs: 1_000,
      onDegradedTimeout: vi.fn(),
      resubscribe,
    })

    await supervisor.start()
    expect(supervisor.isReady()).toBe(true)
    expect(resubscribe).toHaveBeenCalledTimes(1)

    redis.command.emit("close")
    expect(supervisor.isReady()).toBe(false)

    Object.values(redis).forEach((client) => client.emit("ready"))
    await vi.waitFor(() => expect(supervisor.isReady()).toBe(true))
    expect(resubscribe).toHaveBeenCalledTimes(2)
  })

  it("waits to resubscribe until the initial Redis clients all connect", async () => {
    const redis = clients()
    const resubscribe = vi.fn().mockResolvedValue(undefined)
    redis.command.connect.mockImplementation(async () => {
      redis.command.emit("ready")
    })
    const supervisor = createRedisRecoverySupervisor({
      clients: redis,
      gracePeriodMs: 1_000,
      onDegradedTimeout: vi.fn(),
      resubscribe,
    })

    await supervisor.start()

    expect(resubscribe).toHaveBeenCalledOnce()
    expect(supervisor.isReady()).toBe(true)
  })

  it("waits for every Redis client before resubscribing after a restart", async () => {
    const redis = clients()
    const resubscribe = vi.fn().mockResolvedValue(undefined)
    const supervisor = createRedisRecoverySupervisor({
      clients: redis,
      gracePeriodMs: 1_000,
      onDegradedTimeout: vi.fn(),
      resubscribe,
    })
    await supervisor.start()
    redis.command.emit("close")
    redis.command.emit("ready")

    await Promise.resolve()

    expect(resubscribe).toHaveBeenCalledOnce()
    expect(supervisor.isReady()).toBe(false)

    Object.entries(redis)
      .filter(([name]) => name !== "command")
      .forEach(([, client]) => client.emit("ready"))

    await vi.waitFor(() => expect(supervisor.isReady()).toBe(true))
    expect(resubscribe).toHaveBeenCalledTimes(2)
  })

  it("requests a controlled restart when Redis stays unavailable beyond its grace period", async () => {
    vi.useFakeTimers()
    const restart = vi.fn()
    const redis = clients()
    const supervisor = createRedisRecoverySupervisor({
      clients: redis,
      gracePeriodMs: 500,
      onDegradedTimeout: restart,
      resubscribe: vi.fn().mockResolvedValue(undefined),
    })

    await supervisor.start()
    expect(supervisor.isReady()).toBe(true)
    redis.command.emit("close")
    await vi.advanceTimersByTimeAsync(500)

    expect(restart).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})

function identity() {
  return {
    authVersion: 1,
    authorizedAt: new Date().toISOString(),
    chatEnabled: true as const,
    emailVerified: true as const,
    handle: "reader",
    plan: "FREE" as const,
    policyVersion: "launch-policy-v1",
    profileId: "profile-1",
    role: "USER" as const,
    userId: "user-1",
  }
}

function connect(port: number) {
  return createSocketClient(`ws://127.0.0.1:${port}`, {
    forceNew: true,
    transports: ["websocket"],
  })
}

function once(socket: ReturnType<typeof createSocketClient>, event: string) {
  return new Promise<unknown>((resolve, reject) => {
    socket.once(event, resolve)
    if (event !== "connect_error") {
      socket.once("connect_error", reject)
    }
  })
}

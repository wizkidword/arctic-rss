import { io as createSocketClient } from "socket.io-client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { createChatGateway, type ChatGateway } from "./gateway"

const logger = {
  info: vi.fn(),
  warn: vi.fn(),
}

const identity = {
  authVersion: 4,
  authorizedAt: new Date().toISOString(),
  chatEnabled: true as const,
  emailVerified: true as const,
  handle: "northernlights",
  plan: "PRO" as const,
  policyVersion: "launch-policy-v1",
  profileId: "profile-1",
  role: "USER" as const,
  userId: "user-1",
}

describe("chat gateway", () => {
  let gateway: ChatGateway | undefined
  const clients: ReturnType<typeof createSocketClient>[] = []

  afterEach(async () => {
    clients.splice(0).forEach((client) => client.disconnect())
    await gateway?.close()
    gateway = undefined
    vi.clearAllMocks()
  })

  it("accepts an authenticated WebSocket client and exposes health probes", async () => {
    gateway = createChatGateway({
      authenticateConnection: async ({ token }) => {
        if (token !== "valid-token") {
          throw new Error("invalid")
        }

        return identity
      },
      logger,
    })
    const port = await gateway.start(0)
    const live = await fetch(`http://127.0.0.1:${port}/live`)
    const ready = await fetch(`http://127.0.0.1:${port}/ready`)

    expect(await live.json()).toEqual({ status: "ok" })
    expect(await ready.json()).toEqual({ status: "ok" })

    const client = connect(port)
    const session = await once(client, "session:ready")

    expect(session).toEqual({
      handle: "northernlights",
      profileId: "profile-1",
      role: "USER",
    })
  })

  it("rejects new clients while a Redis-backed readiness check is unavailable", async () => {
    let redisReady = true
    gateway = createChatGateway({
      authenticateConnection: async () => identity,
      isConnectionReady: () => redisReady,
      logger,
      readiness: async () => {
        if (!redisReady) {
          throw new Error("redis unavailable")
        }
      },
    })
    const port = await gateway.start(0)
    const activeFirst = connect(port)
    const activeSecond = connect(port)
    await Promise.all([once(activeFirst, "session:ready"), once(activeSecond, "session:ready")])

    redisReady = false
    const ready = await fetch(`http://127.0.0.1:${port}/ready`)
    expect(ready.status).toBe(503)

    const blockedClient = connect(port)
    await expect(once(blockedClient, "connect_error")).resolves.toBeInstanceOf(Error)

    redisReady = true
    const recoveredClient = connect(port)
    await expect(once(recoveredClient, "session:ready")).resolves.toEqual({
      handle: "northernlights",
      profileId: "profile-1",
      role: "USER",
    })
  })

  it("disconnects every local socket for a replayed security event", async () => {
    gateway = createChatGateway({ authenticateConnection: async () => identity, logger })
    const port = await gateway.start(0)
    const first = connect(port)
    const second = connect(port)
    await Promise.all([once(first, "session:ready"), once(second, "session:ready")])

    const firstClosed = once(first, "disconnect")
    const secondClosed = once(second, "disconnect")
    expect(gateway.disconnectUser(identity.userId, "password_reset")).toBe(2)
    await Promise.all([firstClosed, secondClosed])

    expect(gateway.disconnectUser(identity.userId, "password_reset")).toBe(0)
  })

  it("removes stale authorization even when a pub-sub revocation is missed", async () => {
    gateway = createChatGateway({
      authenticateConnection: async () => ({
        ...identity,
        authorizedAt: new Date(Date.now() - 1_000).toISOString(),
      }),
      authorizationMaxAgeMs: 10,
      authorizationRecheckIntervalMs: 10,
      logger,
      revalidateAuthorization: async () => {
        throw new Error("account disabled")
      },
    })
    const port = await gateway.start(0)
    const client = connect(port)
    await once(client, "session:ready")

    await expect(once(client, "disconnect")).resolves.toBeDefined()
    expect(logger.warn).toHaveBeenCalledWith(
      "stale_authorization_rejected",
      expect.objectContaining({ staleAuthorizationDisconnects: "1" })
    )
  })

  function connect(port: number) {
    const client = createSocketClient(`ws://127.0.0.1:${port}`, {
      auth: { token: "valid-token" },
      forceNew: true,
      transports: ["websocket"],
    })
    clients.push(client)
    return client
  }
})

function once(client: ReturnType<typeof createSocketClient>, event: string) {
  return new Promise<unknown>((resolve, reject) => {
    if (event === "connect_error") {
      client.once(event, resolve)
      client.once("connect", () => reject(new Error("Expected connection failure.")))
      return
    }

    client.once(event, resolve)
    client.once("connect_error", reject)
  })
}

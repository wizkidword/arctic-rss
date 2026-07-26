import { io as createSocketClient } from "socket.io-client"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { ChatGateway } from "./gateway"
import { createChatGateway } from "./gateway"
import { DEFAULT_CHAT_GATEWAY_ABUSE_SETTINGS } from "./abuse"
import { attachNativeChatGateway, type NativeChatGatewayService } from "./native-chat"

const logger = { info: vi.fn(), warn: vi.fn() }

describe("native chat gateway events", () => {
  let gateway: ChatGateway | undefined

  afterEach(async () => {
    await gateway?.close()
    gateway = undefined
  })

  it("subscribes two authorized clients and isolates room message broadcasts", async () => {
    gateway = createChatGateway({
      authenticateConnection: async () => ({
        authVersion: 0,
        authorizedAt: new Date().toISOString(),
        chatEnabled: true,
        emailVerified: true,
        handle: "northernlights",
        plan: "FREE",
        policyVersion: "launch-policy-v1",
        profileId: "profile-1",
        role: "USER",
        userId: "user-1",
      }),
      logger,
    })
    const service = {
      getSnapshot: vi.fn().mockResolvedValue({
        member: { role: "MEMBER", status: "ACTIVE" },
        messages: [],
        room: { id: "room-1", slug: "ai" },
      }),
      sendMessage: vi.fn().mockResolvedValue({
        created: true,
        message: {
          body: "Hello Arctic",
          clientMessageId: "message-0001",
          createdAt: "2026-07-14T12:00:00.000Z",
          id: "message-1",
          kind: "TEXT",
          roomId: "room-1",
          senderUserId: "user-1",
          sequence: "1",
        },
      }),
      updateReadMarker: vi.fn().mockResolvedValue(undefined),
    } as unknown as NativeChatGatewayService
    attachNativeChatGateway(gateway.io, service, async () => true)
    const port = await gateway.start(0)
    const first = createSocketClient(`ws://127.0.0.1:${port}`, {
      forceNew: true,
      transports: ["websocket"],
    })
    const second = createSocketClient(`ws://127.0.0.1:${port}`, {
      forceNew: true,
      transports: ["websocket"],
    })

    await Promise.all([waitForConnect(first), waitForConnect(second)])
    await Promise.all([
      first.emitWithAck("room:subscribe", { slug: "ai" }),
      second.emitWithAck("room:subscribe", { slug: "ai" }),
    ])
    const received = once(second, "room:message")
    const acknowledgement = await first.emitWithAck("room:message", {
      body: "Hello Arctic",
      clientMessageId: "message-0001",
      roomId: "room-1",
    })

    expect(acknowledgement).toMatchObject({ created: true, ok: true })
    await expect(received).resolves.toMatchObject({ id: "message-1", sequence: "1" })
    first.disconnect()
    second.disconnect()
  })

  it("keeps optional acknowledgements safe and disconnects repeat malformed events", async () => {
    gateway = createChatGateway({
      abuseSettings: {
        ...DEFAULT_CHAT_GATEWAY_ABUSE_SETTINGS,
        maxMalformedEvents: 2,
      },
      authenticateConnection: async () => testIdentity(),
      logger,
    })
    const service = createService()
    attachNativeChatGateway(gateway.io, service, async () => true)
    const port = await gateway.start(0)
    const client = connect(port)
    await waitForConnect(client)

    client.emit("room:subscribe", { slug: "ai" })
    await vi.waitFor(() => expect(service.getSnapshot).toHaveBeenCalledOnce())
    await expect(client.emitWithAck("room:subscribe", {})).resolves.toEqual({
      error: "request-rejected",
      ok: false,
    })

    const closed = once(client, "disconnect")
    client.emit("room:subscribe", {})
    await expect(closed).resolves.toBeDefined()
  })

  it("rejects a rate-limited raw room-subscribe event before it reaches room storage", async () => {
    const service = createService()
    gateway = createChatGateway({
      authenticateConnection: async () => testIdentity(),
      limitChatAction: async ({ action }) => action !== "chat_room_subscribe",
      logger,
    })
    attachNativeChatGateway(gateway.io, service, async () => true)
    const port = await gateway.start(0)
    const client = connect(port)
    await waitForConnect(client)

    await expect(client.emitWithAck("room:subscribe", { slug: "ai" })).resolves.toEqual({
      error: "rate-limited",
      ok: false,
    })
    expect(service.getSnapshot).not.toHaveBeenCalled()
  })

  it("enforces room, rate, and outstanding-operation boundaries", async () => {
    let resolveFirstSnapshot: (() => void) | undefined
    const firstSnapshot = new Promise<void>((resolve) => {
      resolveFirstSnapshot = resolve
    })
    const service = createService({
      getSnapshot: vi.fn().mockImplementation(async ({ slug }: { slug: string }) => {
        if (slug === "waiting") {
          await firstSnapshot
        }

        return {
          member: { role: "MEMBER", status: "ACTIVE" },
          messages: [],
          room: { id: `room-${slug}`, slug },
        }
      }),
    })
    gateway = createChatGateway({
      abuseSettings: {
        ...DEFAULT_CHAT_GATEWAY_ABUSE_SETTINGS,
        maxOutstandingOperations: 1,
        maxRoomsPerSocket: 1,
      },
      authenticateConnection: async () => testIdentity(),
      limitChatAction: async ({ action }) => action !== "chat_read_marker",
      logger,
    })
    attachNativeChatGateway(gateway.io, service, async () => true)
    const port = await gateway.start(0)
    const client = connect(port)
    await waitForConnect(client)

    const waitingAck = client.emitWithAck("room:subscribe", { slug: "waiting" })
    await vi.waitFor(() => expect(service.getSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "waiting" })
    ))
    await expect(client.emitWithAck("room:subscribe", { slug: "other" })).resolves.toEqual({
      error: "too-many-operations",
      ok: false,
    })
    resolveFirstSnapshot?.()
    await expect(waitingAck).resolves.toMatchObject({ ok: true })
    await expect(
      client.emitWithAck("room:unsubscribe", { roomId: "room-waiting" })
    ).resolves.toEqual({ ok: true })

    await expect(client.emitWithAck("room:subscribe", { slug: "first" })).resolves.toMatchObject({
      ok: true,
    })
    await expect(client.emitWithAck("room:subscribe", { slug: "second" })).resolves.toEqual({
      error: "room-limit",
      ok: false,
    })
    await expect(
      client.emitWithAck("room:read", { roomId: "room-first", sequence: "1" })
    ).resolves.toEqual({ error: "rate-limited", ok: false })
  })
})

function createService(overrides: Partial<NativeChatGatewayService> = {}) {
  return {
    getSnapshot: vi.fn().mockResolvedValue({
      member: { role: "MEMBER", status: "ACTIVE" },
      messages: [],
      room: { id: "room-ai", slug: "ai" },
    }),
    sendMessage: vi.fn().mockResolvedValue({
      created: true,
      message: {
        body: "Hello Arctic",
        clientMessageId: "message-0001",
        createdAt: "2026-07-14T12:00:00.000Z",
        id: "message-1",
        kind: "TEXT",
        roomId: "room-ai",
        senderUserId: "user-1",
        sequence: "1",
      },
    }),
    updateReadMarker: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as NativeChatGatewayService
}

function testIdentity() {
  return {
    authVersion: 0,
    authorizedAt: new Date().toISOString(),
    chatEnabled: true as const,
    emailVerified: true as const,
    handle: "northernlights",
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
  return new Promise<unknown>((resolve) => socket.once(event, resolve))
}

function waitForConnect(socket: ReturnType<typeof createSocketClient>) {
  return new Promise<void>((resolve, reject) => {
    socket.once("connect", () => resolve())
    socket.once("connect_error", reject)
  })
}

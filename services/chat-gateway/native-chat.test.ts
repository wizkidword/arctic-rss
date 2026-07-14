import { io as createSocketClient } from "socket.io-client"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { ChatGateway } from "./gateway"
import { createChatGateway } from "./gateway"
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
        handle: "northernlights",
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
})

function once(socket: ReturnType<typeof createSocketClient>, event: string) {
  return new Promise<unknown>((resolve) => socket.once(event, resolve))
}

function waitForConnect(socket: ReturnType<typeof createSocketClient>) {
  return new Promise<void>((resolve, reject) => {
    socket.once("connect", () => resolve())
    socket.once("connect_error", reject)
  })
}

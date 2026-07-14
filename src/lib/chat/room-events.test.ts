import { describe, expect, it, vi } from "vitest"

import {
  CHAT_ROOM_EVENT_CHANNEL,
  parseChatRoomEvent,
  publishChatRoomClosed,
  parseChatRoomMessageEvent,
  publishChatRoomMembershipRemoved,
  publishChatRoomMessage,
} from "./room-events"

const message = {
  article: { id: "article-1234", publisher: "Arctic Feed", title: "An article" },
  body: "An article",
  clientMessageId: "message-0001",
  createdAt: "2026-07-14T12:00:00.000Z",
  id: "message-1",
  kind: "ARTICLE" as const,
  roomId: "room-1",
  senderHandle: "northernlights",
  senderUserId: "user-1",
  sequence: "12",
}

describe("chat room events", () => {
  it("serializes only the compact message wire shape for room fan-out", async () => {
    const publish = vi.fn().mockResolvedValue(1)

    await publishChatRoomMessage(message, { publisher: { publish } })

    expect(publish).toHaveBeenCalledWith(
      CHAT_ROOM_EVENT_CHANNEL,
      JSON.stringify({ message, type: "room-message" })
    )
  })

  it("rejects malformed Redis payloads", () => {
    expect(parseChatRoomMessageEvent("not-json")).toBeNull()
    expect(parseChatRoomMessageEvent(JSON.stringify({ type: "room-message", message: { id: "partial" } }))).toBeNull()
    expect(parseChatRoomMessageEvent(JSON.stringify({ message, type: "room-message" }))).toEqual({
      message,
      type: "room-message",
    })
  })

  it("delivers only validated membership eviction events", async () => {
    const publish = vi.fn().mockResolvedValue(1)

    await publishChatRoomMembershipRemoved(
      { roomId: "room-1234", targetUserId: "user-1234" },
      { publisher: { publish } }
    )

    expect(publish).toHaveBeenCalledWith(
      CHAT_ROOM_EVENT_CHANNEL,
      JSON.stringify({
        roomId: "room-1234",
        targetUserId: "user-1234",
        type: "membership-removed",
      })
    )
    expect(
      parseChatRoomEvent(
        JSON.stringify({
          roomId: "room-1234",
          targetUserId: "user-1234",
          type: "membership-removed",
        })
      )
    ).toEqual({
      roomId: "room-1234",
      targetUserId: "user-1234",
      type: "membership-removed",
    })
    expect(
      parseChatRoomEvent(
        JSON.stringify({ roomId: "bad", targetUserId: "user-1234", type: "membership-removed" })
      )
    ).toBeNull()
  })

  it("validates room closure events without event metadata", async () => {
    const publish = vi.fn().mockResolvedValue(1)

    await publishChatRoomClosed({ roomId: "room-1234" }, { publisher: { publish } })

    expect(publish).toHaveBeenCalledWith(
      CHAT_ROOM_EVENT_CHANNEL,
      JSON.stringify({ roomId: "room-1234", type: "room-closed" })
    )
    expect(
      parseChatRoomEvent(JSON.stringify({ roomId: "room-1234", type: "room-closed" }))
    ).toEqual({ roomId: "room-1234", type: "room-closed" })
  })
})

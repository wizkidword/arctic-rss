import { describe, expect, it, vi } from "vitest"

import type { ChatRoomStore } from "./room-service"
import {
  ChatRoomServiceError,
  getChatRoomSnapshot,
  getChatRoomMemberWhois,
  parseChatMessageInput,
  parseChatTopicInput,
  parseChatArticleShareInput,
  shareChatRoomArticle,
  sendChatRoomMessage,
  updateChatRoomTopic,
  updateChatReadMarker,
} from "./room-service"

const identity = { role: "USER" as const, userId: "user-1" }

function room() {
  return {
    description: "Test room",
    historyVisibility: "MEMBERS" as const,
    id: "room-1",
    interests: [{ interestId: "ai" }],
    isOfficial: true,
    joinPolicy: "OPEN" as const,
    languageCode: "en",
    name: "AI",
    slug: "ai",
    state: "ACTIVE" as const,
    topicLine: "Test topic",
    visibility: "PUBLIC" as const,
  }
}

function activeMembership() {
  return {
    lastReadMessageSequence: null,
    role: "MEMBER" as const,
    roomId: "room-1",
    status: "ACTIVE" as const,
    userId: "user-1",
  }
}

function message() {
  return {
    body: "Hello Arctic",
    clientMessageId: "message-0001",
    createdAt: new Date("2026-07-14T12:00:00.000Z"),
    id: "message-1",
    kind: "TEXT" as const,
    roomId: "room-1",
    senderUserId: "user-1",
    sequence: BigInt(1),
  }
}

describe("chat room service", () => {
  it("only returns member history to active members", async () => {
    const findMany = vi.fn()
    const store = {
      chatMessage: { findMany },
      chatRoom: { findUnique: vi.fn().mockResolvedValue(room()) },
      chatRoomBan: {},
      chatRoomMember: { findUnique: vi.fn().mockResolvedValue(null) },
    } as unknown as ChatRoomStore

    await expect(
      getChatRoomSnapshot({ identity, slug: "ai", store })
    ).rejects.toMatchObject({ code: "forbidden" } satisfies Partial<ChatRoomServiceError>)
    expect(findMany).not.toHaveBeenCalled()
  })

  it("returns an existing message for an idempotent retry", async () => {
    const existing = message()
    const create = vi.fn()
    const store = {
      chatMessage: { create, findUnique: vi.fn().mockResolvedValue(existing) },
      chatRoom: {},
      chatRoomBan: {},
      chatRoomMember: {},
    } as unknown as ChatRoomStore

    await expect(
      sendChatRoomMessage({
        body: "Hello Arctic",
        clientMessageId: "message-0001",
        identity,
        roomId: "room-1",
        store,
      })
    ).resolves.toEqual({
      created: false,
      message: expect.objectContaining({ id: "message-1", sequence: "1" }),
    })
    expect(create).not.toHaveBeenCalled()
  })

  it("returns durable history in chronological order for reconnect catch-up", async () => {
    const first = message()
    const second = { ...message(), id: "message-2", sequence: BigInt(2) }
    const findMany = vi.fn().mockResolvedValue([second, first])
    const store = {
      chatMessage: { findMany },
      chatRoom: { findUnique: vi.fn().mockResolvedValue(room()) },
      chatRoomBan: {},
      chatRoomMember: { findUnique: vi.fn().mockResolvedValue(activeMembership()) },
    } as unknown as ChatRoomStore

    await expect(
      getChatRoomSnapshot({
        beforeSequence: BigInt(3),
        identity,
        slug: "ai",
        store,
      })
    ).resolves.toMatchObject({
      messages: [{ id: "message-1", sequence: "1" }, { id: "message-2", sequence: "2" }],
    })
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ sequence: { lt: BigInt(3) } }),
      })
    )
  })

  it("creates one durable message for an active room member", async () => {
    const created = message()
    const store = {
      chatMessage: {
        create: vi.fn().mockResolvedValue(created),
        findUnique: vi.fn().mockResolvedValue(null),
      },
      chatRoom: {
        findUnique: vi.fn().mockResolvedValue(room()),
        update: vi.fn().mockResolvedValue({}),
      },
      chatRoomBan: {},
      chatRoomMember: { findUnique: vi.fn().mockResolvedValue(activeMembership()) },
    } as unknown as ChatRoomStore

    await expect(
      sendChatRoomMessage({
        body: "Hello Arctic",
        clientMessageId: "message-0001",
        identity,
        roomId: "room-1",
        store,
      })
    ).resolves.toMatchObject({
      created: true,
      message: { body: "Hello Arctic", sequence: "1" },
    })
  })

  it("persists typed action messages without accepting arbitrary message kinds", async () => {
    const create = vi.fn().mockResolvedValue({ ...message(), kind: "ACTION" })
    const store = {
      chatMessage: { create, findUnique: vi.fn().mockResolvedValue(null) },
      chatRoom: { findUnique: vi.fn().mockResolvedValue(room()), update: vi.fn().mockResolvedValue({}) },
      chatRoomBan: {},
      chatRoomMember: { findUnique: vi.fn().mockResolvedValue(activeMembership()) },
    } as unknown as ChatRoomStore

    await sendChatRoomMessage({
      body: "waves",
      clientMessageId: "message-0001",
      identity,
      kind: "ACTION",
      roomId: "room-1",
      store,
    })

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ kind: "ACTION" }) }))
    expect(() => parseChatMessageInput({ body: "hello", clientMessageId: "message-0001", kind: "SYSTEM" })).toThrow("Message input is invalid.")
  })

  it("enforces active room mutes and slow mode before persisting messages", async () => {
    const mutedStore = {
      chatMessage: { findUnique: vi.fn().mockResolvedValue(null) },
      chatRoom: { findUnique: vi.fn().mockResolvedValue({ ...room(), slowModeSeconds: 0 }) },
      chatRoomBan: {},
      chatRoomMember: {
        findUnique: vi.fn().mockResolvedValue({
          ...activeMembership(),
          roomMutedUntil: new Date(Date.now() + 60_000),
        }),
      },
    } as unknown as ChatRoomStore

    await expect(
      sendChatRoomMessage({
        body: "Hello Arctic",
        clientMessageId: "message-0001",
        identity,
        roomId: "room-1",
        store: mutedStore,
      })
    ).rejects.toMatchObject({ code: "muted" } satisfies Partial<ChatRoomServiceError>)

    const slowStore = {
      chatMessage: {
        findFirst: vi.fn().mockResolvedValue({ createdAt: new Date() }),
        findUnique: vi.fn().mockResolvedValue(null),
      },
      chatRoom: { findUnique: vi.fn().mockResolvedValue({ ...room(), slowModeSeconds: 30 }) },
      chatRoomBan: {},
      chatRoomMember: { findUnique: vi.fn().mockResolvedValue(activeMembership()) },
    } as unknown as ChatRoomStore

    await expect(
      sendChatRoomMessage({
        body: "Hello Arctic",
        clientMessageId: "message-0001",
        identity,
        roomId: "room-1",
        store: slowStore,
      })
    ).rejects.toMatchObject({ code: "slow-mode" } satisfies Partial<ChatRoomServiceError>)
  })

  it("shares an owned article as a compact ARTICLE message without its body", async () => {
    const create = vi.fn().mockResolvedValue({
      ...message(),
      article: { feed: { title: "Arctic Feed" }, id: "article-1234", title: "A useful article" },
      kind: "ARTICLE",
    })
    const store = {
      article: { findFirst: vi.fn().mockResolvedValue({ feed: { title: "Arctic Feed" }, id: "article-1234", title: "A useful article" }) },
      chatMessage: { create, findFirst: vi.fn().mockResolvedValue(null), findUnique: vi.fn().mockResolvedValue(null) },
      chatRoom: { findUnique: vi.fn().mockResolvedValue(room()), update: vi.fn().mockResolvedValue({}) },
      chatRoomBan: {},
      chatRoomMember: { findUnique: vi.fn().mockResolvedValue(activeMembership()) },
    } as unknown as ChatRoomStore

    await expect(shareChatRoomArticle({
      articleId: "article-1234",
      clientMessageId: "message-0001",
      identity,
      roomId: "room-1",
      store,
    })).resolves.toMatchObject({
      created: true,
      message: { article: { id: "article-1234", publisher: "Arctic Feed", title: "A useful article" }, kind: "ARTICLE" },
    })
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ articleId: "article-1234", kind: "ARTICLE" }),
    }))
    expect(create.mock.calls[0][0].data).not.toHaveProperty("contentText")
  })

  it("rejects malformed and duplicate article shares", async () => {
    expect(() => parseChatArticleShareInput({ articleId: "bad", clientMessageId: "message-0001" })).toThrow("Article share input is invalid.")
    const create = vi.fn()
    const store = {
      article: { findFirst: vi.fn().mockResolvedValue({ feed: { title: "Arctic Feed" }, id: "article-1234", title: "A useful article" }) },
      chatMessage: { create, findFirst: vi.fn().mockResolvedValue({ id: "prior-share" }), findUnique: vi.fn().mockResolvedValue(null) },
      chatRoom: { findUnique: vi.fn().mockResolvedValue(room()) },
      chatRoomBan: {},
      chatRoomMember: { findUnique: vi.fn().mockResolvedValue(activeMembership()) },
    } as unknown as ChatRoomStore

    await expect(shareChatRoomArticle({
      articleId: "article-1234",
      clientMessageId: "message-0001",
      identity,
      roomId: "room-1",
      store,
    })).rejects.toMatchObject({ code: "duplicate-article" } satisfies Partial<ChatRoomServiceError>)
    expect(create).not.toHaveBeenCalled()
  })

  it("enforces topic authority in the service before persistence", async () => {
    const update = vi.fn().mockResolvedValue({ ...room(), topicLine: "Updated topic" })
    const store = {
      chatMessage: {},
      chatRoom: { findUnique: vi.fn().mockResolvedValue(room()), update },
      chatRoomBan: {},
      chatRoomMember: { findUnique: vi.fn().mockResolvedValue({ ...activeMembership(), role: "OPERATOR" }) },
    } as unknown as ChatRoomStore

    await expect(updateChatRoomTopic({ identity, slug: "ai", store, topic: "Updated topic" })).resolves.toMatchObject({ topicLine: "Updated topic" })
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: { topicLine: "Updated topic" } }))
    expect(() => parseChatTopicInput("\u0000bad")).toThrow("Room topic is invalid.")
  })

  it("rejects an unauthorized topic command before changing a room", async () => {
    const update = vi.fn()
    const store = {
      chatMessage: {},
      chatRoom: { findUnique: vi.fn().mockResolvedValue(room()), update },
      chatRoomBan: {},
      chatRoomMember: { findUnique: vi.fn().mockResolvedValue(activeMembership()) },
    } as unknown as ChatRoomStore

    await expect(
      updateChatRoomTopic({ identity, slug: "ai", store, topic: "Nope" })
    ).rejects.toMatchObject({ code: "forbidden" } satisfies Partial<ChatRoomServiceError>)
    expect(update).not.toHaveBeenCalled()
  })

  it("limits whois results to active members of a room the requester can read", async () => {
    const store = {
      chatMessage: {},
      chatRoom: { findUnique: vi.fn().mockResolvedValue(room()) },
      chatRoomBan: {},
      chatRoomMember: {
        findFirst: vi.fn().mockResolvedValue({ role: "VOICE", user: { chatProfile: { handle: "northernlights" } } }),
        findUnique: vi.fn().mockResolvedValue(activeMembership()),
      },
    } as unknown as ChatRoomStore

    await expect(getChatRoomMemberWhois({ handle: "NorthernLights", identity, slug: "ai", store })).resolves.toEqual({ handle: "northernlights", role: "VOICE" })
  })

  it("rejects malformed message payloads before they reach persistence", () => {
    expect(() => parseChatMessageInput({ body: "", clientMessageId: "message-0001" })).toThrow(
      "Message input is invalid."
    )
    expect(() =>
      parseChatMessageInput({ body: "hello", clientMessageId: "bad" })
    ).toThrow("Message input is invalid.")
  })

  it("only advances a member read marker", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 })
    const store = {
      chatMessage: {},
      chatRoom: {},
      chatRoomBan: {},
      chatRoomMember: {
        findUnique: vi.fn().mockResolvedValue(activeMembership()),
        updateMany,
      },
    } as unknown as ChatRoomStore

    await updateChatReadMarker({
      identity,
      roomId: "room-1",
      sequence: BigInt(12),
      store,
    })

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { lastReadMessageSequence: null },
            { lastReadMessageSequence: { lt: BigInt(12) } },
          ]),
        }),
      })
    )
  })
})

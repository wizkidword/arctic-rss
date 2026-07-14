import { describe, expect, it, vi } from "vitest"

import {
  CHAT_BOT_MAX_DIGEST_ITEMS,
  ChatBotError,
  configureChatRoomFeed,
  parseChatRoomFeedSettingsInput,
  processChatArticleIntegration,
} from "./bot"

const now = new Date("2026-07-14T12:00:00.000Z")

function createStore({
  deliveries = [delivery("article-1", "First article")],
  room = activeRoom(),
}: {
  deliveries?: Array<ReturnType<typeof delivery>>
  room?: ReturnType<typeof activeRoom>
} = {}) {
  const messageCreate = vi.fn().mockResolvedValue({
    article: deliveries.length === 1
      ? { feed: { title: "Example feed" }, id: deliveries[0].article.id, title: deliveries[0].article.title }
      : null,
    body: "New from Example feed: First article",
    clientMessageId: "arcticbot-room-1-article-1",
    createdAt: now,
    id: "message-1",
    kind: "BOT",
    roomId: "room-1",
    senderUserId: null,
    sequence: BigInt(1),
  })

  const store = {
    $transaction: async <T>(work: (transaction: unknown) => Promise<T>) =>
      work(store),
    article: {
      findUnique: vi.fn().mockResolvedValue({ feedId: "feed-1", id: "article-1" }),
    },
    chatAuditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
    chatBotDelivery: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi.fn().mockResolvedValue(deliveries),
      updateMany: vi.fn().mockResolvedValue({ count: deliveries.length }),
      upsert: vi.fn().mockResolvedValue({}),
    },
    chatMessage: { create: messageCreate },
    chatRoom: {
      findUnique: vi.fn().mockResolvedValue(room),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    chatRoomFeed: {
      findMany: vi.fn().mockResolvedValue([
        {
          feedId: "feed-1",
          minimumIntervalMinutes: 60,
          postingMode: "LIVE",
          roomId: "room-1",
        },
      ]),
      findUnique: vi.fn().mockResolvedValue({
        feedId: "feed-1",
        minimumIntervalMinutes: 60,
        postingMode: "LIVE",
        roomId: "room-1",
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      upsert: vi.fn().mockResolvedValue({}),
    },
    chatRoomMember: { findUnique: vi.fn().mockResolvedValue(null) },
    feedSubscription: { findFirst: vi.fn().mockResolvedValue({ id: "subscription-1" }) },
  }

  return { messageCreate, store }
}

function activeRoom(): {
  botLastPostedAt: Date | null
  id: string
  isOfficial: boolean
  slug: string
  state: "ACTIVE"
} {
  return {
    botLastPostedAt: null,
    id: "room-1",
    isOfficial: true,
    slug: "news",
    state: "ACTIVE" as const,
  }
}

function delivery(articleId: string, title: string) {
  return {
    article: {
      feed: { title: "Example feed" },
      id: articleId,
      title,
    },
    articleId,
  }
}

describe("ArcticBot", () => {
  it("does not inspect articles or create automated posts while its flag is off", async () => {
    const { store } = createStore()

    await expect(
      processChatArticleIntegration({
        articleId: "article-1",
        environment: { ARCTIC_IRC_ENABLED: "true", ARCTIC_IRC_BOT_ENABLED: "false" },
        store: store as never,
      })
    ).resolves.toEqual({ disabled: true, messages: [], queued: 0 })

    expect(store.article.findUnique).not.toHaveBeenCalled()
    expect(store.chatMessage.create).not.toHaveBeenCalled()
  })

  it("writes a clearly labeled native BOT message for an eligible official room", async () => {
    const { store } = createStore()

    const result = await processChatArticleIntegration({
      articleId: "article-1",
      environment: { ARCTIC_IRC_ENABLED: "true", ARCTIC_IRC_BOT_ENABLED: "true" },
      now: () => now,
      store: store as never,
    })

    expect(result).toMatchObject({ disabled: false, queued: 1 })
    expect(result.messages).toEqual([
      expect.objectContaining({
        article: { id: "article-1", publisher: "Example feed", title: "First article" },
        kind: "BOT",
        senderHandle: null,
        senderUserId: null,
      }),
    ])
    expect(store.chatMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          articleId: "article-1",
          body: "New from Example feed: First article",
          kind: "BOT",
          senderUserId: null,
        }),
      })
    )
    expect(store.chatBotDelivery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { messageId: "message-1", status: "POSTED" },
      })
    )
  })

  it("does not post when the durable room cooldown has not elapsed", async () => {
    const { store } = createStore({
      room: { ...activeRoom(), botLastPostedAt: now },
    })

    const result = await processChatArticleIntegration({
      articleId: "article-1",
      environment: { ARCTIC_IRC_ENABLED: "true", ARCTIC_IRC_BOT_ENABLED: "true" },
      now: () => now,
      store: store as never,
    })

    expect(result.messages).toEqual([])
    expect(store.chatRoom.updateMany).not.toHaveBeenCalled()
    expect(store.chatMessage.create).not.toHaveBeenCalled()
  })

  it("uses a bounded compact digest rather than article bodies", async () => {
    const deliveries = Array.from({ length: CHAT_BOT_MAX_DIGEST_ITEMS }, (_, index) =>
      delivery(`article-${index + 1}`, `Article ${index + 1}`)
    )
    const { store, messageCreate } = createStore({ deliveries })
    vi.mocked(store.chatRoomFeed.findMany).mockResolvedValue([
      {
        feedId: "feed-1",
        minimumIntervalMinutes: 60,
        postingMode: "DIGEST",
        roomId: "room-1",
      },
    ])
    vi.mocked(store.chatRoomFeed.findUnique).mockResolvedValue({
      feedId: "feed-1",
      minimumIntervalMinutes: 60,
      postingMode: "DIGEST",
      roomId: "room-1",
    })
    messageCreate.mockResolvedValue({
      article: null,
      body: "ArcticBot digest",
      clientMessageId: "arcticbot-digest-room-1-article-1",
      createdAt: now,
      id: "message-1",
      kind: "BOT",
      roomId: "room-1",
      senderUserId: null,
      sequence: BigInt(1),
    })

    await processChatArticleIntegration({
      articleId: "article-1",
      environment: { ARCTIC_IRC_ENABLED: "true", ARCTIC_IRC_BOT_ENABLED: "true" },
      now: () => now,
      store: store as never,
    })

    expect(store.chatBotDelivery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: CHAT_BOT_MAX_DIGEST_ITEMS })
    )
    expect(messageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          body: expect.stringContaining("• Article 1"),
          kind: "BOT",
          metadata: expect.objectContaining({ mode: "DIGEST" }),
        }),
      })
    )
  })

  it("strictly validates configuration and never permits a zero cooldown", () => {
    expect(() =>
      parseChatRoomFeedSettingsInput({
        feedId: "feed-1234",
        minimumIntervalMinutes: 0,
        postingMode: "LIVE",
      })
    ).toThrow(ChatBotError)
    expect(
      parseChatRoomFeedSettingsInput({
        feedId: "feed-1234",
        minimumIntervalMinutes: 60,
        postingMode: "DIGEST",
      })
    ).toEqual({
      feedId: "feed-1234",
      minimumIntervalMinutes: 60,
      postingMode: "DIGEST",
    })
  })

  it("discards pending deliveries when an operator switches a feed off", async () => {
    const { store } = createStore()
    vi.mocked(store.chatRoomMember.findUnique).mockResolvedValue({
      role: "OPERATOR",
      status: "ACTIVE",
    })
    vi.mocked(store.chatRoomFeed.upsert).mockResolvedValue({
      feedId: "feed-1",
      minimumIntervalMinutes: 60,
      postingMode: "OFF",
      roomId: "room-1",
    })
    vi.mocked(store.chatBotDelivery.deleteMany).mockResolvedValue({ count: 2 })

    await configureChatRoomFeed({
      identity: { role: "USER", userId: "user-1" },
      roomSlug: "news",
      settings: {
        feedId: "feed-1",
        minimumIntervalMinutes: 60,
        postingMode: "OFF",
      },
      store: store as never,
    })

    expect(store.chatBotDelivery.deleteMany).toHaveBeenCalledWith({
      where: { feedId: "feed-1", roomId: "room-1", status: "PENDING" },
    })
    expect(store.chatAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "BOT_FEED_CONFIGURED",
          metadata: expect.objectContaining({ discardedPendingDeliveryCount: 2 }),
        }),
      })
    )
  })
})

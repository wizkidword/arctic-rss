import { describe, expect, it, vi } from "vitest"

import type { ChatModerationStore } from "./moderation"
import {
  ChatModerationError,
  banChatRoomMember,
  createChatReport,
  kickChatRoomMember,
  listChatReports,
  parseChatReportInput,
  resolveChatReport,
  updateChatRoomModerationSettings,
} from "./moderation"

const identity = { role: "USER" as const, userId: "user-1" }

function room() {
  return {
    id: "room-1234",
    joinPolicy: "OPEN" as const,
    name: "AI \u202e Research",
    slug: "ai",
    slowModeSeconds: 0,
    state: "ACTIVE" as const,
  }
}

function member(userId: string, role: "MEMBER" | "OPERATOR" = "MEMBER") {
  return {
    role,
    roomId: "room-1234",
    roomMutedUntil: null,
    status: "ACTIVE" as const,
    userId,
  }
}

function createStore() {
  const actor = member("user-1", "OPERATOR")
  const target = member("user-2222")
  const memberFindUnique = vi.fn(({ where }: { where: { roomId_userId: { userId: string } } }) =>
    Promise.resolve(where.roomId_userId.userId === "user-1" ? actor : target)
  )

  return {
    chatAuditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
    chatEventOutbox: { create: vi.fn().mockResolvedValue({ id: "event-1" }) },
    chatMessage: {
      findUnique: vi.fn().mockResolvedValue({
        article: {
          feed: { title: "Northern \u202e Feed" },
          id: "article-1234",
          title: "A relevant story",
        },
        body: "  Targeted\u0000 abuse\r\nin the room.\u202e  ",
        createdAt: new Date("2026-07-14T12:00:00.000Z"),
        deletedAt: null,
        editedAt: null,
        id: "message-1234",
        kind: "TEXT",
        replyTo: {
          body: "Prior\u0000 context",
          createdAt: new Date("2026-07-14T11:59:00.000Z"),
          id: "message-1233",
          kind: "TEXT",
          senderUserId: "user-3",
          sequence: BigInt(8),
          version: 1,
        },
        roomId: "room-1234",
        sender: { chatProfile: { handle: "northernlights" } },
        senderUserId: "user-2222",
        sequence: BigInt(9),
        version: 1,
      }),
    },
    chatProfile: {
      findUnique: vi.fn().mockResolvedValue({ handle: "northernlights", userId: "user-2222" }),
    },
    chatReport: {
      create: vi.fn().mockResolvedValue({ id: "report-1", status: "OPEN" }),
      findUnique: vi.fn().mockResolvedValue({
        id: "report-1",
        messageId: "message-1234",
        roomId: "room-1234",
        targetUserId: "user-2222",
      }),
      update: vi.fn().mockResolvedValue({ id: "report-1" }),
    },
    chatRoom: {
      findUnique: vi.fn().mockResolvedValue(room()),
      update: vi.fn().mockResolvedValue(room()),
    },
    chatRoomBan: {
      create: vi.fn().mockResolvedValue({ id: "ban-1" }),
      findFirst: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    chatRoomMember: {
      findUnique: memberFindUnique,
      update: vi.fn().mockResolvedValue({ userId: "user-2222" }),
    },
  } as unknown as ChatModerationStore
}

describe("chat moderation", () => {
  it("captures complete, sanitized immutable evidence in the report transaction", async () => {
    const store = createStore()

    await expect(
      createChatReport({
        identity,
        input: parseChatReportInput({
          category: "HARASSMENT",
          details: "Targeted abuse in the room.",
          messageId: "message-1234",
        }),
        store,
      })
    ).resolves.toEqual({ id: "report-1", status: "OPEN" })

    expect(store.chatReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          evidence: {
            create: {
              captureState: "CAPTURED",
              capturedAt: expect.any(Date),
              contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
              schemaVersion: 2,
              snapshot: {
                message: {
                  article: {
                    feedTitle: "Northern Feed",
                    id: "article-1234",
                    title: "A relevant story",
                  },
                  body: "Targeted abuse\nin the room.",
                  createdAt: "2026-07-14T12:00:00.000Z",
                  deletedAt: null,
                  editedAt: null,
                  id: "message-1234",
                  kind: "TEXT",
                  replyTo: expect.objectContaining({
                    bodyExcerpt: "Prior context",
                    id: "message-1233",
                    sequence: "8",
                    version: 1,
                  }),
                  senderHandle: "northernlights",
                  senderUserId: "user-2222",
                  sequence: "9",
                  version: 1,
                },
                room: { id: "room-1234", name: "AI Research", slug: "ai" },
                target: null,
                v: 2,
              },
            },
          },
          roomId: "room-1234",
          targetUserId: "user-2222",
        }),
      })
    )
    expect(store.chatAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "REPORT_CREATED",
          metadata: { category: "HARASSMENT" },
        }),
      })
    )
  })

  it("does not let a nonmember use reporting to inspect a room message", async () => {
    const store = createStore()
    vi.mocked(store.chatRoomMember.findUnique).mockResolvedValueOnce(null)

    await expect(
      createChatReport({
        identity,
        input: parseChatReportInput({ category: "SPAM", messageId: "message-1234" }),
        store,
      })
    ).rejects.toMatchObject({ code: "forbidden" } satisfies Partial<ChatModerationError>)
    expect(store.chatReport.create).not.toHaveBeenCalled()
  })

  it("returns report evidence only through the administrator report query", async () => {
    const store = createStore()
    const findMany = vi.fn().mockResolvedValue([])
    ;(store.chatReport as unknown as { findMany: typeof findMany }).findMany = findMany

    await expect(
      listChatReports({ identity: { role: "ADMIN", userId: "admin-1" }, store })
    ).resolves.toEqual([])

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          evidence: {
            select: {
              captureState: true,
              capturedAt: true,
              contentHash: true,
              schemaVersion: true,
              snapshot: true,
            },
          },
        }),
      })
    )
  })

  it("keeps captured evidence available to an administrator after a message is gone", async () => {
    const store = createStore()
    const evidence = {
      captureState: "CAPTURED",
      capturedAt: new Date("2026-07-14T12:00:00.000Z"),
      contentHash: "a".repeat(64),
      schemaVersion: 2,
      snapshot: { message: { body: "Preserved evidence" }, v: 2 },
    }
    const findMany = vi.fn().mockResolvedValue([
      {
        category: "HARASSMENT",
        createdAt: new Date("2026-07-14T12:00:00.000Z"),
        details: null,
        evidence,
        id: "report-1",
        messageId: null,
        room: null,
        status: "OPEN",
        target: null,
      },
    ])
    ;(store.chatReport as unknown as { findMany: typeof findMany }).findMany = findMany

    await expect(
      listChatReports({ identity: { role: "ADMIN", userId: "admin-1" }, store })
    ).resolves.toEqual([
      expect.objectContaining({ evidence, id: "report-1", messageId: null }),
    ])
    expect(store.chatAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "REPORT_EVIDENCE_VIEWED",
          actorUserId: "admin-1",
          metadata: { reportIds: ["report-1"] },
        }),
      })
    )
  })

  it("does not return evidence to a non-administrator", async () => {
    const store = createStore()

    await expect(listChatReports({ identity, store })).rejects.toMatchObject({
      code: "forbidden",
    } satisfies Partial<ChatModerationError>)
    expect(store.chatReport.findMany).toBeUndefined()
  })

  it("bans a lower-role member, leaves the room, and writes an audit row", async () => {
    const store = createStore()

    await expect(
      banChatRoomMember({
        durationSeconds: 3_600,
        identity,
        reason: "Repeated spam after warnings.",
        roomSlug: "ai",
        store,
        targetHandle: "northernlights",
      })
    ).resolves.toMatchObject({ roomId: "room-1234", targetUserId: "user-2222" })

    expect(store.chatRoomBan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdByUserId: "user-1",
          reason: "Repeated spam after warnings.",
          roomId: "room-1234",
          targetUserId: "user-2222",
        }),
      })
    )
    expect(store.chatRoomMember.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "LEFT" }) })
    )
    expect(store.chatAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "MEMBER_BANNED" }) })
    )
    expect(store.chatEventOutbox.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "membership-removed",
          payload: { roomId: "room-1234", targetUserId: "user-2222", type: "membership-removed" },
        }),
      })
    )
  })

  it("queues room membership and suspension events with their moderation state", async () => {
    const store = createStore()

    await kickChatRoomMember({
      identity,
      reason: "Repeated spam after warnings.",
      roomSlug: "ai",
      store,
      targetHandle: "northernlights",
    })
    await updateChatRoomModerationSettings({
      identity: { role: "ADMIN", userId: "admin-1" },
      roomSlug: "ai",
      settings: { action: "state", state: "SUSPENDED" },
      store,
    })

    expect(store.chatEventOutbox.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          payload: { roomId: "room-1234", targetUserId: "user-2222", type: "membership-removed" },
        }),
      })
    )
    expect(store.chatEventOutbox.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          payload: { roomId: "room-1234", type: "room-closed" },
        }),
      })
    )
  })

  it("serializes concurrent ban attempts so only one current ban is created", async () => {
    const store = createStore()
    vi.mocked(store.chatRoomBan.findFirst)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "ban-1" } as never)
    const executeRaw = vi.fn().mockResolvedValue(0)
    const transaction = vi.fn(async (work) => work({ ...store, $executeRaw: executeRaw }))
    const transactionalStore = { ...store, $executeRaw: executeRaw, $transaction: transaction }

    const results = await Promise.all([
      banChatRoomMember({
        durationSeconds: null,
        identity,
        reason: "Repeated spam after warnings.",
        roomSlug: "ai",
        store: transactionalStore as never,
        targetHandle: "northernlights",
      }),
      banChatRoomMember({
        durationSeconds: null,
        identity,
        reason: "Repeated spam after warnings.",
        roomSlug: "ai",
        store: transactionalStore as never,
        targetHandle: "northernlights",
      }),
    ])

    expect(store.chatRoomBan.create).toHaveBeenCalledTimes(1)
    expect(results.map((result) => result.alreadyBanned).sort()).toEqual([false, true])
    expect(transaction).toHaveBeenCalledTimes(2)
    expect(executeRaw).toHaveBeenCalledTimes(4)
  })

  it("resolves a report and writes its audit record in one transaction", async () => {
    const store = createStore()
    const transaction = vi.fn(async (work) => work(store))
    const transactionalStore = { ...store, $transaction: transaction }

    await expect(
      resolveChatReport({
        identity: { role: "ADMIN", userId: "admin-1" },
        input: { retentionClass: "SERIOUS", status: "ACTIONED" },
        reportId: "report-1",
        store: transactionalStore as never,
      })
    ).resolves.toMatchObject({ id: "report-1", retentionClass: "SERIOUS" })

    expect(transaction).toHaveBeenCalledTimes(1)
    expect(store.chatReport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ retentionClass: "SERIOUS", status: "ACTIONED" }),
      })
    )
    expect(store.chatAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "REPORT_RESOLVED" }) })
    )
  })

  it("does not let an operator moderate an equal room role", async () => {
    const store = createStore()
    const findUnique = store.chatRoomMember.findUnique as unknown as {
      mockResolvedValueOnce: (value: unknown) => unknown
    }
    findUnique.mockResolvedValueOnce(member("user-1", "OPERATOR"))
    findUnique.mockResolvedValueOnce(member("user-2222", "OPERATOR"))

    await expect(
      banChatRoomMember({
        durationSeconds: null,
        identity,
        reason: "Attempted role conflict.",
        roomSlug: "ai",
        store,
        targetHandle: "northernlights",
      })
    ).rejects.toMatchObject({ code: "forbidden" } satisfies Partial<ChatModerationError>)
    expect(store.chatRoomBan.create).not.toHaveBeenCalled()
  })

  it("allows a room operator to set bounded slow mode but not suspend a room", async () => {
    const store = createStore()

    await expect(
      updateChatRoomModerationSettings({
        identity,
        roomSlug: "ai",
        settings: { action: "slow-mode", seconds: 30 },
        store,
      })
    ).resolves.toMatchObject({ id: "room-1234" })
    await expect(
      updateChatRoomModerationSettings({
        identity,
        roomSlug: "ai",
        settings: { action: "state", state: "SUSPENDED" },
        store,
      })
    ).rejects.toMatchObject({ code: "forbidden" } satisfies Partial<ChatModerationError>)
  })
})

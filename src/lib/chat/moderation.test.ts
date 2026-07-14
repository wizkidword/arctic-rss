import { describe, expect, it, vi } from "vitest"

import type { ChatModerationStore } from "./moderation"
import {
  ChatModerationError,
  banChatRoomMember,
  createChatReport,
  listChatReports,
  parseChatReportInput,
  updateChatRoomModerationSettings,
} from "./moderation"

const identity = { role: "USER" as const, userId: "user-1" }

function room() {
  return {
    id: "room-1234",
    joinPolicy: "OPEN" as const,
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
  const target = member("user-2")
  const memberFindUnique = vi.fn(({ where }: { where: { roomId_userId: { userId: string } } }) =>
    Promise.resolve(where.roomId_userId.userId === "user-1" ? actor : target)
  )

  return {
    chatAuditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
    chatMessage: {
      findUnique: vi.fn().mockResolvedValue({
        createdAt: new Date("2026-07-14T12:00:00.000Z"),
        id: "message-1234",
        roomId: "room-1234",
        senderUserId: "user-2",
        sequence: BigInt(9),
      }),
    },
    chatProfile: {
      findUnique: vi.fn().mockResolvedValue({ handle: "northernlights", userId: "user-2" }),
    },
    chatReport: { create: vi.fn().mockResolvedValue({ id: "report-1", status: "OPEN" }) },
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
      update: vi.fn().mockResolvedValue({ userId: "user-2" }),
    },
  } as unknown as ChatModerationStore
}

describe("chat moderation", () => {
  it("records a bounded report without copying the reported message body", async () => {
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
              snapshot: {
                createdAt: "2026-07-14T12:00:00.000Z",
                messageId: "message-1234",
                sequence: "9",
                v: 1,
              },
            },
          },
          roomId: "room-1234",
          targetUserId: "user-2",
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
          evidence: { select: { createdAt: true, snapshot: true } },
        }),
      })
    )
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
    ).resolves.toMatchObject({ roomId: "room-1234", targetUserId: "user-2" })

    expect(store.chatRoomBan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdByUserId: "user-1",
          reason: "Repeated spam after warnings.",
          roomId: "room-1234",
          targetUserId: "user-2",
        }),
      })
    )
    expect(store.chatRoomMember.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "LEFT" }) })
    )
    expect(store.chatAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "MEMBER_BANNED" }) })
    )
  })

  it("does not let an operator moderate an equal room role", async () => {
    const store = createStore()
    const findUnique = store.chatRoomMember.findUnique as unknown as {
      mockResolvedValueOnce: (value: unknown) => unknown
    }
    findUnique.mockResolvedValueOnce(member("user-1", "OPERATOR"))
    findUnique.mockResolvedValueOnce(member("user-2", "OPERATOR"))

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

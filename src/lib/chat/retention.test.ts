import { describe, expect, it, vi } from "vitest"

import type { ChatRetentionStore } from "./retention"
import { purgeExpiredChatRecords } from "./retention"

const now = new Date("2026-07-14T12:00:00.000Z")

function createStore() {
  const reportFindMany = vi.fn()
    .mockResolvedValueOnce([{ id: "report-1" }])
    .mockResolvedValueOnce([
      { reporterUserId: null, roomId: "room-1", targetUserId: "user-2" },
    ])

  return {
    accountDeletionRecord: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue([{ id: "deletion-1" }]),
    },
    chatAuditLog: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue([{ id: "audit-1" }]),
    },
    chatLegalHold: {
      count: vi.fn().mockResolvedValue(1),
      findMany: vi.fn().mockResolvedValue([]),
    },
    chatMessage: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue([{ id: "message-1" }]),
    },
    chatReport: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: reportFindMany,
    },
    chatRoomMember: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue([
        { id: "membership-1", roomId: "room-1", userId: "user-1" },
        { id: "membership-2", roomId: "room-1", userId: "user-2" },
      ]),
    },
  } as unknown as ChatRetentionStore
}

describe("chat retention", () => {
  it("purges bounded expired records while retaining historical membership for an active case", async () => {
    const store = createStore()

    await expect(purgeExpiredChatRecords({ batchSize: 25, now, store })).resolves.toEqual({
      legalHoldReviewsDue: 1,
      purgedAuditLogs: 1,
      purgedDeletionRecords: 1,
      purgedMemberships: 1,
      purgedMessages: 1,
      purgedReports: 1,
    })

    expect(store.chatMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 25,
        where: {
          OR: [
            { createdAt: { lte: new Date("2026-04-15T12:00:00.000Z") } },
            { deletedAt: { lte: new Date("2026-07-13T12:00:00.000Z") } },
          ],
        },
      })
    )
    expect(store.chatReport.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          OR: [
            { closedAt: { lte: new Date("2025-07-14T12:00:00.000Z") }, retentionClass: "ORDINARY" },
            { closedAt: { lte: new Date("2024-07-14T12:00:00.000Z") }, retentionClass: "SERIOUS" },
          ],
        },
      })
    )
    expect(store.chatRoomMember.findMany).toHaveBeenCalledWith({
      orderBy: { id: "asc" },
      select: { id: true, roomId: true, userId: true },
      take: 25,
      where: { leftAt: { lte: new Date("2026-06-14T12:00:00.000Z") }, status: "LEFT" },
    })
    expect(store.chatRoomMember.deleteMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["membership-1"] },
        leftAt: { lte: new Date("2026-06-14T12:00:00.000Z") },
        status: "LEFT",
      },
    })
  })
})

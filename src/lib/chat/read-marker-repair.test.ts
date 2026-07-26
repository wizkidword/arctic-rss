import { describe, expect, it, vi } from "vitest"

import { repairChatReadMarkers, type ChatReadMarkerRepairStore } from "./read-marker-repair"

describe("chat read-marker repair", () => {
  it("clamps only markers that exceed the latest visible message", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 })
    const store = {
      chatMessage: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({ sequence: BigInt(12) })
          .mockResolvedValueOnce({ sequence: BigInt(12) }),
      },
      chatRoomMember: {
        findMany: vi.fn().mockResolvedValue([
          { id: "member-1", lastReadMessageSequence: BigInt(15), roomId: "room-1" },
          { id: "member-2", lastReadMessageSequence: BigInt(10), roomId: "room-1" },
        ]),
        updateMany,
      },
    } as unknown as ChatReadMarkerRepairStore

    await expect(repairChatReadMarkers({ dryRun: false, store })).resolves.toEqual({
      clamped: 1,
      nextCursor: null,
      scanned: 2,
    })
    expect(updateMany).toHaveBeenCalledWith({
      data: { lastReadMessageSequence: BigInt(12) },
      where: {
        id: "member-1",
        lastReadMessageSequence: { gt: BigInt(12) },
      },
    })
  })

  it("dry-runs safely and clears a marker only when its room has no visible messages", async () => {
    const updateMany = vi.fn()
    const store = {
      chatMessage: { findFirst: vi.fn().mockResolvedValue(null) },
      chatRoomMember: {
        findMany: vi.fn().mockResolvedValue([
          { id: "member-1", lastReadMessageSequence: BigInt(15), roomId: "room-1" },
        ]),
        updateMany,
      },
    } as unknown as ChatReadMarkerRepairStore

    await expect(repairChatReadMarkers({ dryRun: true, store })).resolves.toEqual({
      clamped: 1,
      nextCursor: null,
      scanned: 1,
    })
    expect(updateMany).not.toHaveBeenCalled()
  })

  it("uses a stable cursor for bounded repair pages", async () => {
    const store = {
      chatMessage: { findFirst: vi.fn().mockResolvedValue({ sequence: BigInt(20) }) },
      chatRoomMember: {
        findMany: vi.fn().mockResolvedValue([
          { id: "member-1", lastReadMessageSequence: BigInt(10), roomId: "room-1" },
          { id: "member-2", lastReadMessageSequence: BigInt(10), roomId: "room-1" },
        ]),
        updateMany: vi.fn(),
      },
    } as unknown as ChatReadMarkerRepairStore

    await expect(
      repairChatReadMarkers({ afterId: "member-0", batchSize: 2, store })
    ).resolves.toEqual({ clamped: 0, nextCursor: "member-2", scanned: 2 })
    expect(store.chatRoomMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: "member-0" }, skip: 1 })
    )
  })
})

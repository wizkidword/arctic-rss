import { describe, expect, it, vi } from "vitest"

import {
  cleanupExpiredSecurityEvents,
  DEFAULT_SECURITY_EVENT_CLEANUP_BATCH_SIZE,
} from "./security-event-maintenance"

describe("security event maintenance", () => {
  it("removes only a bounded batch of events at the 90-day boundary", async () => {
    const now = new Date("2026-07-14T12:00:00.000Z")
    const store = {
      securityEvent: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        findMany: vi.fn().mockResolvedValue([{ id: "security-event-1" }]),
      },
    }

    await expect(
      cleanupExpiredSecurityEvents({ batchSize: 25, now, store })
    ).resolves.toEqual({ securityEventsDeleted: 1 })

    const expiresAt = new Date("2026-04-15T12:00:00.000Z")
    expect(store.securityEvent.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "asc" },
      select: { id: true },
      take: 25,
      where: { createdAt: { lte: expiresAt } },
    })
    expect(store.securityEvent.deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lte: expiresAt }, id: { in: ["security-event-1"] } },
    })
  })

  it("does not delete when the bounded selection is empty", async () => {
    const store = {
      securityEvent: {
        deleteMany: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
    }

    await expect(cleanupExpiredSecurityEvents({ batchSize: 0, store })).resolves.toEqual({
      securityEventsDeleted: 0,
    })
    expect(store.securityEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: DEFAULT_SECURITY_EVENT_CLEANUP_BATCH_SIZE })
    )
    expect(store.securityEvent.deleteMany).not.toHaveBeenCalled()
  })
})

import { describe, expect, it, vi } from "vitest"

import {
  ChatLegalHoldError,
  createChatLegalHold,
  listActiveChatLegalHolds,
  parseChatLegalHoldUpdateInput,
  parseCreateChatLegalHoldInput,
  updateChatLegalHold,
} from "./legal-holds"

const now = new Date("2026-07-14T12:00:00.000Z")
const identity = { role: "ADMIN" as const, userId: "admin-1" }

function hold() {
  return {
    authorizedByUserId: "admin-1",
    createdAt: now,
    id: "hold-1",
    reason: "Authorized safety investigation",
    releasedAt: null,
    reviewAt: new Date("2026-08-01T12:00:00.000Z"),
    startedAt: now,
    subjectId: "report-1",
    subjectType: "CHAT_REPORT" as const,
  }
}

function createStore() {
  return {
    chatAuditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
    chatLegalHold: {
      create: vi.fn().mockResolvedValue(hold()),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([hold()]),
      findUnique: vi.fn().mockResolvedValue(hold()),
      update: vi.fn().mockResolvedValue({ ...hold(), releasedAt: now }),
    },
  }
}

describe("chat legal holds", () => {
  it("requires a future review within 90 days", () => {
    expect(() =>
      parseCreateChatLegalHoldInput(
        {
          reason: "Authorized safety investigation",
          reviewAt: "2026-10-13T12:00:00.000Z",
          subjectId: "report-1",
          subjectType: "CHAT_REPORT",
        },
        now
      )
    ).toThrow(ChatLegalHoldError)

    expect(
      parseChatLegalHoldUpdateInput(
        { action: "review", reviewAt: "2026-08-01T12:00:00.000Z" },
        now
      )
    ).toMatchObject({ action: "review" })
    expect(parseChatLegalHoldUpdateInput({ action: "review" }, now)).toEqual({ action: "review" })
  })

  it("creates a scoped hold and writes a content-free audit record", async () => {
    const store = createStore()
    const input = parseCreateChatLegalHoldInput(
      {
        reason: "Authorized safety investigation",
        reviewAt: "2026-08-01T12:00:00.000Z",
        subjectId: "report-1",
        subjectType: "CHAT_REPORT",
      },
      now
    )

    await expect(createChatLegalHold({ identity, input, store: store as never })).resolves.toMatchObject({
      id: "hold-1",
    })
    expect(store.chatAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "CHAT_LEGAL_HOLD_CREATED",
        metadata: expect.objectContaining({ holdId: "hold-1", subjectId: "report-1" }),
      }),
    })
    expect(store.chatAuditLog.create.mock.calls[0][0].data).not.toHaveProperty("reason")
  })

  it("does not permit a non-admin to create or inspect a hold", async () => {
    const store = createStore()
    const input = parseCreateChatLegalHoldInput(
      {
        reason: "Authorized safety investigation",
        reviewAt: "2026-08-01T12:00:00.000Z",
        subjectId: "report-1",
        subjectType: "CHAT_REPORT",
      },
      now
    )

    await expect(
      createChatLegalHold({ identity: { role: "USER", userId: "user-1" }, input, store: store as never })
    ).rejects.toMatchObject({ code: "forbidden" })
    await expect(
      listActiveChatLegalHolds({ identity: { role: "USER", userId: "user-1" }, store: store as never })
    ).rejects.toMatchObject({ code: "forbidden" })
  })

  it("marks due holds and releases them through an audited operator action", async () => {
    const store = createStore()
    vi.mocked(store.chatLegalHold.findMany).mockResolvedValueOnce([
      { ...hold(), reviewAt: new Date("2026-07-13T12:00:00.000Z") },
    ])

    await expect(listActiveChatLegalHolds({ identity, now, store: store as never })).resolves.toMatchObject([
      { id: "hold-1", reviewDue: true },
    ])
    await expect(
      updateChatLegalHold({
        holdId: "hold-1",
        identity,
        input: { action: "release" },
        now,
        store: store as never,
      })
    ).resolves.toMatchObject({ id: "hold-1", releasedAt: now })
    expect(store.chatAuditLog.create).toHaveBeenLastCalledWith({
      data: expect.objectContaining({ action: "CHAT_LEGAL_HOLD_RELEASED" }),
    })
  })

  it("uses the bounded default review period when an administrator completes a review", async () => {
    const store = createStore()

    await updateChatLegalHold({
      holdId: "hold-1",
      identity,
      input: { action: "review" },
      now,
      store: store as never,
    })

    expect(store.chatLegalHold.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { reviewAt: new Date("2026-10-11T12:00:00.000Z") },
      })
    )
  })
})

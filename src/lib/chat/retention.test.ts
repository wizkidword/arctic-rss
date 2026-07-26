import { describe, expect, it, vi } from "vitest"

import type { ChatRetentionStore } from "./retention"
import { getChatRetentionSettings, purgeExpiredChatRecords } from "./retention"

const now = new Date("2026-07-14T12:00:00.000Z")

type Candidate = { eligibleAt: Date; id: string; roomId?: string; userId?: string }

function queryText(query: unknown) {
  const sql = query as { strings?: TemplateStringsArray }
  return sql.strings?.join(" ") ?? ""
}

function createStore({
  locked = true,
  messages = [{ eligibleAt: new Date("2026-04-01T12:00:00.000Z"), id: "message-1" }],
}: {
  locked?: boolean
  messages?: Candidate[]
} = {}) {
  const candidates = {
    auditLogs: [{ eligibleAt: new Date("2024-07-01T12:00:00.000Z"), id: "audit-1" }],
    deletionRecords: [{ eligibleAt: new Date("2024-07-02T12:00:00.000Z"), id: "deletion-1" }],
    memberships: [
      {
        eligibleAt: new Date("2026-06-01T12:00:00.000Z"),
        id: "membership-1",
        roomId: "room-1",
        userId: "user-1",
      },
      {
        eligibleAt: new Date("2026-06-02T12:00:00.000Z"),
        id: "membership-2",
        roomId: "room-1",
        userId: "user-2",
      },
    ],
    messages: [...messages],
    reports: [{ eligibleAt: new Date("2025-07-01T12:00:00.000Z"), id: "report-1" }],
  }
  const nextCandidates = (kind: keyof typeof candidates) => {
    const candidate = candidates[kind].shift()
    return candidate ? [candidate] : []
  }
  const queryRaw = vi.fn(async (query: unknown) => {
    const text = queryText(query)

    if (text.includes("pg_try_advisory_xact_lock")) {
      return [{ locked }]
    }

    if (text.includes('"ChatMessage"')) {
      return nextCandidates("messages")
    }

    if (text.includes('"ChatReport"')) {
      return nextCandidates("reports")
    }

    if (text.includes('"ChatAuditLog"')) {
      return nextCandidates("auditLogs")
    }

    if (text.includes('"AccountDeletionRecord"')) {
      return nextCandidates("deletionRecords")
    }

    if (text.includes('"ChatRoomMember"')) {
      return nextCandidates("memberships")
    }

    return []
  })
  const reportFindMany = vi.fn().mockResolvedValue([
    { reporterUserId: null, roomId: "room-1", targetUserId: "user-2" },
  ])
  const baseStore = {
    accountDeletionRecord: {
      count: vi.fn().mockResolvedValue(1),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    chatAuditLog: {
      count: vi.fn().mockResolvedValue(1),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    chatLegalHold: {
      count: vi.fn().mockResolvedValue(1),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    chatMessage: {
      count: vi.fn().mockResolvedValue(messages.length),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    chatReport: {
      count: vi.fn().mockResolvedValue(1),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: reportFindMany,
    },
    chatRoomMember: {
      count: vi.fn().mockResolvedValue(2),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    $executeRaw: vi.fn().mockResolvedValue(0),
    $queryRaw: queryRaw,
  }
  const transaction = vi.fn(async (work) => work(baseStore))

  return {
    ...baseStore,
    $transaction: transaction,
  } as unknown as ChatRetentionStore
}

describe("chat retention", () => {
  it("orders each retention class by its eligibility time, loops bounded batches, and records a cursor", async () => {
    const store = createStore({
      messages: [
        { eligibleAt: new Date("2026-04-01T12:00:00.000Z"), id: "message-1" },
        { eligibleAt: new Date("2026-04-02T12:00:00.000Z"), id: "message-2" },
      ],
    })

    await expect(
      purgeExpiredChatRecords({ batchSize: 1, maxBatches: 1, now, store })
    ).resolves.toMatchObject({
      batches: 1,
      continuation: {
        messages: { eligibleAt: "2026-04-01T12:00:00.000Z", id: "message-1" },
      },
      eligible: {
        auditLogs: 1,
        deletionRecords: 1,
        memberships: 2,
        messages: 2,
        reports: 1,
      },
      holdSkips: 0,
      legalHoldReviewsDue: 1,
      oldestEligibleAt: "2024-07-01T12:00:00.000Z",
      protectedMembershipSkips: 0,
      purgedMessages: 1,
      skipped: false,
      workBudgetExhausted: true,
    })

    expect(store.chatMessage.deleteMany).toHaveBeenCalledWith({ where: { id: "message-1" } })
    expect(store.chatRoomMember.deleteMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["membership-1"] },
        leftAt: { lte: new Date("2026-06-14T12:00:00.000Z") },
        status: "LEFT",
      },
    })
    expect(store.$queryRaw).toHaveBeenCalledWith(
      expect.objectContaining({ strings: expect.arrayContaining([expect.stringContaining("eligibleAt")]) })
    )
  })

  it("rechecks a matching hold inside the shared advisory-lock transaction before deleting", async () => {
    const store = createStore()
    const findFirst = store.chatLegalHold.findFirst as unknown as {
      mockImplementation: (
        implementation: (args: { where: { subjectType: string } }) => Promise<{ id: string } | null>
      ) => void
    }
    findFirst.mockImplementation(({ where }) =>
      Promise.resolve(where.subjectType === "CHAT_MESSAGE" ? { id: "hold-1" } : null)
    )

    await expect(
      purgeExpiredChatRecords({ batchSize: 25, maxBatches: 1, now, store })
    ).resolves.toMatchObject({ holdSkips: 1, purgedMessages: 0 })

    expect(store.chatMessage.deleteMany).not.toHaveBeenCalled()
    expect(store.chatLegalHold.findFirst).toHaveBeenCalledWith({
      select: { id: true },
      where: { releasedAt: null, subjectId: "message-1", subjectType: "CHAT_MESSAGE" },
    })
    expect(store.$executeRaw).toHaveBeenCalled()
  })

  it("returns a harmless skipped summary when another worker owns the singleton lock", async () => {
    const store = createStore({ locked: false })

    await expect(purgeExpiredChatRecords({ now, store })).resolves.toMatchObject({
      batches: 0,
      skipped: true,
      workBudgetExhausted: false,
    })
    expect(store.chatMessage.deleteMany).not.toHaveBeenCalled()
  })

  it("bounds invalid retention settings to safe defaults", () => {
    expect(
      getChatRetentionSettings({
        ARCTIC_IRC_RETENTION_BATCH_SIZE: "1001",
        ARCTIC_IRC_RETENTION_MAX_BATCHES: "0",
        ARCTIC_IRC_RETENTION_MAX_RUNTIME_MS: "900",
      })
    ).toMatchObject({ batchSize: 250, maxBatches: 10, maxRuntimeMs: 45_000 })
  })
})

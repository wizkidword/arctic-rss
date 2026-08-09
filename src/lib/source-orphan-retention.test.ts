import { describe, expect, it, vi } from "vitest"

import {
  reportSourceOrphanRetention,
  SOURCE_ORPHAN_GRACE_PERIOD_DAYS,
  SOURCE_ORPHAN_REPORT_VERSION,
  type SourceOrphanRetentionStore,
} from "./source-orphan-retention"

describe("source orphan retention report", () => {
  it("reports protected orphan-source exposure without mutating any records", async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([
        {
          activeChatLegalHolds: BigInt(1),
          aiDigestItems: BigInt(4),
          articleAiSummaries: BigInt(5),
          articleCount: BigInt(7),
          articleStates: BigInt(8),
          auditLogReferences: BigInt(2),
          chatBotDeliveries: BigInt(3),
          chatMessageReferences: BigInt(6),
          chatRoomFeeds: BigInt(1),
          collectionItems: BigInt(9),
          dynamicDirectoryEntries: BigInt(2),
          estimatedStoredBytes: BigInt(12_345),
          oldestOrphanSourceCreatedAt: new Date("2026-01-02T03:04:05.000Z"),
          orphanSourceCount: BigInt(2),
          smartDigestItems: BigInt(6),
          staticDirectoryEntries: BigInt(3),
          storyClusterMembers: BigInt(7),
        },
      ])
      .mockResolvedValueOnce([
        {
          collectionItems: BigInt(2),
          episodeCount: BigInt(11),
          episodeStates: BigInt(12),
          estimatedStoredBytes: BigInt(54_321),
          oldestOrphanSourceCreatedAt: null,
          orphanSourceCount: BigInt(4),
        },
      ])
    const report = await reportSourceOrphanRetention({
      now: new Date("2026-08-08T12:00:00.000Z"),
      store: { $queryRaw: queryRaw } as unknown as SourceOrphanRetentionStore,
    })

    expect(report).toEqual({
      dryRun: true,
      feeds: {
        estimatedStoredBytes: "12345",
        itemCount: 7,
        oldestOrphanSourceCreatedAt: "2026-01-02T03:04:05.000Z",
        orphanSourceCount: 2,
        references: {
          activeChatLegalHolds: 1,
          aiDigestItems: 4,
          articleAiSummaries: 5,
          articleStates: 8,
          auditLogReferences: 2,
          chatBotDeliveries: 3,
          chatMessageReferences: 6,
          chatRoomFeeds: 1,
          collectionItems: 9,
          dynamicDirectoryEntries: 2,
          smartDigestItems: 6,
          staticDirectoryEntries: 3,
          storyClusterMembers: 7,
        },
      },
      generatedAt: "2026-08-08T12:00:00.000Z",
      podcasts: {
        estimatedStoredBytes: "54321",
        itemCount: 11,
        oldestOrphanSourceCreatedAt: null,
        orphanSourceCount: 4,
        references: { collectionItems: 2, episodeStates: 12 },
      },
      policy: {
        destructivePurgeEnabled: false,
        gracePeriodDays: SOURCE_ORPHAN_GRACE_PERIOD_DAYS,
        purgeRequiresSeparateOwnerApproval: true,
      },
      schemaVersion: SOURCE_ORPHAN_REPORT_VERSION,
    })
    expect(queryRaw).toHaveBeenCalledTimes(2)
  })

  it("rejects malformed aggregate results instead of reporting unsafe data", async () => {
    const queryRaw = vi.fn().mockResolvedValue([])

    await expect(
      reportSourceOrphanRetention({
        store: { $queryRaw: queryRaw } as unknown as SourceOrphanRetentionStore,
      })
    ).rejects.toThrow("Expected exactly one feed orphan-retention report row")
  })
})

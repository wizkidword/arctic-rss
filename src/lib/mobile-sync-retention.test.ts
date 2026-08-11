import { describe, expect, it, vi } from "vitest"

import type { MobileSyncRetentionStore } from "./mobile-sync-retention"
import {
  getMobileSyncRetentionSettings,
  pruneMobileSyncEvents,
} from "./mobile-sync-retention"

const now = new Date("2026-08-11T12:00:00.000Z")

function createStore({
  candidates = [
    { sequence: BigInt(12), userId: "user-a" },
    { sequence: BigInt(15), userId: "user-a" },
    { sequence: BigInt(21), userId: "user-b" },
  ],
  remainingUsers = BigInt(1),
}: {
  candidates?: Array<{ sequence: bigint; userId: string }>
  remainingUsers?: bigint
} = {}) {
  const transaction = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    $queryRaw: vi.fn().mockResolvedValue([{ count: remainingUsers }]),
    userSyncEvent: {
      aggregate: vi.fn().mockResolvedValue({
        _min: { occurredAt: new Date("2026-08-10T11:00:00.000Z") },
      }),
      count: vi.fn().mockResolvedValue(42),
      deleteMany: vi.fn().mockImplementation(({ where }) => ({
        count: where.sequence.in.length,
      })),
      findMany: vi.fn().mockImplementation(({ take }) => candidates.slice(0, take)),
    },
    mobileDevice: {
      count: vi.fn().mockResolvedValue(3),
    },
  }
  const store = {
    ...transaction,
    $transaction: vi.fn(async (callback) => callback(transaction)),
  } as unknown as MobileSyncRetentionStore

  return { store, transaction }
}

describe("mobile sync retention", () => {
  it("deletes one bounded expired page and advances the affected cursor floor", async () => {
    const { store, transaction } = createStore()

    const result = await pruneMobileSyncEvents({
      batchSize: 2,
      now,
      store,
    })

    expect(transaction.userSyncEvent.findMany).toHaveBeenCalledWith({
      orderBy: [{ occurredAt: "asc" }, { sequence: "asc" }],
      select: { sequence: true, userId: true },
      take: 2,
      where: { occurredAt: { lt: new Date("2026-02-12T12:00:00.000Z") } },
    })
    expect(transaction.userSyncEvent.deleteMany).toHaveBeenCalledWith({
      where: {
        occurredAt: { lt: new Date("2026-02-12T12:00:00.000Z") },
        sequence: { in: [BigInt(12), BigInt(15)] },
      },
    })
    expect(transaction.$executeRaw).toHaveBeenCalledTimes(2)
    expect(result).toEqual({
      activeStableDeviceCount: 3,
      cutoffAt: "2026-02-12T12:00:00.000Z",
      moreEligible: true,
      oldestRetainedEventAgeMs: 90_000_000,
      oldestRetainedEventAt: "2026-08-10T11:00:00.000Z",
      retainedEvents: 42,
      rowsPruned: 2,
      usersRequiringPruning: 1,
    })
  })

  it("reports an empty resumable pass without changing a cursor floor", async () => {
    const { store, transaction } = createStore({
      candidates: [],
      remainingUsers: BigInt(0),
    })

    await expect(pruneMobileSyncEvents({ now, store })).resolves.toMatchObject({
      moreEligible: false,
      rowsPruned: 0,
      usersRequiringPruning: 0,
    })
    expect(transaction.userSyncEvent.deleteMany).not.toHaveBeenCalled()
    expect(transaction.$executeRaw).toHaveBeenCalledOnce()
  })

  it("clamps worker retention configuration", () => {
    expect(
      getMobileSyncRetentionSettings({
        MOBILE_SYNC_RETENTION_BATCH_SIZE: "5000",
        MOBILE_SYNC_RETENTION_INTERVAL_MS: "10",
      })
    ).toEqual({
      batchSize: 1_000,
      intervalMs: 60 * 60_000,
    })
  })
})

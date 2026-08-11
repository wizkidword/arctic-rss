import { Prisma, type PrismaClient } from "@/generated/prisma/client"

import { getPrisma } from "@/lib/db"
import { readClampedPositiveInteger } from "@/lib/refresh-schedule"

import { MOBILE_SYNC_RETENTION_DAYS } from "./mobile-sync"

export const DEFAULT_MOBILE_SYNC_RETENTION_BATCH_SIZE = 250
export const DEFAULT_MOBILE_SYNC_RETENTION_INTERVAL_MS = 6 * 60 * 60_000
export const MOBILE_SYNC_RETENTION_STATEMENT_TIMEOUT_MS = 5_000

const MAX_MOBILE_SYNC_RETENTION_BATCH_SIZE = 1_000
const MIN_MOBILE_SYNC_RETENTION_INTERVAL_MS = 60 * 60_000
const MAX_MOBILE_SYNC_RETENTION_INTERVAL_MS = 24 * 60 * 60_000

type MobileSyncRetentionDatabase = Pick<
  PrismaClient,
  "$executeRaw" | "$queryRaw" | "userSyncEvent"
>

export type MobileSyncRetentionStore = MobileSyncRetentionDatabase &
  Pick<PrismaClient, "$transaction">

export type MobileSyncRetentionSummary = {
  cutoffAt: string
  moreEligible: boolean
  oldestRetainedEventAgeMs: number | null
  oldestRetainedEventAt: string | null
  retainedEvents: number
  rowsPruned: number
  usersRequiringPruning: number
}

export function getMobileSyncRetentionSettings(
  environment: Readonly<Record<string, string | undefined>> = process.env
) {
  return {
    batchSize: readClampedPositiveInteger({
      fallback: DEFAULT_MOBILE_SYNC_RETENTION_BATCH_SIZE,
      maximum: MAX_MOBILE_SYNC_RETENTION_BATCH_SIZE,
      minimum: 1,
      value: environment.MOBILE_SYNC_RETENTION_BATCH_SIZE,
    }),
    intervalMs: readClampedPositiveInteger({
      fallback: DEFAULT_MOBILE_SYNC_RETENTION_INTERVAL_MS,
      maximum: MAX_MOBILE_SYNC_RETENTION_INTERVAL_MS,
      minimum: MIN_MOBILE_SYNC_RETENTION_INTERVAL_MS,
      value: environment.MOBILE_SYNC_RETENTION_INTERVAL_MS,
    }),
  }
}

/**
 * Deletes one small page of expired journal events. The cursor floor advances
 * in the same transaction, so a retry can never expose an incomplete delta.
 * The worker's Redis lease serializes normal runs; the floor SQL is also
 * monotonic if an operator must resume the job manually.
 */
export async function pruneMobileSyncEvents({
  batchSize = DEFAULT_MOBILE_SYNC_RETENTION_BATCH_SIZE,
  now = new Date(),
  store = getPrisma() as MobileSyncRetentionStore,
}: {
  batchSize?: number
  now?: Date
  store?: MobileSyncRetentionStore
} = {}): Promise<MobileSyncRetentionSummary> {
  const cutoff = new Date(
    now.getTime() - MOBILE_SYNC_RETENTION_DAYS * 24 * 60 * 60 * 1_000
  )
  const take = getBatchSize(batchSize)

  return store.$transaction(
    async (transaction) => {
      const retentionStore = transaction as unknown as MobileSyncRetentionDatabase
      await retentionStore.$executeRaw(Prisma.sql`
        SELECT set_config(
          'statement_timeout',
          ${String(MOBILE_SYNC_RETENTION_STATEMENT_TIMEOUT_MS)},
          true
        )
      `)

      const candidates = await retentionStore.userSyncEvent.findMany({
        orderBy: [{ occurredAt: "asc" }, { sequence: "asc" }],
        select: { sequence: true, userId: true },
        take,
        where: { occurredAt: { lt: cutoff } },
      })

      if (candidates.length) {
        const deleted = await retentionStore.userSyncEvent.deleteMany({
          where: {
            occurredAt: { lt: cutoff },
            sequence: { in: candidates.map((event) => event.sequence) },
          },
        })

        for (const [userId, minimumSequence] of floorsFor(candidates)) {
          await retentionStore.$executeRaw(Prisma.sql`
            INSERT INTO "UserSyncCursorFloor" (
              "userId", "minimumSequence", "updatedAt"
            ) VALUES (
              ${userId}, ${minimumSequence}, CURRENT_TIMESTAMP
            )
            ON CONFLICT ("userId") DO UPDATE
            SET
              "minimumSequence" = GREATEST(
                "UserSyncCursorFloor"."minimumSequence",
                EXCLUDED."minimumSequence"
              ),
              "updatedAt" = CURRENT_TIMESTAMP
          `)
        }

        return retentionSummary({
          cutoff,
          now,
          oldest: await retentionStore.userSyncEvent.aggregate({
            _min: { occurredAt: true },
          }),
          remainingUsers: await retentionStore.$queryRaw<
            Array<{ count: bigint }>
          >(Prisma.sql`
            SELECT COUNT(DISTINCT "userId")::bigint AS "count"
            FROM "UserSyncEvent"
            WHERE "occurredAt" < ${cutoff}
          `),
          retainedEvents: await retentionStore.userSyncEvent.count(),
          rowsPruned: deleted.count,
        })
      }

      return retentionSummary({
        cutoff,
        now,
        oldest: await retentionStore.userSyncEvent.aggregate({
          _min: { occurredAt: true },
        }),
        remainingUsers: await retentionStore.$queryRaw<Array<{ count: bigint }>>(
          Prisma.sql`
            SELECT COUNT(DISTINCT "userId")::bigint AS "count"
            FROM "UserSyncEvent"
            WHERE "occurredAt" < ${cutoff}
          `
        ),
        retainedEvents: await retentionStore.userSyncEvent.count(),
        rowsPruned: 0,
      })
    },
    {
      maxWait: MOBILE_SYNC_RETENTION_STATEMENT_TIMEOUT_MS,
      timeout: MOBILE_SYNC_RETENTION_STATEMENT_TIMEOUT_MS + 2_000,
    }
  )
}

function floorsFor(events: Array<{ sequence: bigint; userId: string }>) {
  const floors = new Map<string, bigint>()

  for (const event of events) {
    const minimumSequence = event.sequence + BigInt(1)
    const current = floors.get(event.userId)
    if (!current || minimumSequence > current) {
      floors.set(event.userId, minimumSequence)
    }
  }

  return floors
}

function getBatchSize(value: number) {
  if (!Number.isInteger(value) || value < 1) {
    return DEFAULT_MOBILE_SYNC_RETENTION_BATCH_SIZE
  }

  return Math.min(value, MAX_MOBILE_SYNC_RETENTION_BATCH_SIZE)
}

function numberFromCount(value: bigint | undefined) {
  if (value === undefined) {
    return 0
  }

  return Number(value)
}

function retentionSummary({
  cutoff,
  now,
  oldest,
  remainingUsers,
  retainedEvents,
  rowsPruned,
}: {
  cutoff: Date
  now: Date
  oldest: { _min: { occurredAt: Date | null } }
  remainingUsers: Array<{ count: bigint }>
  retainedEvents: number
  rowsPruned: number
}): MobileSyncRetentionSummary {
  const usersRequiringPruning = numberFromCount(remainingUsers[0]?.count)
  const oldestRetainedEventAt = oldest._min.occurredAt ?? null

  return {
    cutoffAt: cutoff.toISOString(),
    moreEligible: usersRequiringPruning > 0,
    oldestRetainedEventAgeMs: oldestRetainedEventAt
      ? Math.max(0, now.getTime() - oldestRetainedEventAt.getTime())
      : null,
    oldestRetainedEventAt: oldestRetainedEventAt?.toISOString() ?? null,
    retainedEvents,
    rowsPruned,
    usersRequiringPruning,
  }
}

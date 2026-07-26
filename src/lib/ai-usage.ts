import { randomUUID } from "node:crypto"

const RESERVED_UNITS_PER_OPERATION = 1

export const AI_USAGE_PERIOD_TIMEZONE = "UTC"
export const AI_OPERATION_LEASE_DURATION_MS = 60_000

export type AiUsageAction = "ARTICLE_SUMMARY" | "DAILY_DIGEST"
export type AiOperationStatus =
  "RESERVED" | "PROCESSING" | "COMPLETED" | "FAILED"

export type AiOperationRecord = {
  action: AiUsageAction
  attempt: number
  completedAt: Date | null
  consumedUnits: number
  errorCode: string | null
  id: string
  idempotencyKey: string
  lastHeartbeatAt: Date | null
  leaseExpiresAt: Date | null
  leaseOwner: string | null
  model: string | null
  periodId: string | null
  provider: string | null
  providerRequestId: string | null
  reservedUnits: number
  retryableAt: Date | null
  status: AiOperationStatus
  userId: string
}

export type AiOperationLease = {
  attempt: number
  owner: string
}

type AiUsagePeriodReservation = {
  id: string
}

type ReleasedOperation = {
  periodId: string | null
  reservedUnits: number
}

export type AiUsageLedgerStore = {
  $queryRaw<T>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>
  $transaction<T>(
    callback: (transaction: AiUsageLedgerStore) => Promise<T>,
  ): Promise<T>
  aiOperation: {
    create(args: {
      data: {
        action: AiUsageAction
        idempotencyKey: string
        model: string
        provider: string
        reservedUnits: number
        status: AiOperationStatus
        userId: string
      }
    }): Promise<AiOperationRecord>
    findUnique(args: {
      where: {
        id?: string
        idempotencyKey?: string
      }
    }): Promise<AiOperationRecord | null>
    findMany(args: Record<string, unknown>): Promise<AiOperationRecord[]>
    update(args: {
      data: Record<string, unknown>
      where: {
        id: string
      }
    }): Promise<AiOperationRecord>
    updateMany(args: {
      data: Record<string, unknown>
      where: Record<string, unknown>
    }): Promise<{
      count: number
    }>
  }
  user: {
    findUnique(args: {
      select: {
        aiMonthlyLimit: true
      }
      where: {
        id: string
      }
    }): Promise<{
      aiMonthlyLimit: number
      aiMonthlyUsed?: number
    } | null>
    update(args: Record<string, unknown>): Promise<unknown>
  }
}

export type AiUsageReservation = {
  created: boolean
  operation: AiOperationRecord
}

export class AiUsageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AiUsageError"
  }
}

/**
 * Billing periods start at 00:00 UTC on the first day of each month. Keeping
 * the timezone fixed makes a user's allowance predictable across web and
 * worker processes, regardless of the server's local timezone.
 */
export function getAiUsagePeriodStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

/**
 * Creates one durable, idempotent reservation before an AI provider request.
 * The SQL upsert changes the allowance only when the period still has capacity,
 * so concurrent requests cannot reserve more than the plan limit.
 */
export async function reserveAiUsageOperation({
  action,
  idempotencyKey,
  model,
  now = new Date(),
  provider,
  store,
  userId,
}: {
  action: AiUsageAction
  idempotencyKey: string
  model: string
  now?: Date
  provider: string
  store: AiUsageLedgerStore
  userId: string
}): Promise<AiUsageReservation> {
  try {
    return await store.$transaction(async (transaction) => {
      const user = await transaction.user.findUnique({
        select: {
          aiMonthlyLimit: true,
        },
        where: {
          id: userId,
        },
      })

      if (!user) {
        throw new AiUsageError("User not found.")
      }

      // This insert happens before the allowance reservation. A duplicate key
      // therefore fails before it can reserve another unit.
      const operation = await transaction.aiOperation.create({
        data: {
          action,
          idempotencyKey,
          model,
          provider,
          reservedUnits: 0,
          status: "RESERVED",
          userId,
        },
      })
      const periodStart = getAiUsagePeriodStart(now)
      const periodRows = await transaction.$queryRaw<
        AiUsagePeriodReservation[]
      >`
        INSERT INTO "AiUsagePeriod" (
          "id",
          "userId",
          "periodStart",
          "limitUnits",
          "reservedUnits",
          "consumedUnits",
          "createdAt",
          "updatedAt"
        )
        SELECT
          ${`${operation.id}:period`},
          ${userId},
          ${periodStart},
          ${Math.max(0, user.aiMonthlyLimit)},
          ${RESERVED_UNITS_PER_OPERATION},
          0,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        WHERE ${RESERVED_UNITS_PER_OPERATION} <= ${Math.max(0, user.aiMonthlyLimit)}
        ON CONFLICT ("userId", "periodStart") DO UPDATE
        SET
          "reservedUnits" = "AiUsagePeriod"."reservedUnits" + ${RESERVED_UNITS_PER_OPERATION},
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE
          "AiUsagePeriod"."reservedUnits" + "AiUsagePeriod"."consumedUnits" + ${RESERVED_UNITS_PER_OPERATION}
          <= "AiUsagePeriod"."limitUnits"
        RETURNING "id"
      `

      const period = periodRows[0]

      if (!period) {
        const failed = await transaction.aiOperation.update({
          data: {
            errorCode: "MONTHLY_LIMIT_REACHED",
            reservedUnits: 0,
            status: "FAILED",
          },
          where: {
            id: operation.id,
          },
        })

        return {
          created: true,
          operation: failed,
        }
      }

      const reserved = await transaction.aiOperation.update({
        data: {
          periodId: period.id,
          reservedUnits: RESERVED_UNITS_PER_OPERATION,
          status: "RESERVED",
        },
        where: {
          id: operation.id,
        },
      })

      return {
        created: true,
        operation: reserved,
      }
    })
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error
    }

    const existing = await store.aiOperation.findUnique({
      where: {
        idempotencyKey,
      },
    })

    if (!existing) {
      throw new AiUsageError("AI operation could not be reserved.")
    }

    if (
      existing.status === "FAILED" &&
      existing.reservedUnits === 0 &&
      existing.retryableAt &&
      existing.retryableAt <= now
    ) {
      return retryAiUsageOperation({
        now,
        operation: existing,
        store,
      })
    }

    return {
      created: false,
      operation: existing,
    }
  }
}

/**
 * Atomically takes ownership of an operation that has never been leased or
 * whose previous lease expired. The incremented attempt becomes the fencing
 * token used by renew, complete, and fail so a superseded worker cannot write.
 */
export async function claimAiUsageOperation({
  leaseDurationMs = AI_OPERATION_LEASE_DURATION_MS,
  leaseOwner = createAiOperationLeaseOwner(),
  now = new Date(),
  operationId,
  store,
}: {
  leaseDurationMs?: number
  leaseOwner?: string
  now?: Date
  operationId: string
  store: AiUsageLedgerStore
}) {
  const claimed = await store.aiOperation.updateMany({
    data: {
      attempt: {
        increment: 1,
      },
      lastHeartbeatAt: now,
      leaseExpiresAt: addMilliseconds(now, leaseDurationMs),
      leaseOwner,
      retryableAt: null,
      status: "PROCESSING",
    },
    where: leaseClaimWhere({ now, operationId }),
  })

  if (claimed.count !== 1) {
    return null
  }

  const operation = await store.aiOperation.findUnique({
    where: {
      id: operationId,
    },
  })

  if (!operation || operation.leaseOwner !== leaseOwner) {
    throw new AiUsageError("AI operation lease could not be claimed.")
  }

  return {
    lease: {
      attempt: operation.attempt,
      owner: leaseOwner,
    },
    operation,
  }
}

/** Renews a lease only when the current worker still owns its fencing token. */
export async function renewAiUsageOperationLease({
  lease,
  leaseDurationMs = AI_OPERATION_LEASE_DURATION_MS,
  now = new Date(),
  operationId,
  store,
}: {
  lease: AiOperationLease
  leaseDurationMs?: number
  now?: Date
  operationId: string
  store: AiUsageLedgerStore
}) {
  const renewed = await store.aiOperation.updateMany({
    data: {
      lastHeartbeatAt: now,
      leaseExpiresAt: addMilliseconds(now, leaseDurationMs),
    },
    where: {
      attempt: lease.attempt,
      id: operationId,
      leaseExpiresAt: {
        gt: now,
      },
      leaseOwner: lease.owner,
      status: "PROCESSING",
    },
  })

  return renewed.count === 1
}

/**
 * Keeps a provider call fenced while it is in flight. Finalization still
 * verifies ownership, so a failed heartbeat can never let a stale worker
 * commit a result.
 */
export async function runWithAiOperationLeaseHeartbeat<Result>({
  lease,
  leaseDurationMs = AI_OPERATION_LEASE_DURATION_MS,
  operationId,
  store,
  work,
}: {
  lease: AiOperationLease
  leaseDurationMs?: number
  operationId: string
  store: AiUsageLedgerStore
  work: () => Promise<Result>
}) {
  const heartbeat = setInterval(() => {
    renewAiUsageOperationLease({
      lease,
      leaseDurationMs,
      operationId,
      store,
    }).catch(() => undefined)
  }, Math.max(1_000, Math.floor(leaseDurationMs / 2)))

  heartbeat.unref?.()

  try {
    return await work()
  } finally {
    clearInterval(heartbeat)
  }
}

/**
 * Compatibility wrapper for callers that only need a fresh lease. New
 * provider paths retain the returned lease and pass it to finalization.
 */
export async function markAiUsageOperationProcessing({
  operationId,
  store,
}: {
  operationId: string
  store: AiUsageLedgerStore
}) {
  const claimed = await claimAiUsageOperation({ operationId, store })

  if (!claimed) {
    throw new AiUsageError("AI operation is already owned by another worker.")
  }

  return claimed.operation
}

/** Converts a reservation into a completed, consumed allowance unit. */
export async function completeAiUsageOperation({
  lease,
  now = new Date(),
  operationId,
  providerRequestId = null,
  store,
  transaction,
}: {
  lease?: AiOperationLease
  now?: Date
  operationId: string
  providerRequestId?: string | null
  store: AiUsageLedgerStore
  transaction?: AiUsageLedgerStore
}) {
  const complete = async (client: AiUsageLedgerStore) => {
    if (
      lease &&
      !(await holdAiOperationLeaseForFinalization({
        lease,
        now,
        operationId,
        store: client,
      }))
    ) {
      throw new AiUsageError("AI operation lease is no longer owned by this worker.")
    }

    const operation = await client.aiOperation.findUnique({
      where: {
        id: operationId,
      },
    })

    if (!operation) {
      throw new AiUsageError("AI operation not found.")
    }

    if (operation.status === "COMPLETED") {
      return operation
    }

    if (
      (operation.status !== "RESERVED" && operation.status !== "PROCESSING") ||
      !operation.periodId ||
      operation.reservedUnits < RESERVED_UNITS_PER_OPERATION
    ) {
      throw new AiUsageError("AI operation is not eligible for completion.")
    }

    const periods = await client.$queryRaw<AiUsagePeriodReservation[]>`
      UPDATE "AiUsagePeriod"
      SET
        "reservedUnits" = "reservedUnits" - ${operation.reservedUnits},
        "consumedUnits" = "consumedUnits" + ${RESERVED_UNITS_PER_OPERATION},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE
        "id" = ${operation.periodId}
        AND "reservedUnits" >= ${operation.reservedUnits}
      RETURNING "id"
    `

    if (!periods[0]) {
      throw new AiUsageError("AI allowance reservation could not be completed.")
    }

    return client.aiOperation.update({
      data: {
        completedAt: new Date(),
        consumedUnits: RESERVED_UNITS_PER_OPERATION,
        lastHeartbeatAt: now,
        leaseExpiresAt: null,
        leaseOwner: null,
        providerRequestId,
        reservedUnits: 0,
        retryableAt: null,
        status: "COMPLETED",
      },
      where: {
        id: operation.id,
      },
    })
  }

  return transaction ? complete(transaction) : store.$transaction(complete)
}

/** Releases a reservation after a failed request without counting it as usage. */
export async function failAiUsageOperation({
  errorCode,
  lease,
  now = new Date(),
  operationId,
  retryableAt = null,
  store,
  transaction,
}: {
  errorCode: string
  lease?: AiOperationLease
  now?: Date
  operationId: string
  retryableAt?: Date | null
  store: AiUsageLedgerStore
  transaction?: AiUsageLedgerStore
}) {
  const fail = async (client: AiUsageLedgerStore) => {
    if (
      lease &&
      !(await holdAiOperationLeaseForFinalization({
        allowExpiredLease: true,
        lease,
        now,
        operationId,
        store: client,
      }))
    ) {
      return false
    }

    const released = await client.$queryRaw<ReleasedOperation[]>`
      WITH operation_to_release AS (
        SELECT "id", "periodId", "reservedUnits"
        FROM "AiOperation"
        WHERE
          "id" = ${operationId}
          AND "status" IN ('RESERVED', 'PROCESSING')
        FOR UPDATE
      )
      UPDATE "AiOperation"
      SET
        "errorCode" = ${errorCode},
        "lastHeartbeatAt" = ${now},
        "leaseExpiresAt" = NULL,
        "leaseOwner" = NULL,
        "reservedUnits" = 0,
        "retryableAt" = ${retryableAt},
        "status" = 'FAILED',
        "updatedAt" = CURRENT_TIMESTAMP
      FROM operation_to_release
      WHERE "AiOperation"."id" = operation_to_release."id"
      RETURNING operation_to_release."periodId", operation_to_release."reservedUnits"
    `

    const operation = released[0]

    if (!operation?.periodId || operation.reservedUnits <= 0) {
      return Boolean(operation)
    }

    await client.$queryRaw<AiUsagePeriodReservation[]>`
      UPDATE "AiUsagePeriod"
      SET
        "reservedUnits" = GREATEST(0, "reservedUnits" - ${operation.reservedUnits}),
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${operation.periodId}
      RETURNING "id"
    `

    return true
  }

  return transaction ? fail(transaction) : store.$transaction(fail)
}

/** Releases expired reservations in bounded, idempotent batches. */
export async function reconcileExpiredAiUsageOperations({
  batchSize = 100,
  now = new Date(),
  store,
}: {
  batchSize?: number
  now?: Date
  store: AiUsageLedgerStore
}) {
  const normalizedBatchSize = Math.max(1, Math.min(500, Math.floor(batchSize)))

  return store.$transaction(async (transaction) => {
    const lock = await transaction.$queryRaw<{ locked: boolean }[]>`
      SELECT pg_try_advisory_xact_lock(hashtext('arctic-rss:ai-operation-reconciliation')) AS "locked"
    `

    if (!lock[0]?.locked) {
      return {
        expired: 0,
        ledgerDivergences: 0,
        released: 0,
        skipped: true,
      }
    }

    return reconcileExpiredAiUsageOperationsWithStore({
      batchSize: normalizedBatchSize,
      now,
      store: transaction,
    })
  })
}

async function reconcileExpiredAiUsageOperationsWithStore({
  batchSize,
  now,
  store,
}: {
  batchSize: number
  now: Date
  store: AiUsageLedgerStore
}) {
  const operations = await store.aiOperation.findMany({
    orderBy: [{ leaseExpiresAt: "asc" }, { id: "asc" }],
    take: batchSize,
    where: {
      leaseExpiresAt: {
        lte: now,
      },
      status: {
        in: ["RESERVED", "PROCESSING"],
      },
    },
  })
  let released = 0

  for (const operation of operations) {
    const claimed = await claimAiUsageOperation({
      leaseOwner: `ai-reconciler:${randomUUID()}`,
      now,
      operationId: operation.id,
      store,
    })

    if (!claimed) {
      continue
    }

    const failed = await failAiUsageOperation({
      errorCode: "LEASE_EXPIRED",
      lease: claimed.lease,
      now,
      operationId: operation.id,
      retryableAt: now,
      store,
      transaction: store,
    })

    if (failed) {
      released += 1
    }
  }

  const divergences = await store.$queryRaw<{ periodId: string }[]>`
    SELECT operation_totals."periodId" AS "periodId"
    FROM (
      SELECT "periodId", COALESCE(SUM("reservedUnits"), 0) AS "reservedUnits"
      FROM "AiOperation"
      WHERE "periodId" IS NOT NULL AND "status" IN ('RESERVED', 'PROCESSING')
      GROUP BY "periodId"
    ) AS operation_totals
    INNER JOIN "AiUsagePeriod" AS periods ON periods."id" = operation_totals."periodId"
    WHERE operation_totals."reservedUnits" <> periods."reservedUnits"
    LIMIT ${batchSize}
  `

  return {
    expired: operations.length,
    ledgerDivergences: divergences.length,
    released,
  }
}

function createAiOperationLeaseOwner() {
  return `ai-worker:${randomUUID()}`
}

function addMilliseconds(now: Date, durationMs: number) {
  return new Date(now.getTime() + Math.max(1, Math.floor(durationMs)))
}

function leaseClaimWhere({ now, operationId }: { now: Date; operationId: string }) {
  return {
    AND: [
      {
        OR: [
          { leaseExpiresAt: null },
          { leaseExpiresAt: { lte: now } },
          { leaseOwner: null },
        ],
      },
      {
        OR: [{ retryableAt: null }, { retryableAt: { lte: now } }],
      },
    ],
    id: operationId,
    status: {
      in: ["RESERVED", "PROCESSING"],
    },
  }
}

async function holdAiOperationLeaseForFinalization({
  allowExpiredLease = false,
  lease,
  now,
  operationId,
  store,
}: {
  allowExpiredLease?: boolean
  lease: AiOperationLease
  now: Date
  operationId: string
  store: AiUsageLedgerStore
}) {
  const where: Record<string, unknown> = {
    attempt: lease.attempt,
    id: operationId,
    leaseOwner: lease.owner,
    status: "PROCESSING",
  }

  if (!allowExpiredLease) {
    where.leaseExpiresAt = {
      gt: now,
    }
  }

  const held = await store.aiOperation.updateMany({
    data: {
      lastHeartbeatAt: now,
      leaseExpiresAt: addMilliseconds(now, AI_OPERATION_LEASE_DURATION_MS),
    },
    where,
  })

  return held.count === 1
}

async function retryAiUsageOperation({
  now,
  operation,
  store,
}: {
  now: Date
  operation: AiOperationRecord
  store: AiUsageLedgerStore
}): Promise<AiUsageReservation> {
  return store.$transaction(async (transaction) => {
    const current = await transaction.aiOperation.findUnique({
      where: {
        id: operation.id,
      },
    })

    if (
      !current ||
      current.status !== "FAILED" ||
      current.reservedUnits !== 0 ||
      !current.retryableAt ||
      current.retryableAt > now
    ) {
      return {
        created: false,
        operation: current ?? operation,
      }
    }

    const user = await transaction.user.findUnique({
      select: {
        aiMonthlyLimit: true,
      },
      where: {
        id: current.userId,
      },
    })

    if (!user) {
      throw new AiUsageError("User not found.")
    }

    const reopened = await transaction.aiOperation.updateMany({
      data: {
        errorCode: null,
        lastHeartbeatAt: null,
        leaseExpiresAt: null,
        leaseOwner: null,
        periodId: null,
        retryableAt: null,
        status: "RESERVED",
      },
      where: {
        id: current.id,
        reservedUnits: 0,
        retryableAt: {
          lte: now,
        },
        status: "FAILED",
      },
    })

    if (reopened.count !== 1) {
      const concurrent = await transaction.aiOperation.findUnique({
        where: {
          id: current.id,
        },
      })

      return {
        created: false,
        operation: concurrent ?? current,
      }
    }

    const periodStart = getAiUsagePeriodStart(now)
    const periodRows = await transaction.$queryRaw<AiUsagePeriodReservation[]>`
      INSERT INTO "AiUsagePeriod" (
        "id",
        "userId",
        "periodStart",
        "limitUnits",
        "reservedUnits",
        "consumedUnits",
        "createdAt",
        "updatedAt"
      )
      SELECT
        ${`${current.id}:period:${current.attempt + 1}`},
        ${current.userId},
        ${periodStart},
        ${Math.max(0, user.aiMonthlyLimit)},
        ${RESERVED_UNITS_PER_OPERATION},
        0,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      WHERE ${RESERVED_UNITS_PER_OPERATION} <= ${Math.max(0, user.aiMonthlyLimit)}
      ON CONFLICT ("userId", "periodStart") DO UPDATE
      SET
        "reservedUnits" = "AiUsagePeriod"."reservedUnits" + ${RESERVED_UNITS_PER_OPERATION},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE
        "AiUsagePeriod"."reservedUnits" + "AiUsagePeriod"."consumedUnits" + ${RESERVED_UNITS_PER_OPERATION}
        <= "AiUsagePeriod"."limitUnits"
      RETURNING "id"
    `

    const period = periodRows[0]
    const retried = await transaction.aiOperation.update({
      data: period
        ? {
            periodId: period.id,
            reservedUnits: RESERVED_UNITS_PER_OPERATION,
            status: "RESERVED",
          }
        : {
            errorCode: "MONTHLY_LIMIT_REACHED",
            reservedUnits: 0,
            status: "FAILED",
          },
      where: {
        id: current.id,
      },
    })

    return {
      created: false,
      operation: retried,
    }
  })
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  )
}

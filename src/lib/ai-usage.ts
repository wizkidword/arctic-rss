const RESERVED_UNITS_PER_OPERATION = 1

export const AI_USAGE_PERIOD_TIMEZONE = "UTC"

export type AiUsageAction = "ARTICLE_SUMMARY" | "DAILY_DIGEST"
export type AiOperationStatus =
  "RESERVED" | "PROCESSING" | "COMPLETED" | "FAILED"

export type AiOperationRecord = {
  action: AiUsageAction
  completedAt: Date | null
  consumedUnits: number
  errorCode: string | null
  id: string
  idempotencyKey: string
  model: string | null
  periodId: string | null
  provider: string | null
  providerRequestId: string | null
  reservedUnits: number
  status: AiOperationStatus
  userId: string
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
    update(args: {
      data: Record<string, unknown>
      where: {
        id: string
      }
    }): Promise<AiOperationRecord>
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

    return {
      created: false,
      operation: existing,
    }
  }
}

/** Marks that the provider request is about to be sent. */
export async function markAiUsageOperationProcessing({
  operationId,
  store,
}: {
  operationId: string
  store: AiUsageLedgerStore
}) {
  return store.aiOperation.update({
    data: {
      status: "PROCESSING",
    },
    where: {
      id: operationId,
    },
  })
}

/** Converts a reservation into a completed, consumed allowance unit. */
export async function completeAiUsageOperation({
  operationId,
  providerRequestId = null,
  store,
  transaction,
}: {
  operationId: string
  providerRequestId?: string | null
  store: AiUsageLedgerStore
  transaction?: AiUsageLedgerStore
}) {
  const complete = async (client: AiUsageLedgerStore) => {
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
        providerRequestId,
        reservedUnits: 0,
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
  operationId,
  store,
}: {
  errorCode: string
  operationId: string
  store: AiUsageLedgerStore
}) {
  return store.$transaction(async (transaction) => {
    const released = await transaction.$queryRaw<ReleasedOperation[]>`
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
        "reservedUnits" = 0,
        "status" = 'FAILED',
        "updatedAt" = CURRENT_TIMESTAMP
      FROM operation_to_release
      WHERE "AiOperation"."id" = operation_to_release."id"
      RETURNING operation_to_release."periodId", operation_to_release."reservedUnits"
    `

    const operation = released[0]

    if (!operation?.periodId || operation.reservedUnits <= 0) {
      return
    }

    await transaction.$queryRaw<AiUsagePeriodReservation[]>`
      UPDATE "AiUsagePeriod"
      SET
        "reservedUnits" = GREATEST(0, "reservedUnits" - ${operation.reservedUnits}),
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${operation.periodId}
      RETURNING "id"
    `
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

import { describe, expect, it } from "vitest"

import {
  claimAiUsageOperation,
  completeAiUsageOperation,
  failAiUsageOperation,
  getAiUsagePeriodStart,
  markAiUsageOperationProcessing,
  reconcileExpiredAiUsageOperations,
  renewAiUsageOperationLease,
  reserveAiUsageOperation,
  type AiOperationRecord,
  type AiUsageLedgerStore,
} from "./ai-usage"

function createLedgerStore(limit = 2) {
  const operationsById = new Map<string, AiOperationRecord>()
  const operationsByKey = new Map<string, AiOperationRecord>()
  const periods = new Map<
    string,
    {
      consumedUnits: number
      id: string
      limitUnits: number
      reservedUnits: number
    }
  >()
  let nextOperation = 1

  const store = {
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = strings.join("?")

      if (query.includes("pg_try_advisory_xact_lock")) {
        return [{ locked: true }]
      }

      if (query.includes('INSERT INTO "AiUsagePeriod"')) {
        const [periodId, userId, periodStart, periodLimit] = values as [
          string,
          string,
          Date,
          number,
        ]
        const key = `${userId}:${periodStart.toISOString()}`
        let period = periods.get(key)

        if (!period) {
          if (periodLimit < 1) {
            return []
          }

          period = {
            consumedUnits: 0,
            id: periodId,
            limitUnits: periodLimit,
            reservedUnits: 0,
          }
          periods.set(key, period)
        }

        if (period.reservedUnits + period.consumedUnits >= period.limitUnits) {
          return []
        }

        period.reservedUnits += 1
        return [{ id: period.id }]
      }

      if (query.includes("operation_to_release")) {
        const operation = operationsById.get(values[0] as string)

        if (
          !operation ||
          (operation.status !== "RESERVED" && operation.status !== "PROCESSING")
        ) {
          return []
        }

        const released = {
          periodId: operation.periodId,
          reservedUnits: operation.reservedUnits,
        }
        operation.errorCode = values[1] as string
        operation.reservedUnits = 0
        operation.status = "FAILED"
        return [released]
      }

      if (query.includes('UPDATE "AiUsagePeriod"')) {
        const periodId = query.includes('"consumedUnits"')
          ? (values[2] as string)
          : (values[1] as string)
        const period = Array.from(periods.values()).find(
          (candidate) => candidate.id === periodId,
        )

        if (!period) {
          return []
        }

        if (query.includes('"consumedUnits"')) {
          const reservedUnits = values[0] as number

          if (period.reservedUnits < reservedUnits) {
            return []
          }

          period.reservedUnits -= reservedUnits
          period.consumedUnits += 1
        } else {
          period.reservedUnits = Math.max(
            0,
            period.reservedUnits - (values[0] as number),
          )
        }

        return [{ id: period.id }]
      }

      return []
    },
    $transaction: async (
      callback: (transaction: AiUsageLedgerStore) => Promise<unknown>,
    ) => callback(store as unknown as AiUsageLedgerStore),
    aiOperation: {
      create: async ({ data }: { data: AiOperationRecord }) => {
        if (operationsByKey.has(data.idempotencyKey)) {
          throw { code: "P2002" }
        }

        const operation: AiOperationRecord = {
          ...data,
          attempt: 0,
          completedAt: null,
          consumedUnits: 0,
          errorCode: null,
          id: `operation-${nextOperation++}`,
          lastHeartbeatAt: null,
          leaseExpiresAt: null,
          leaseOwner: null,
          periodId: null,
          providerRequestId: null,
          reservedUnits: 0,
          retryableAt: null,
        }
        operationsById.set(operation.id, operation)
        operationsByKey.set(operation.idempotencyKey, operation)
        return operation
      },
      findUnique: async ({
        where,
      }: {
        where: { id?: string; idempotencyKey?: string }
      }) =>
        (where.id ? operationsById.get(where.id) : undefined) ??
        (where.idempotencyKey
          ? operationsByKey.get(where.idempotencyKey)
          : undefined) ??
        null,
      findMany: async () => Array.from(operationsById.values()),
      update: async ({
        data,
        where,
      }: {
        data: Record<string, unknown>
        where: { id: string }
      }) => {
        const operation = operationsById.get(where.id)

        if (!operation) {
          throw new Error("Operation not found")
        }

        Object.assign(operation, data)
        return operation
      },
      updateMany: async ({
        data,
        where,
      }: {
        data: Record<string, unknown>
        where: Record<string, unknown>
      }) => {
        const operation = operationsById.get(where.id as string)

        if (!operation || !matchesOperation(operation, where)) {
          return { count: 0 }
        }

        for (const [key, value] of Object.entries(data)) {
          if (
            value &&
            typeof value === "object" &&
            "increment" in value &&
            typeof value.increment === "number"
          ) {
            operation[key as keyof AiOperationRecord] =
              ((operation[key as keyof AiOperationRecord] as number) ?? 0) +
              value.increment as never
          } else {
            operation[key as keyof AiOperationRecord] = value as never
          }
        }

        return { count: 1 }
      },
    },
    user: {
      findUnique: async () => ({
        aiMonthlyLimit: limit,
      }),
      update: async () => ({}),
    },
  }

  return {
    periods,
    store: store as unknown as AiUsageLedgerStore,
  }
}

function matchesOperation(
  operation: AiOperationRecord,
  where: Record<string, unknown>,
): boolean {
  return Object.entries(where).every(([field, expected]) => {
    if (field === "AND") {
      return (expected as Record<string, unknown>[]).every((condition) =>
        matchesOperation(operation, condition),
      )
    }

    if (field === "OR") {
      return (expected as Record<string, unknown>[]).some((condition) =>
        matchesOperation(operation, condition),
      )
    }

    const actual = operation[field as keyof AiOperationRecord]
    if (!expected || typeof expected !== "object" || expected instanceof Date) {
      return actual === expected
    }

    const condition = expected as {
      gt?: Date
      in?: unknown[]
      lte?: Date
    }

    if (condition.in) {
      return condition.in.includes(actual)
    }

    if (condition.gt) {
      return actual instanceof Date && actual > condition.gt
    }

    if (condition.lte) {
      return actual instanceof Date && actual <= condition.lte
    }

    return actual === expected
  })
}

function reserve(
  store: AiUsageLedgerStore,
  idempotencyKey: string,
  now = new Date("2026-06-23T12:00:00.000Z"),
) {
  return reserveAiUsageOperation({
    action: "ARTICLE_SUMMARY",
    idempotencyKey,
    model: "local-extractive-v1",
    now,
    provider: "local",
    store,
    userId: "user-1",
  })
}

describe("AI usage reservations", () => {
  it("never reserves beyond the allowance when requests arrive together", async () => {
    const { store } = createLedgerStore(2)

    const reservations = await Promise.all([
      reserve(store, "summary:user-1:article-1:v1"),
      reserve(store, "summary:user-1:article-2:v1"),
      reserve(store, "summary:user-1:article-3:v1"),
    ])

    expect(
      reservations.filter(
        (reservation) => reservation.operation.status === "RESERVED",
      ),
    ).toHaveLength(2)
    expect(
      reservations.filter(
        (reservation) =>
          reservation.operation.errorCode === "MONTHLY_LIMIT_REACHED",
      ),
    ).toHaveLength(1)
  })

  it("uses one provider call for simultaneous retries of the same key", async () => {
    const { store } = createLedgerStore(2)
    let providerCalls = 0

    await Promise.all(
      ["first", "second"].map(async () => {
        const reservation = await reserve(store, "summary:user-1:article-1:v1")

        if (
          !reservation.created ||
          reservation.operation.status !== "RESERVED"
        ) {
          return
        }

        await markAiUsageOperationProcessing({
          operationId: reservation.operation.id,
          store,
        })
        providerCalls += 1
        await completeAiUsageOperation({
          operationId: reservation.operation.id,
          store,
        })
      }),
    )

    expect(providerCalls).toBe(1)
  })

  it("releases a failed reservation so another request can use the allowance", async () => {
    const { store } = createLedgerStore(1)
    const first = await reserve(store, "summary:user-1:article-1:v1")

    await markAiUsageOperationProcessing({
      operationId: first.operation.id,
      store,
    })
    await failAiUsageOperation({
      errorCode: "PROVIDER_REQUEST_FAILED",
      operationId: first.operation.id,
      store,
    })

    const second = await reserve(store, "summary:user-1:article-2:v1")

    expect(second.operation.status).toBe("RESERVED")
  })

  it("returns the completed operation for a repeat key without spending again", async () => {
    const { store } = createLedgerStore(1)
    const first = await reserve(store, "summary:user-1:article-1:v1")

    await markAiUsageOperationProcessing({
      operationId: first.operation.id,
      store,
    })
    await completeAiUsageOperation({
      operationId: first.operation.id,
      store,
    })

    const repeated = await reserve(store, "summary:user-1:article-1:v1")

    expect(repeated.created).toBe(false)
    expect(repeated.operation.status).toBe("COMPLETED")
  })

  it("starts a fresh allowance period at the beginning of a UTC month", async () => {
    const { periods, store } = createLedgerStore(1)
    const june = await reserve(
      store,
      "summary:user-1:article-june:v1",
      new Date("2026-06-30T23:59:00.000Z"),
    )

    await markAiUsageOperationProcessing({
      operationId: june.operation.id,
      store,
    })
    await completeAiUsageOperation({
      operationId: june.operation.id,
      store,
    })

    const july = await reserve(
      store,
      "summary:user-1:article-july:v1",
      new Date("2026-07-01T00:00:00.000Z"),
    )

    expect(july.operation.status).toBe("RESERVED")
    expect(periods).toHaveLength(2)
    expect(getAiUsagePeriodStart(new Date("2026-07-31T23:59:00.000Z"))).toEqual(
      new Date("2026-07-01T00:00:00.000Z"),
    )
  })

  it("lets a later worker reclaim an expired operation with a new fencing attempt", async () => {
    const { store } = createLedgerStore(1)
    const reservation = await reserve(store, "summary:user-1:article-lease:v1")
    const startedAt = new Date("2026-06-23T12:00:00.000Z")
    const first = await claimAiUsageOperation({
      leaseDurationMs: 1_000,
      leaseOwner: "worker-a",
      now: startedAt,
      operationId: reservation.operation.id,
      store,
    })

    expect(first?.lease).toEqual({ attempt: 1, owner: "worker-a" })
    await expect(
      claimAiUsageOperation({
        leaseOwner: "worker-b",
        now: new Date("2026-06-23T12:00:00.500Z"),
        operationId: reservation.operation.id,
        store,
      }),
    ).resolves.toBeNull()

    const reclaimed = await claimAiUsageOperation({
      leaseOwner: "worker-b",
      now: new Date("2026-06-23T12:00:01.001Z"),
      operationId: reservation.operation.id,
      store,
    })

    expect(reclaimed?.lease).toEqual({ attempt: 2, owner: "worker-b" })
    expect(
      await renewAiUsageOperationLease({
        lease: first!.lease,
        now: new Date("2026-06-23T12:00:01.002Z"),
        operationId: reservation.operation.id,
        store,
      }),
    ).toBe(false)
  })

  it("prevents a superseded worker from consuming the reservation", async () => {
    const { periods, store } = createLedgerStore(1)
    const reservation = await reserve(store, "summary:user-1:article-fence:v1")
    const first = await claimAiUsageOperation({
      leaseDurationMs: 1,
      leaseOwner: "worker-a",
      now: new Date("2026-06-23T12:00:00.000Z"),
      operationId: reservation.operation.id,
      store,
    })
    const second = await claimAiUsageOperation({
      leaseOwner: "worker-b",
      now: new Date("2026-06-23T12:00:00.002Z"),
      operationId: reservation.operation.id,
      store,
    })

    await expect(
      completeAiUsageOperation({
        lease: first!.lease,
        now: new Date("2026-06-23T12:00:00.003Z"),
        operationId: reservation.operation.id,
        store,
      }),
    ).rejects.toThrow("lease is no longer owned")

    await completeAiUsageOperation({
      lease: second!.lease,
      now: new Date("2026-06-23T12:00:00.004Z"),
      operationId: reservation.operation.id,
      store,
    })

    expect(Array.from(periods.values())[0]).toMatchObject({
      consumedUnits: 1,
      reservedUnits: 0,
    })
  })

  it("reconciles a stranded reservation once and makes it retryable", async () => {
    const { periods, store } = createLedgerStore(1)
    const reservation = await reserve(store, "summary:user-1:article-stale:v1")

    await claimAiUsageOperation({
      leaseDurationMs: 1,
      leaseOwner: "worker-a",
      now: new Date("2026-06-23T12:00:00.000Z"),
      operationId: reservation.operation.id,
      store,
    })

    await expect(
      reconcileExpiredAiUsageOperations({
        now: new Date("2026-06-23T12:00:00.002Z"),
        store,
      }),
    ).resolves.toMatchObject({ expired: 1, released: 1 })
    expect(Array.from(periods.values())[0].reservedUnits).toBe(0)
    await expect(
      reconcileExpiredAiUsageOperations({
        now: new Date("2026-06-23T12:00:00.003Z"),
        store,
      }),
    ).resolves.toMatchObject({ released: 0 })
  })
})

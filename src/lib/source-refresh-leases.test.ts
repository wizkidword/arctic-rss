import { describe, expect, it } from "vitest"

import {
  claimSourceRefreshLease,
  releaseSourceRefreshLease,
  renewSourceRefreshLease,
} from "./source-refresh-leases"

function createStore() {
  const source = {
    id: "source-1",
    refreshGeneration: 0,
    refreshLeaseExpiresAt: null as Date | null,
    refreshOwner: null as string | null,
  }

  return {
    source,
    store: {
      findCurrent: async () => ({ ...source }),
      updateMany: async ({
        data,
        where,
      }: {
        data: Record<string, unknown>
        where: Record<string, unknown>
      }) => {
        if (where.id !== source.id || !matchesLeaseWhere(source, where)) {
          return { count: 0 }
        }

        const nextGeneration = data.refreshGeneration as
          | { increment?: number }
          | undefined
        if (nextGeneration?.increment) {
          source.refreshGeneration += nextGeneration.increment
        }
        if (data.refreshLeaseExpiresAt instanceof Date) {
          source.refreshLeaseExpiresAt = data.refreshLeaseExpiresAt
        }
        if ("refreshOwner" in data) {
          source.refreshOwner = data.refreshOwner as string | null
        }

        return { count: 1 }
      },
    },
  }
}

function matchesLeaseWhere(
  source: {
    refreshGeneration: number
    refreshLeaseExpiresAt: Date | null
    refreshOwner: string | null
  },
  where: Record<string, unknown>,
) {
  const alternatives = where.OR as Array<Record<string, unknown>> | undefined
  if (alternatives) {
    return alternatives.some((alternative) => {
      if (alternative.refreshLeaseExpiresAt === null) {
        return source.refreshLeaseExpiresAt === null
      }

      const expiry = alternative.refreshLeaseExpiresAt as { lte?: Date } | undefined
      return Boolean(expiry?.lte && source.refreshLeaseExpiresAt && source.refreshLeaseExpiresAt <= expiry.lte)
    })
  }

  const expiry = where.refreshLeaseExpiresAt as { gt?: Date } | undefined
  return (
    where.refreshGeneration === source.refreshGeneration &&
    where.refreshOwner === source.refreshOwner &&
    Boolean(expiry?.gt && source.refreshLeaseExpiresAt && source.refreshLeaseExpiresAt > expiry.gt)
  )
}

describe("source refresh leases", () => {
  it("atomically claims an expired source and fences a prior owner", async () => {
    const { source, store } = createStore()
    const firstNow = new Date("2026-08-09T12:00:00.000Z")
    const first = await claimSourceRefreshLease({
      now: firstNow,
      owner: "worker-a",
      sourceId: source.id,
      store,
    })

    expect(first).toMatchObject({ generation: 1, id: source.id, owner: "worker-a" })
    await expect(
      claimSourceRefreshLease({
        now: new Date("2026-08-09T12:01:00.000Z"),
        owner: "worker-b",
        sourceId: source.id,
        store,
      }),
    ).resolves.toBeNull()

    const secondNow = new Date("2026-08-09T12:11:00.000Z")
    const second = await claimSourceRefreshLease({
      now: secondNow,
      owner: "worker-b",
      sourceId: source.id,
      store,
    })

    expect(second).toMatchObject({ generation: 2, id: source.id, owner: "worker-b" })
    await expect(
      renewSourceRefreshLease({ lease: first!, now: secondNow, store }),
    ).resolves.toBe(false)
    expect(source.refreshOwner).toBe("worker-b")
  })

  it("releases only the current owner", async () => {
    const { source, store } = createStore()
    const now = new Date("2026-08-09T12:00:00.000Z")
    const lease = await claimSourceRefreshLease({
      now,
      owner: "worker-a",
      sourceId: source.id,
      store,
    })

    await releaseSourceRefreshLease({ lease: lease!, now, store })

    expect(source.refreshLeaseExpiresAt).toEqual(now)
    expect(source.refreshOwner).toBeNull()
  })
})

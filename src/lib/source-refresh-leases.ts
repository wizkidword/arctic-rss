import { randomUUID } from "node:crypto"

export const SOURCE_REFRESH_LEASE_MS = 10 * 60 * 1_000

export type SourceRefreshLease = {
  generation: number
  id: string
  leaseExpiresAt: Date
  owner: string
}

type SourceRefreshLeaseRecord = {
  id: string
  refreshGeneration: number
  refreshLeaseExpiresAt: Date | null
  refreshOwner: string | null
}

export type SourceRefreshLeaseStore = {
  findCurrent(): Promise<SourceRefreshLeaseRecord | null>
  updateMany(args: {
    data: Record<string, unknown>
    where: Record<string, unknown>
  }): Promise<{ count: number }>
}

export async function claimSourceRefreshLease({
  leaseDurationMs = SOURCE_REFRESH_LEASE_MS,
  now = new Date(),
  owner = randomUUID(),
  sourceId,
  store,
}: {
  leaseDurationMs?: number
  now?: Date
  owner?: string
  sourceId: string
  store: SourceRefreshLeaseStore
}): Promise<SourceRefreshLease | null> {
  const leaseExpiresAt = addMilliseconds(now, leaseDurationMs)
  const claimed = await store.updateMany({
    data: {
      refreshGeneration: { increment: 1 },
      refreshLeaseExpiresAt: leaseExpiresAt,
      refreshOwner: owner,
      refreshStartedAt: now,
    },
    where: {
      id: sourceId,
      OR: [
        { refreshLeaseExpiresAt: null },
        { refreshLeaseExpiresAt: { lte: now } },
      ],
    },
  })

  if (claimed.count !== 1) {
    return null
  }

  const source = await store.findCurrent()
  if (
    !source ||
    source.refreshGeneration < 1 ||
    source.refreshOwner !== owner ||
    !source.refreshLeaseExpiresAt ||
    source.refreshLeaseExpiresAt.getTime() !== leaseExpiresAt.getTime()
  ) {
    return null
  }

  return {
    generation: source.refreshGeneration,
    id: source.id,
    leaseExpiresAt: source.refreshLeaseExpiresAt,
    owner,
  }
}

export async function renewSourceRefreshLease({
  lease,
  leaseDurationMs = SOURCE_REFRESH_LEASE_MS,
  now = new Date(),
  store,
}: {
  lease: SourceRefreshLease
  leaseDurationMs?: number
  now?: Date
  store: SourceRefreshLeaseStore
}) {
  const updated = await store.updateMany({
    data: {
      refreshLeaseExpiresAt: addMilliseconds(now, leaseDurationMs),
    },
    where: sourceRefreshLeaseWhere(lease, now),
  })

  return updated.count === 1
}

export async function releaseSourceRefreshLease({
  lease,
  now = new Date(),
  store,
}: {
  lease: SourceRefreshLease
  now?: Date
  store: SourceRefreshLeaseStore
}) {
  await store.updateMany({
    data: {
      refreshLeaseExpiresAt: now,
      refreshOwner: null,
    },
    where: sourceRefreshLeaseWhere(lease, now),
  })
}

export function sourceRefreshLeaseWhere(
  lease: Pick<SourceRefreshLease, "generation" | "id" | "owner">,
  now = new Date(),
) {
  return {
    id: lease.id,
    refreshGeneration: lease.generation,
    refreshLeaseExpiresAt: { gt: now },
    refreshOwner: lease.owner,
  }
}

export async function runWithSourceRefreshLeaseHeartbeat<Result>({
  lease,
  now = () => new Date(),
  store,
  work,
}: {
  lease: SourceRefreshLease
  now?: () => Date
  store: SourceRefreshLeaseStore
  work: () => Promise<Result>
}) {
  let leaseHeld = true
  let renewal = Promise.resolve()
  const heartbeat = setInterval(
    () => {
      renewal = renewal
        .then(async () => {
          if (!leaseHeld) {
            return
          }

          leaseHeld = await renewSourceRefreshLease({
            lease,
            now: now(),
            store,
          })
        })
        .catch(() => {
          leaseHeld = false
        })
    },
    Math.max(1_000, Math.floor(SOURCE_REFRESH_LEASE_MS / 2)),
  )

  heartbeat.unref?.()

  try {
    const result = await work()
    await renewal
    if (leaseHeld) {
      leaseHeld = await renewSourceRefreshLease({
        lease,
        now: now(),
        store,
      })
    }

    return { leaseHeld, result }
  } finally {
    clearInterval(heartbeat)
  }
}

function addMilliseconds(now: Date, durationMs: number) {
  return new Date(now.getTime() + Math.max(1_000, Math.floor(durationMs)))
}

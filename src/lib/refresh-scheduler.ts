import { readClampedPositiveInteger } from "./refresh-schedule"

export const DEFAULT_SCHEDULER_INTERVAL_MS = 60_000
export const DEFAULT_SCHEDULER_BATCH_SIZE = 100
export const DEFAULT_SCHEDULER_CLAIM_LEASE_MS = 10 * 60_000

type DueRecord = {
  id: string
  nextFetchAt: Date
}

type DueStore = {
  findMany(args: Record<string, unknown>): Promise<DueRecord[]>
  updateMany(args: Record<string, unknown>): Promise<{ count: number }>
}

export type RefreshSchedulerStore = {
  feed: DueStore
  podcast: DueStore
}

export type RefreshScheduleResult = {
  dueCount: number
  duplicatePrevented: number
  enqueuedCount: number
}

export async function enqueueDueFeedRefreshes({
  batchSize,
  claimLeaseMs = DEFAULT_SCHEDULER_CLAIM_LEASE_MS,
  enqueue,
  now = new Date(),
  store,
}: {
  batchSize: number
  claimLeaseMs?: number
  enqueue: (feedId: string) => Promise<unknown>
  now?: Date
  store: Pick<RefreshSchedulerStore, "feed">
}): Promise<RefreshScheduleResult> {
  return enqueueDueRefreshes({
    batchSize,
    claimLeaseMs,
    enqueue,
    now,
    store: store.feed,
  })
}

export async function enqueueDuePodcastRefreshes({
  batchSize,
  claimLeaseMs = DEFAULT_SCHEDULER_CLAIM_LEASE_MS,
  enqueue,
  now = new Date(),
  store,
}: {
  batchSize: number
  claimLeaseMs?: number
  enqueue: (podcastId: string) => Promise<unknown>
  now?: Date
  store: Pick<RefreshSchedulerStore, "podcast">
}): Promise<RefreshScheduleResult> {
  return enqueueDueRefreshes({
    batchSize,
    claimLeaseMs,
    enqueue,
    now,
    store: store.podcast,
  })
}

export function schedulerSettings(
  environment: Record<string, string | undefined> = process.env
) {
  return {
    authTokenMaintenanceBatchSize: readClampedPositiveInteger({
      fallback: 100,
      maximum: 1_000,
      minimum: 1,
      value: environment.AUTH_TOKEN_MAINTENANCE_BATCH_SIZE,
    }),
    authTokenMaintenanceIntervalMs: readClampedPositiveInteger({
      fallback: 15 * 60_000,
      maximum: 24 * 60 * 60_000,
      minimum: 60_000,
      value: environment.AUTH_TOKEN_MAINTENANCE_INTERVAL_MS,
    }),
    feedRefreshConcurrency: readClampedPositiveInteger({
      fallback: 3,
      maximum: 16,
      minimum: 1,
      value: environment.FEED_REFRESH_CONCURRENCY,
    }),
    podcastRefreshConcurrency: readClampedPositiveInteger({
      fallback: 2,
      maximum: 16,
      minimum: 1,
      value: environment.PODCAST_REFRESH_CONCURRENCY,
    }),
    schedulerBatchSize: readClampedPositiveInteger({
      fallback: DEFAULT_SCHEDULER_BATCH_SIZE,
      maximum: 1_000,
      minimum: 1,
      value: environment.FEED_SCHEDULER_BATCH_SIZE,
    }),
    schedulerIntervalMs: readClampedPositiveInteger({
      fallback: DEFAULT_SCHEDULER_INTERVAL_MS,
      maximum: 60 * 60_000,
      minimum: 10_000,
      value: environment.FEED_SCHEDULER_INTERVAL_MS,
    }),
  }
}

async function enqueueDueRefreshes({
  batchSize,
  claimLeaseMs,
  enqueue,
  now,
  store,
}: {
  batchSize: number
  claimLeaseMs: number
  enqueue: (id: string) => Promise<unknown>
  now: Date
  store: DueStore
}): Promise<RefreshScheduleResult> {
  const due = await store.findMany({
    orderBy: [{ nextFetchAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      nextFetchAt: true,
    },
    take: readClampedPositiveInteger({
      fallback: DEFAULT_SCHEDULER_BATCH_SIZE,
      maximum: 1_000,
      minimum: 1,
      value: String(batchSize),
    }),
    where: {
      nextFetchAt: {
        lte: now,
      },
      subscriptions: {
        some: {
          isPaused: false,
        },
      },
    },
  })
  const claimUntil = new Date(now.getTime() + Math.max(10_000, claimLeaseMs))
  let duplicatePrevented = 0
  let enqueuedCount = 0

  for (const item of due) {
    const claimed = await store.updateMany({
      data: {
        nextFetchAt: claimUntil,
      },
      where: {
        id: item.id,
        nextFetchAt: {
          lte: now,
        },
      },
    })

    if (claimed.count !== 1) {
      duplicatePrevented += 1
      continue
    }

    try {
      await enqueue(item.id)
      enqueuedCount += 1
    } catch (error) {
      await store.updateMany({
        data: {
          nextFetchAt: item.nextFetchAt,
        },
        where: {
          id: item.id,
          nextFetchAt: claimUntil,
        },
      })

      throw error
    }
  }

  return {
    dueCount: due.length,
    duplicatePrevented,
    enqueuedCount,
  }
}

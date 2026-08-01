import { readClampedPositiveInteger } from "./refresh-schedule"
import {
  listSavedMonitorArticleMatches,
  type SavedMonitorArticleCursor,
  type SavedMonitorArticleMatch,
} from "./saved-monitor-matching"
import {
  savedSearchFilters,
  type SavedSearchRecord,
} from "./saved-searches"

export const DEFAULT_SAVED_MONITOR_BATCH_SIZE = 25
export const DEFAULT_SAVED_MONITOR_INTERVAL_MS = 5 * 60_000
export const DEFAULT_SAVED_MONITOR_LEASE_MS = 10 * 60_000
export const DEFAULT_SAVED_MONITOR_MATCH_BATCH_SIZE = 100

type DueSavedMonitor = Pick<
  SavedSearchRecord,
  | "collectionId"
  | "folderId"
  | "id"
  | "monitorCursorArticleId"
  | "monitorCursorCreatedAt"
  | "monitorAction"
  | "monitorNextRunAt"
  | "publishedAfter"
  | "publishedBefore"
  | "query"
  | "state"
  | "subscriptionId"
  | "userId"
>

export type SavedMonitorStore = {
  articleState: {
    createMany(args: {
      data: Array<{
        articleId: string
        isRead: boolean
        isStarred: boolean
        starredAt: Date
        userId: string
      }>
      skipDuplicates: true
    }): Promise<{ count: number }>
    updateMany(args: {
      data: {
        isStarred: boolean
        starredAt: Date
      }
      where: {
        articleId: {
          in: string[]
        }
        isStarred: boolean
        userId: string
      }
    }): Promise<{ count: number }>
  }
  savedSearch: {
    findMany(args: Record<string, unknown>): Promise<DueSavedMonitor[]>
    updateMany(args: Record<string, unknown>): Promise<{ count: number }>
  }
}

export type SavedMonitorSettings = {
  batchSize: number
  intervalMs: number
  leaseMs: number
  matchBatchSize: number
}

export type SavedMonitorTickResult = {
  claimed: number
  continued: number
  failed: number
  initialized: number
  newMatches: number
  skipped: number
}

export function savedMonitorSettings(
  environment: Record<string, string | undefined> = process.env
): SavedMonitorSettings {
  const intervalMs = readClampedPositiveInteger({
    fallback: DEFAULT_SAVED_MONITOR_INTERVAL_MS,
    maximum: 24 * 60 * 60_000,
    minimum: 60_000,
    value: environment.SAVED_MONITOR_INTERVAL_MS,
  })

  return {
    batchSize: readClampedPositiveInteger({
      fallback: DEFAULT_SAVED_MONITOR_BATCH_SIZE,
      maximum: 100,
      minimum: 1,
      value: environment.SAVED_MONITOR_BATCH_SIZE,
    }),
    intervalMs,
    leaseMs: Math.max(intervalMs * 2, DEFAULT_SAVED_MONITOR_LEASE_MS),
    matchBatchSize: readClampedPositiveInteger({
      fallback: DEFAULT_SAVED_MONITOR_MATCH_BATCH_SIZE,
      maximum: 500,
      minimum: 1,
      value: environment.SAVED_MONITOR_MATCH_BATCH_SIZE,
    }),
  }
}

export async function processDueSavedMonitors({
  findMatches = async ({ cursor, limit, monitor }: {
    cursor: SavedMonitorArticleCursor
    limit: number
    monitor: DueSavedMonitor
  }) =>
    listSavedMonitorArticleMatches({
      cursor,
      filters: savedSearchFilters(monitor),
      limit,
      userId: monitor.userId,
    }),
  now = new Date(),
  settings = savedMonitorSettings(),
  store,
}: {
  findMatches?: (input: {
    cursor: SavedMonitorArticleCursor
    limit: number
    monitor: DueSavedMonitor
  }) => Promise<SavedMonitorArticleMatch[]>
  now?: Date
  settings?: SavedMonitorSettings
  store: SavedMonitorStore
}): Promise<SavedMonitorTickResult> {
  const monitors = await store.savedSearch.findMany({
    orderBy: [{ monitorNextRunAt: "asc" }, { id: "asc" }],
    select: {
      collectionId: true,
      folderId: true,
      id: true,
      monitorCursorArticleId: true,
      monitorCursorCreatedAt: true,
      monitorAction: true,
      monitorNextRunAt: true,
      publishedAfter: true,
      publishedBefore: true,
      query: true,
      state: true,
      subscriptionId: true,
      userId: true,
    },
    take: settings.batchSize,
    where: {
      monitorEnabled: true,
      monitorNextRunAt: { lte: now },
    },
  })
  const result: SavedMonitorTickResult = {
    claimed: 0,
    continued: 0,
    failed: 0,
    initialized: 0,
    newMatches: 0,
    skipped: 0,
  }

  for (const monitor of monitors) {
    if (!monitor.monitorNextRunAt) {
      result.skipped += 1
      continue
    }

    const claimUntil = new Date(now.getTime() + settings.leaseMs)
    const claim = await store.savedSearch.updateMany({
      data: { monitorNextRunAt: claimUntil },
      where: {
        id: monitor.id,
        monitorEnabled: true,
        monitorNextRunAt: monitor.monitorNextRunAt,
        userId: monitor.userId,
      },
    })

    if (claim.count !== 1) {
      result.skipped += 1
      continue
    }

    result.claimed += 1
    const cursor = savedMonitorCursor(monitor)

    if (!cursor) {
      const initialized = await completeSavedMonitorRun({
        cursor: { articleId: "", createdAt: now },
        monitor,
        nextRunAt: new Date(now.getTime() + settings.intervalMs),
        now,
        store,
        claimUntil,
      })
      result.initialized += initialized ? 1 : 0
      continue
    }

    try {
      const matches = await findMatches({
        cursor,
        limit: settings.matchBatchSize + 1,
        monitor,
      })
      const consumedMatches = matches.slice(0, settings.matchBatchSize)
      const nextCursor = consumedMatches.at(-1) ?? cursor
      const continued = matches.length > settings.matchBatchSize
      await applySavedMonitorAction({
        matches: consumedMatches,
        monitor,
        now,
        store,
      })
      const complete = await completeSavedMonitorRun({
        cursor: nextCursor,
        increment: consumedMatches.length,
        monitor,
        nextRunAt: continued
          ? now
          : new Date(now.getTime() + settings.intervalMs),
        now,
        store,
        claimUntil,
      })

      if (!complete) {
        result.skipped += 1
        continue
      }

      result.newMatches += consumedMatches.length
      result.continued += continued ? 1 : 0
    } catch {
      result.failed += 1
      await store.savedSearch.updateMany({
        data: {
          monitorNextRunAt: new Date(now.getTime() + settings.intervalMs),
        },
        where: {
          id: monitor.id,
          monitorEnabled: true,
          monitorNextRunAt: claimUntil,
          userId: monitor.userId,
        },
      })
    }
  }

  return result
}

async function applySavedMonitorAction({
  matches,
  monitor,
  now,
  store,
}: {
  matches: SavedMonitorArticleMatch[]
  monitor: DueSavedMonitor
  now: Date
  store: SavedMonitorStore
}) {
  if (monitor.monitorAction !== "star" || !matches.length) {
    return
  }

  const articleIds = [...new Set(matches.map((match) => match.articleId))]

  await store.articleState.createMany({
    data: articleIds.map((articleId) => ({
      articleId,
      isRead: false,
      isStarred: true,
      starredAt: now,
      userId: monitor.userId,
    })),
    skipDuplicates: true,
  })
  await store.articleState.updateMany({
    data: { isStarred: true, starredAt: now },
    where: {
      articleId: { in: articleIds },
      isStarred: false,
      userId: monitor.userId,
    },
  })
}

async function completeSavedMonitorRun({
  claimUntil,
  cursor,
  increment = 0,
  monitor,
  nextRunAt,
  now,
  store,
}: {
  claimUntil: Date
  cursor: SavedMonitorArticleCursor
  increment?: number
  monitor: DueSavedMonitor
  nextRunAt: Date
  now: Date
  store: SavedMonitorStore
}) {
  const result = await store.savedSearch.updateMany({
    data: {
      monitorCursorArticleId: cursor.articleId,
      monitorCursorCreatedAt: cursor.createdAt,
      monitorLastRunAt: now,
      monitorNextRunAt: nextRunAt,
      ...(increment ? { monitorNewMatchCount: { increment } } : {}),
    },
    where: {
      id: monitor.id,
      monitorEnabled: true,
      monitorNextRunAt: claimUntil,
      userId: monitor.userId,
    },
  })

  return result.count === 1
}

function savedMonitorCursor(
  monitor: Pick<
    DueSavedMonitor,
    "monitorCursorArticleId" | "monitorCursorCreatedAt"
  >
): SavedMonitorArticleCursor | null {
  if (!monitor.monitorCursorCreatedAt || monitor.monitorCursorArticleId === null) {
    return null
  }

  return {
    articleId: monitor.monitorCursorArticleId,
    createdAt: monitor.monitorCursorCreatedAt,
  }
}

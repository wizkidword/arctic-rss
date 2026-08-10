import Redis from "ioredis"

import { durableRedisConnectionOptions } from "./redis-config"
import {
  MAX_RETAINED_SOURCE_REFRESH_FAILURES,
  parseSourceRefreshEvent,
  SOURCE_REFRESH_FAILURE_REDIS_KEY,
  type SourceRefreshErrorCategory,
} from "./source-refresh-failures"

export const SOURCE_RELIABILITY_WINDOW_MS = 15 * 60_000

export type SourceRefreshReliabilityReport = {
  affectedHosts: string[]
  available: boolean
  errorCategories: Partial<Record<SourceRefreshErrorCategory, number>>
  failureCount: number
  failurePercentage: number | null
  feedFailureCount: number
  podcastFailureCount: number
  platformImpact: "degraded" | "none"
  recentAttemptCount: number
  recurringFailureHosts: string[]
  status: "degraded" | "ok" | "unavailable"
}

type SourceRefreshReliabilityStore = {
  lrange(key: string, start: number, end: number): Promise<string[]>
}

export async function inspectSourceRefreshReliability(): Promise<SourceRefreshReliabilityReport> {
  const redis = new Redis(durableRedisConnectionOptions().url, {
    connectTimeout: 2_000,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
  })
  redis.on("error", () => {
    // Diagnostics return a sanitized unavailable state instead.
  })

  try {
    await redis.ping()
    return await inspectSourceRefreshReliabilityWithStore({ store: redis })
  } catch {
    return unavailableSourceRefreshReliability()
  } finally {
    redis.disconnect()
  }
}

export async function inspectSourceRefreshReliabilityWithStore({
  now = Date.now(),
  store,
  windowMs = SOURCE_RELIABILITY_WINDOW_MS,
}: {
  now?: number
  store: SourceRefreshReliabilityStore
  windowMs?: number
}): Promise<SourceRefreshReliabilityReport> {
  try {
    const threshold = now - Math.max(0, windowMs)
    const values = await store.lrange(
      SOURCE_REFRESH_FAILURE_REDIS_KEY,
      0,
      MAX_RETAINED_SOURCE_REFRESH_FAILURES - 1,
    )
    const events = values
      .map(parseSourceRefreshEvent)
      .filter(
        (event): event is NonNullable<typeof event> =>
          event !== null &&
          event.timestamp >= threshold &&
          event.timestamp <= now,
      )
    const failures = events.filter((event) => event.outcome === "failed")
    const hostFailureCounts = new Map<string, number>()
    const errorCategories: SourceRefreshReliabilityReport["errorCategories"] =
      {}

    for (const failure of failures) {
      if (failure.host) {
        hostFailureCounts.set(
          failure.host,
          (hostFailureCounts.get(failure.host) ?? 0) + 1,
        )
      }
      const category = failure.errorCategory ?? "unknown"
      errorCategories[category] = (errorCategories[category] ?? 0) + 1
    }

    const affectedHosts = [...hostFailureCounts.keys()].sort()
    const failurePercentage = events.length
      ? Math.round((failures.length / events.length) * 10_000) / 100
      : null

    return {
      affectedHosts,
      available: true,
      errorCategories,
      failureCount: failures.length,
      failurePercentage,
      feedFailureCount: failures.filter((event) => event.kind === "feed")
        .length,
      podcastFailureCount: failures.filter((event) => event.kind === "podcast")
        .length,
      platformImpact: isLikelySharedInternalFailure({
        affectedHostCount: affectedHosts.length,
        errorCategories,
        failurePercentage,
      })
        ? "degraded"
        : "none",
      recentAttemptCount: events.length,
      recurringFailureHosts: affectedHosts.filter(
        (host) => (hostFailureCounts.get(host) ?? 0) > 1,
      ),
      status: failures.length ? "degraded" : "ok",
    }
  } catch {
    return unavailableSourceRefreshReliability()
  }
}

export function unavailableSourceRefreshReliability(): SourceRefreshReliabilityReport {
  return {
    affectedHosts: [],
    available: false,
    errorCategories: {},
    failureCount: 0,
    failurePercentage: null,
    feedFailureCount: 0,
    podcastFailureCount: 0,
    platformImpact: "none",
    recentAttemptCount: 0,
    recurringFailureHosts: [],
    status: "unavailable",
  }
}

function isLikelySharedInternalFailure({
  affectedHostCount,
  errorCategories,
  failurePercentage,
}: {
  affectedHostCount: number
  errorCategories: SourceRefreshReliabilityReport["errorCategories"]
  failurePercentage: number | null
}) {
  if (
    failurePercentage === null ||
    affectedHostCount < 2 ||
    failurePercentage < 75
  ) {
    return false
  }

  const databaseOrRedisFailures =
    (errorCategories.database ?? 0) + (errorCategories.redis ?? 0)
  if (databaseOrRedisFailures >= 2) {
    return true
  }

  if ((errorCategories.dns ?? 0) >= 3 && affectedHostCount >= 3) {
    return true
  }

  return (
    (errorCategories.timeout ?? 0) >= 3 &&
    affectedHostCount >= 3 &&
    failurePercentage >= 90
  )
}

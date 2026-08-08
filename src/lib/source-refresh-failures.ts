export const SOURCE_REFRESH_FAILURE_REDIS_KEY =
  "arctic-rss:source-refresh-failures:v1"
export const MAX_RETAINED_SOURCE_REFRESH_FAILURES = 100

export type SourceRefreshKind = "feed" | "podcast"

type SourceRefreshFailureStore = {
  lpush(key: string, value: string): Promise<number>
  lrange(key: string, start: number, end: number): Promise<string[]>
  ltrim(key: string, start: number, end: number): Promise<string>
}

type SourceRefreshFailureWriter = Pick<
  SourceRefreshFailureStore,
  "lpush" | "ltrim"
>

type SourceRefreshFailureEvent = {
  kind: SourceRefreshKind
  timestamp: number
}

/**
 * Retains compact, source-id-free recent failure evidence after BullMQ removes
 * a terminal source-refresh job. The database remains the source of per-feed
 * and per-podcast diagnostic history.
 */
export async function recordSourceRefreshFailure({
  client,
  kind,
  timestamp = Date.now(),
}: {
  client: SourceRefreshFailureWriter
  kind: SourceRefreshKind
  timestamp?: number
}) {
  const event = JSON.stringify({
    kind,
    timestamp: Math.max(0, Math.floor(timestamp)),
  } satisfies SourceRefreshFailureEvent)

  await client.lpush(SOURCE_REFRESH_FAILURE_REDIS_KEY, event)
  await client.ltrim(
    SOURCE_REFRESH_FAILURE_REDIS_KEY,
    0,
    MAX_RETAINED_SOURCE_REFRESH_FAILURES - 1
  )
}

export async function countRecentSourceRefreshFailures({
  client,
  now = Date.now(),
  windowMs,
}: {
  client: Pick<SourceRefreshFailureStore, "lrange">
  now?: number
  windowMs: number
}) {
  const threshold = now - Math.max(0, windowMs)
  const values = await client.lrange(
    SOURCE_REFRESH_FAILURE_REDIS_KEY,
    0,
    MAX_RETAINED_SOURCE_REFRESH_FAILURES - 1
  )

  return values.filter((value) => {
    const event = parseSourceRefreshFailure(value)
    return event !== null && event.timestamp >= threshold && event.timestamp <= now
  }).length
}

function parseSourceRefreshFailure(value: string): SourceRefreshFailureEvent | null {
  try {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null
    }

    const event = parsed as Record<string, unknown>
    if (
      (event.kind !== "feed" && event.kind !== "podcast") ||
      typeof event.timestamp !== "number" ||
      !Number.isFinite(event.timestamp) ||
      event.timestamp < 0
    ) {
      return null
    }

    return {
      kind: event.kind,
      timestamp: event.timestamp,
    }
  } catch {
    return null
  }
}

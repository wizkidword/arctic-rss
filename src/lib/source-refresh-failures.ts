export const SOURCE_REFRESH_FAILURE_REDIS_KEY =
  "arctic-rss:source-refresh-failures:v1"
export const MAX_RETAINED_SOURCE_REFRESH_FAILURES = 100

export type SourceRefreshKind = "feed" | "podcast"
export type SourceRefreshOutcome = "failed" | "succeeded"
export type SourceRefreshErrorCategory =
  | "database"
  | "dns"
  | "http_4xx"
  | "http_5xx"
  | "network"
  | "parse"
  | "redis"
  | "timeout"
  | "unknown"

type SourceRefreshFailureStore = {
  lpush(key: string, value: string): Promise<number>
  lrange(key: string, start: number, end: number): Promise<string[]>
  ltrim(key: string, start: number, end: number): Promise<string>
}

type SourceRefreshFailureWriter = Pick<
  SourceRefreshFailureStore,
  "lpush" | "ltrim"
>

export type SourceRefreshEvent = {
  errorCategory?: SourceRefreshErrorCategory
  host?: string
  kind: SourceRefreshKind
  outcome: SourceRefreshOutcome
  timestamp: number
}

/**
 * Retains compact, source-id-free terminal source-refresh evidence after
 * BullMQ removes a job. Source hosts and normalized error categories support
 * internal reliability diagnostics without retaining feed or podcast IDs.
 */
export async function recordSourceRefreshFailure({
  client,
  errorCategory,
  host,
  kind,
  timestamp = Date.now(),
}: {
  client: SourceRefreshFailureWriter
  errorCategory?: SourceRefreshErrorCategory
  host?: string
  kind: SourceRefreshKind
  timestamp?: number
}) {
  return recordSourceRefreshEvent({
    client,
    kind,
    errorCategory,
    host,
    outcome: "failed",
    timestamp: Math.max(0, Math.floor(timestamp)),
  })
}

export async function recordSourceRefreshSuccess({
  client,
  kind,
  timestamp = Date.now(),
}: {
  client: SourceRefreshFailureWriter
  kind: SourceRefreshKind
  timestamp?: number
}) {
  return recordSourceRefreshEvent({
    client,
    kind,
    outcome: "succeeded",
    timestamp: Math.max(0, Math.floor(timestamp)),
  })
}

export async function recordSourceRefreshEvent({
  client,
  errorCategory,
  host,
  kind,
  outcome,
  timestamp,
}: SourceRefreshEvent & { client: SourceRefreshFailureWriter }) {
  const event = JSON.stringify({
    ...(errorCategory ? { errorCategory } : {}),
    ...(host ? { host } : {}),
    kind,
    outcome,
    timestamp,
  } satisfies SourceRefreshEvent)

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
    return (
      event !== null &&
      event.outcome === "failed" &&
      event.timestamp >= threshold &&
      event.timestamp <= now
    )
  }).length
}

export function parseSourceRefreshEvent(
  value: string
): SourceRefreshEvent | null {
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

    const outcome = event.outcome === undefined ? "failed" : event.outcome
    if (outcome !== "failed" && outcome !== "succeeded") {
      return null
    }
    if (
      event.host !== undefined &&
      (typeof event.host !== "string" || !event.host)
    ) {
      return null
    }
    if (
      event.errorCategory !== undefined &&
      !isSourceRefreshErrorCategory(event.errorCategory)
    ) {
      return null
    }

    return {
      ...(typeof event.errorCategory === "string"
        ? { errorCategory: event.errorCategory }
        : {}),
      ...(typeof event.host === "string" ? { host: event.host } : {}),
      kind: event.kind,
      outcome,
      timestamp: event.timestamp,
    }
  } catch {
    return null
  }
}

export function sourceRefreshErrorCategory(
  error: unknown
): SourceRefreshErrorCategory {
  const message = error instanceof Error ? error.message : String(error ?? "")

  if (/\b(redis|ioredis)\b/i.test(message)) {
    return "redis"
  }
  if (/\b(postgres|prisma|database|sql)\b/i.test(message)) {
    return "database"
  }
  if (/\b(enotfound|getaddrinfo|dns)\b/i.test(message)) {
    return "dns"
  }
  if (/\b(timeout|timed out|aborterror)\b/i.test(message)) {
    return "timeout"
  }
  if (/\b(?:status|http)\s*4\d\d\b/i.test(message)) {
    return "http_4xx"
  }
  if (/\b(?:status|http)\s*5\d\d\b/i.test(message)) {
    return "http_5xx"
  }
  if (/\b(parse|xml|json)\b/i.test(message)) {
    return "parse"
  }
  if (/\b(fetch|network|econn|socket|tls)\b/i.test(message)) {
    return "network"
  }

  return "unknown"
}

export function sourceHostFromUrl(value: string | null | undefined) {
  if (!value) {
    return undefined
  }

  try {
    return new URL(value).hostname.toLowerCase() || undefined
  } catch {
    return undefined
  }
}

function parseSourceRefreshFailure(value: string) {
  return parseSourceRefreshEvent(value)
}

function isSourceRefreshErrorCategory(
  value: unknown
): value is SourceRefreshErrorCategory {
  return (
    value === "database" ||
    value === "dns" ||
    value === "http_4xx" ||
    value === "http_5xx" ||
    value === "network" ||
    value === "parse" ||
    value === "redis" ||
    value === "timeout" ||
    value === "unknown"
  )
}

const MIN_REFRESH_INTERVAL_MINUTES = 5
const MAX_REFRESH_INTERVAL_MINUTES = 24 * 60
const MAX_FAILURE_BACKOFF_MULTIPLIER = 32
const JITTER_RATIO = 0.1

export function clampRefreshIntervalMinutes(value: number) {
  if (!Number.isFinite(value)) {
    return 60
  }

  return Math.min(
    MAX_REFRESH_INTERVAL_MINUTES,
    Math.max(MIN_REFRESH_INTERVAL_MINUTES, Math.round(value))
  )
}

export function nextFetchAt({
  consecutiveFailures,
  now,
  random = Math.random,
  refreshIntervalMinutes,
}: {
  consecutiveFailures: number
  now: Date
  random?: () => number
  refreshIntervalMinutes: number
}) {
  const intervalMs = clampRefreshIntervalMinutes(refreshIntervalMinutes) * 60_000
  const failureMultiplier = Math.min(
    MAX_FAILURE_BACKOFF_MULTIPLIER,
    2 ** Math.max(0, Math.floor(consecutiveFailures))
  )
  const jitter = Math.max(-1, Math.min(1, random() * 2 - 1)) * JITTER_RATIO
  const delay = Math.max(1_000, Math.round(intervalMs * failureMultiplier * (1 + jitter)))

  return new Date(now.getTime() + delay)
}

export function readClampedPositiveInteger({
  fallback,
  maximum,
  minimum,
  value,
}: {
  fallback: number
  maximum: number
  minimum: number
  value: string | undefined
}) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.min(maximum, Math.max(minimum, Math.round(parsed)))
}

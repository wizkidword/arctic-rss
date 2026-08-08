import {
  checkSystemHealth,
  type SystemHealthResult,
} from "./system-health"

export const PUBLIC_HEALTH_CACHE_MS = 3_000
export const PUBLIC_HEALTH_MAX_STALE_MS = 30_000

export type HealthSnapshot = {
  checkedAt: number
  durationMs: number
  result: SystemHealthResult | null
  status: "degraded" | "ok" | "unavailable"
}

export type HealthSnapshotSource = "fresh" | "miss" | "stale"

export type HealthSnapshotRead = {
  snapshot: HealthSnapshot
  source: HealthSnapshotSource
}

type HealthCheck = () => Promise<SystemHealthResult>
type HealthClock = () => number

let latestSnapshot: HealthSnapshot | null = null
let refreshPromise: Promise<HealthSnapshot> | null = null

export async function readPublicHealthSnapshot({
  check = checkSystemHealth,
  now = Date.now,
}: {
  check?: HealthCheck
  now?: HealthClock
} = {}): Promise<HealthSnapshotRead> {
  const snapshot = latestSnapshot
  const ageMs = snapshot ? Math.max(0, now() - snapshot.checkedAt) : null

  if (snapshot && ageMs !== null && ageMs <= PUBLIC_HEALTH_CACHE_MS) {
    return { snapshot, source: "fresh" }
  }

  const refresh = startHealthRefresh({ check, now })

  if (
    snapshot &&
    ageMs !== null &&
    ageMs <= PUBLIC_HEALTH_MAX_STALE_MS
  ) {
    void refresh
    return { snapshot, source: "stale" }
  }

  return { snapshot: await refresh, source: "miss" }
}

export async function refreshDetailedHealthSnapshot({
  check = checkSystemHealth,
  now = Date.now,
}: {
  check?: HealthCheck
  now?: HealthClock
} = {}): Promise<HealthSnapshot> {
  return startHealthRefresh({ check, now })
}

export function healthSnapshotAgeMs(snapshot: HealthSnapshot, now = Date.now) {
  return Math.max(0, now() - snapshot.checkedAt)
}

export function resetHealthSnapshotForTests() {
  latestSnapshot = null
  refreshPromise = null
}

function startHealthRefresh({
  check,
  now,
}: {
  check: HealthCheck
  now: HealthClock
}) {
  if (refreshPromise) {
    console.info(JSON.stringify({ event: "public_health_refresh_suppressed" }))
    return refreshPromise
  }

  const startedAt = now()
  const refresh = check()
    .then((result) => ({
      checkedAt: now(),
      durationMs: Math.max(0, now() - startedAt),
      result,
      status: result.status,
    }))
    .catch(() => ({
      checkedAt: now(),
      durationMs: Math.max(0, now() - startedAt),
      result: null,
      status: "unavailable" as const,
    }))
    .then((snapshot) => {
      latestSnapshot = snapshot
      console.info(
        JSON.stringify({
          durationMs: snapshot.durationMs,
          event: "public_health_refresh",
          status: snapshot.status,
        })
      )
      return snapshot
    })

  refreshPromise = refresh.finally(() => {
    if (refreshPromise === pendingRefresh) {
      refreshPromise = null
    }
  })
  const pendingRefresh = refreshPromise

  return pendingRefresh
}

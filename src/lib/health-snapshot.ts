import Redis from "ioredis"

import { durableRedisConnectionOptions } from "./redis-config"
import type { SystemHealthResult } from "./system-health"

export const HEALTH_SNAPSHOT_KEY = "arctic-rss:health-snapshot:v1"
export const HEALTH_SNAPSHOT_VERSION = 1
export const HEALTH_SNAPSHOT_TTL_MS = 60_000
export const HEALTH_SNAPSHOT_MAX_AGE_MS = 45_000
export const PUBLIC_HEALTH_READ_TIMEOUT_MS = 250

export type HealthSnapshotCheckState = "failed" | "ok"
export type HealthSnapshotChatGatewayState = HealthSnapshotCheckState | "disabled"

export type HealthSnapshot = {
  checkedAt: string
  checks: {
    chatGateway: HealthSnapshotChatGatewayState
    database: HealthSnapshotCheckState
    durableRedis: HealthSnapshotCheckState
    ephemeralRedis: HealthSnapshotCheckState
    maintenance: HealthSnapshotCheckState
    queues: HealthSnapshotCheckState
    workers: HealthSnapshotCheckState
  }
  expiresAt: string
  status: "degraded" | "ok"
  topology: string
  version: typeof HEALTH_SNAPSHOT_VERSION
}

export type HealthSnapshotStore = {
  get(key: string): Promise<string | null>
  set(
    key: string,
    value: string,
    expirationMode: "PX",
    ttlMs: number
  ): Promise<unknown>
}

export type PublicHealthSnapshotRead = {
  snapshot: HealthSnapshot | null
  snapshotAgeMs: number | null
  source: "fresh" | "missing" | "stale" | "unavailable"
  status: "degraded" | "ok"
}

type HealthClock = () => number

let publicSnapshotStore: Redis | undefined

/**
 * Converts a detailed worker diagnostic into the compact, shared readiness
 * record consumed by every web replica. The worker status is intentionally
 * collapsed so public storage never grows with the number of worker modes.
 */
export function createHealthSnapshot({
  checkedAt = Date.now(),
  result,
  topology,
  ttlMs = HEALTH_SNAPSHOT_TTL_MS,
}: {
  checkedAt?: number
  result: SystemHealthResult
  topology: string
  ttlMs?: number
}): HealthSnapshot {
  return {
    checkedAt: new Date(checkedAt).toISOString(),
    checks: {
      chatGateway: result.checks.chatGateway,
      database: result.checks.database,
      durableRedis: result.checks.durableRedis,
      ephemeralRedis: result.checks.ephemeralRedis,
      maintenance: result.checks.maintenance,
      queues: result.checks.queues,
      workers: Object.values(result.checks.workers).every((state) => state === "ok")
        ? "ok"
        : "failed",
    },
    expiresAt: new Date(checkedAt + ttlMs).toISOString(),
    status: result.status,
    topology,
    version: HEALTH_SNAPSHOT_VERSION,
  }
}

export async function writeHealthSnapshot({
  checkedAt,
  result,
  store,
  topology,
  ttlMs = HEALTH_SNAPSHOT_TTL_MS,
}: {
  checkedAt?: number
  result: SystemHealthResult
  store: Pick<HealthSnapshotStore, "set">
  topology: string
  ttlMs?: number
}) {
  const snapshot = createHealthSnapshot({ checkedAt, result, topology, ttlMs })

  await store.set(
    HEALTH_SNAPSHOT_KEY,
    JSON.stringify(snapshot),
    "PX",
    ttlMs
  )

  return snapshot
}

/**
 * This path deliberately performs one bounded durable-Redis GET only. It
 * never runs system diagnostics or constructs BullMQ queues from a request.
 */
export async function readPublicHealthSnapshot({
  now = Date.now,
  readTimeoutMs = PUBLIC_HEALTH_READ_TIMEOUT_MS,
  store = getPublicHealthSnapshotStore(),
}: {
  now?: HealthClock
  readTimeoutMs?: number
  store?: Pick<HealthSnapshotStore, "get">
} = {}): Promise<PublicHealthSnapshotRead> {
  try {
    const value = await withDeadline(
      () => store.get(HEALTH_SNAPSHOT_KEY),
      readTimeoutMs
    )
    const snapshot = parseHealthSnapshot(value)

    if (!snapshot) {
      return degradedRead("missing")
    }

    const ageMs = healthSnapshotAgeMs(snapshot, now)

    if (
      ageMs === null ||
      ageMs > HEALTH_SNAPSHOT_MAX_AGE_MS ||
      hasExpired(snapshot, now())
    ) {
      return {
        snapshot,
        snapshotAgeMs: ageMs,
        source: "stale",
        status: "degraded",
      }
    }

    return {
      snapshot,
      snapshotAgeMs: ageMs,
      source: "fresh",
      status: snapshot.status,
    }
  } catch {
    return degradedRead("unavailable")
  }
}

export function healthSnapshotAgeMs(
  snapshot: HealthSnapshot | null,
  now: HealthClock = Date.now
) {
  if (!snapshot) {
    return null
  }

  const checkedAt = Date.parse(snapshot.checkedAt)
  const currentTime = now()

  if (!Number.isFinite(checkedAt) || checkedAt > currentTime) {
    return null
  }

  return currentTime - checkedAt
}

export function resetHealthSnapshotForTests() {
  publicSnapshotStore?.disconnect()
  publicSnapshotStore = undefined
}

function degradedRead(
  source: Extract<PublicHealthSnapshotRead["source"], "missing" | "unavailable">
): PublicHealthSnapshotRead {
  return {
    snapshot: null,
    snapshotAgeMs: null,
    source,
    status: "degraded",
  }
}

function getPublicHealthSnapshotStore() {
  if (!publicSnapshotStore || publicSnapshotStore.status === "end") {
    publicSnapshotStore = new Redis(durableRedisConnectionOptions().url, {
      connectTimeout: PUBLIC_HEALTH_READ_TIMEOUT_MS,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
    })
    publicSnapshotStore.on("error", () => {
      // The public route returns only a sanitized degraded status.
    })
  }

  return publicSnapshotStore
}

function hasExpired(snapshot: HealthSnapshot, now: number) {
  const expiresAt = Date.parse(snapshot.expiresAt)

  return !Number.isFinite(expiresAt) || expiresAt < now
}

function isCheckState(value: unknown): value is HealthSnapshotCheckState {
  return value === "ok" || value === "failed"
}

function parseHealthSnapshot(value: string | null): HealthSnapshot | null {
  if (!value) {
    return null
  }

  try {
    const parsed = JSON.parse(value) as Partial<HealthSnapshot>
    const checks = parsed.checks

    if (
      parsed.version !== HEALTH_SNAPSHOT_VERSION ||
      typeof parsed.topology !== "string" ||
      !parsed.topology ||
      typeof parsed.checkedAt !== "string" ||
      typeof parsed.expiresAt !== "string" ||
      (parsed.status !== "ok" && parsed.status !== "degraded") ||
      !checks ||
      !isCheckState(checks.database) ||
      !isCheckState(checks.durableRedis) ||
      !isCheckState(checks.ephemeralRedis) ||
      !isCheckState(checks.workers) ||
      !isCheckState(checks.maintenance) ||
      !isCheckState(checks.queues) ||
      (checks.chatGateway !== "ok" &&
        checks.chatGateway !== "failed" &&
        checks.chatGateway !== "disabled")
    ) {
      return null
    }

    const checkedAt = Date.parse(parsed.checkedAt)
    const expiresAt = Date.parse(parsed.expiresAt)

    if (!Number.isFinite(checkedAt) || !Number.isFinite(expiresAt) || expiresAt < checkedAt) {
      return null
    }

    return parsed as HealthSnapshot
  } catch {
    return null
  }
}

function withDeadline<T>(operation: () => Promise<T>, timeoutMs: number) {
  const boundedTimeoutMs = Math.max(1, Math.round(timeoutMs))

  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Health snapshot read timed out."))
    }, boundedTimeoutMs)

    Promise.resolve()
      .then(operation)
      .then(
        (value) => {
          clearTimeout(timeout)
          resolve(value)
        },
        (error) => {
          clearTimeout(timeout)
          reject(error)
        }
      )
  })
}

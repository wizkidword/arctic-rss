import Redis from "ioredis"

import { durableRedisConnectionOptions } from "../src/lib/redis-config"

const DEFAULT_RECOVERY_GRACE_MS = 60_000
const MIN_RECOVERY_GRACE_MS = 10_000
const MAX_RECOVERY_GRACE_MS = 10 * 60_000
const MIN_RECONNECT_DELAY_MS = 100
const MAX_RECONNECT_DELAY_MS = 5_000

export type WorkerControlPlaneState =
  | "connecting"
  | "connected"
  | "ready"
  | "reconnecting"
  | "unavailable"
  | "closed"

type ControlPlaneTimer = {
  clearTimeout(timer: ReturnType<typeof setTimeout>): void
  setTimeout(callback: () => void, delayMs: number): ReturnType<typeof setTimeout>
}

export type WorkerControlPlaneClient = {
  disconnect(reconnect?: boolean): void
  on(event: string, listener: (...arguments_: unknown[]) => void): unknown
  quit(): Promise<unknown>
}

type WorkerControlPlaneEvent = {
  client: string
  event: "worker_control_plane_redis"
  state: WorkerControlPlaneState
}

/**
 * Long-lived worker control-plane clients must reconnect: queue work, durable
 * heartbeats, and the maintenance lease cannot truthfully keep a worker alive
 * after a single transient Redis interruption.
 */
export function createWorkerControlPlaneRedis({
  client,
  graceMs = getWorkerControlPlaneRecoveryGraceMs(),
  log = defaultLog,
  name = "durable-redis",
  onGraceExpired,
  random = Math.random,
  timer = globalThis,
  url = durableRedisConnectionOptions().url,
}: {
  client?: WorkerControlPlaneClient
  graceMs?: number
  log?: (event: WorkerControlPlaneEvent) => void
  name?: string
  onGraceExpired?: () => void
  random?: () => number
  timer?: ControlPlaneTimer
  url?: string
} = {}) {
  const boundedGraceMs = clampRecoveryGraceMs(graceMs)
  const redis = (client ??
    new Redis(url, {
      connectTimeout: 2_000,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
      retryStrategy: (attempt) => workerControlPlaneReconnectDelay(attempt, random),
    })) as Redis
  let closed = false
  let graceTimer: ReturnType<typeof setTimeout> | undefined
  let state: WorkerControlPlaneState = "connecting"
  const listeners = new Set<(next: WorkerControlPlaneState) => void>()

  const transition = (next: WorkerControlPlaneState) => {
    if (state === next) {
      return
    }

    state = next
    log({ client: name, event: "worker_control_plane_redis", state: next })
    for (const listener of listeners) {
      listener(next)
    }
  }

  const clearGraceTimer = () => {
    if (graceTimer) {
      timer.clearTimeout(graceTimer)
      graceTimer = undefined
    }
  }

  const becomeUnavailable = () => {
    if (closed) {
      return
    }

    transition("unavailable")
    if (graceTimer) {
      return
    }

    graceTimer = timer.setTimeout(() => {
      graceTimer = undefined
      if (!closed && state !== "ready") {
        onGraceExpired?.()
      }
    }, boundedGraceMs)
  }

  redis.on("connect", () => {
    if (!closed) {
      transition("connected")
    }
  })
  redis.on("ready", () => {
    if (!closed) {
      clearGraceTimer()
      transition("ready")
    }
  })
  redis.on("reconnecting", () => {
    if (!closed) {
      becomeUnavailable()
      transition("reconnecting")
    }
  })
  redis.on("close", becomeUnavailable)
  redis.on("end", becomeUnavailable)
  // ioredis emits an error event for a failed connection attempt. Listening
  // prevents an unhandled EventEmitter error; state changes above are the
  // intentionally low-cardinality operational telemetry.
  redis.on("error", () => undefined)

  return {
    client: redis,
    close: async () => {
      if (closed) {
        return
      }

      closed = true
      clearGraceTimer()
      transition("closed")
      try {
        await redis.quit()
      } catch {
        redis.disconnect(false)
      }
    },
    isReady: () => !closed && state === "ready",
    onStateChange(listener: (next: WorkerControlPlaneState) => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    state: () => state,
  }
}

export function getWorkerControlPlaneRecoveryGraceMs(
  environment: Readonly<Record<string, string | undefined>> = process.env
) {
  const value = environment.WORKER_CONTROL_PLANE_RECOVERY_GRACE_MS?.trim()
  const parsed = value ? Number(value) : DEFAULT_RECOVERY_GRACE_MS

  return clampRecoveryGraceMs(parsed)
}

export function workerControlPlaneReconnectDelay(
  attempt: number,
  random: () => number = Math.random
) {
  const exponentialDelay = Math.min(
    MAX_RECONNECT_DELAY_MS,
    MIN_RECONNECT_DELAY_MS * 2 ** Math.max(0, attempt - 1)
  )
  const jitterMultiplier = 0.8 + Math.min(1, Math.max(0, random())) * 0.4

  return Math.min(MAX_RECONNECT_DELAY_MS, Math.round(exponentialDelay * jitterMultiplier))
}

function clampRecoveryGraceMs(value: number) {
  return Number.isInteger(value) &&
    value >= MIN_RECOVERY_GRACE_MS &&
    value <= MAX_RECOVERY_GRACE_MS
    ? value
    : DEFAULT_RECOVERY_GRACE_MS
}

function defaultLog(event: WorkerControlPlaneEvent) {
  console.warn(JSON.stringify(event))
}

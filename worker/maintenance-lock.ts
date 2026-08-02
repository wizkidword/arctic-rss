import { randomUUID } from "node:crypto"

import Redis from "ioredis"

import { durableRedisConnectionOptions } from "../src/lib/redis-config"

const MAINTENANCE_LOCK_KEY = "arctic-rss:worker:maintenance-lock:v1"
const MAINTENANCE_LOCK_TTL_MS = 5 * 60_000
const MAINTENANCE_LOCK_RENEW_INTERVAL_MS = Math.floor(MAINTENANCE_LOCK_TTL_MS / 3)
const RENEW_LOCK_IF_OWNED = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("pexpire", KEYS[1], ARGV[2])
end
return 0
`
const RELEASE_LOCK_IF_OWNED = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0
`

type MaintenanceLockClient = {
  disconnect(): void
  eval(script: string, keyCount: number, key: string, ...arguments_: string[]): Promise<unknown>
  quit(): Promise<unknown>
  set(
    key: string,
    value: string,
    expirationMode: "PX",
    ttlMs: number,
    condition: "NX"
  ): Promise<"OK" | null>
}
type LeaseLostReason = "ownership_lost" | "renewal_error" | "shutdown"
type MaintenanceLeaseEvent = Record<string, boolean | number | string>
type MaintenanceLeaseTimer = {
  clearInterval(interval: ReturnType<typeof setInterval>): void
  setInterval(callback: () => void, delayMs: number): ReturnType<typeof setInterval>
}

export type MaintenanceLease = {
  assertHeld(): void
  readonly signal: AbortSignal
}

export class MaintenanceLeaseLostError extends Error {
  constructor(readonly reason: LeaseLostReason) {
    super(`Maintenance lease is no longer held: ${reason}`)
    this.name = "MaintenanceLeaseLostError"
  }
}

type ActiveLease = {
  abortController: AbortController
  acquiredAt: number
  lostReason?: LeaseLostReason
  renewalPromise?: Promise<void>
  renewalTimer?: ReturnType<typeof setInterval>
  releasePromise?: Promise<void>
  releasing: boolean
  token: string
}

export function createMaintenanceLock({
  client = new Redis(durableRedisConnectionOptions().url, {
    connectTimeout: 2_000,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
  }),
  log = defaultLog,
  now = Date.now,
  renewIntervalMs = MAINTENANCE_LOCK_RENEW_INTERVAL_MS,
  timer = globalThis,
  tokenFactory = randomUUID,
  ttlMs = MAINTENANCE_LOCK_TTL_MS,
}: {
  client?: MaintenanceLockClient
  log?: (event: MaintenanceLeaseEvent) => void
  now?: () => number
  renewIntervalMs?: number
  timer?: MaintenanceLeaseTimer
  tokenFactory?: () => string
  ttlMs?: number
} = {}) {
  let activeLease: ActiveLease | undefined
  let closed = false

  const record = (event: MaintenanceLeaseEvent) => {
    log({ event: "worker_maintenance_lease", ...event })
  }

  const loseLease = (lease: ActiveLease, reason: LeaseLostReason, extra = {}) => {
    if (lease.lostReason) {
      return
    }

    lease.lostReason = reason
    lease.abortController.abort()
    record({ outcome: "lost", reason, ...extra })
  }

  const stopRenewal = (lease: ActiveLease) => {
    if (lease.renewalTimer) {
      timer.clearInterval(lease.renewalTimer)
    }
  }

  const renew = async (lease: ActiveLease) => {
    if (lease.releasing || lease.lostReason) {
      return
    }

    const startedAt = now()
    try {
      const renewed = await client.eval(
        RENEW_LOCK_IF_OWNED,
        1,
        MAINTENANCE_LOCK_KEY,
        lease.token,
        String(ttlMs)
      )
      const renewalDurationMs = Math.max(0, now() - startedAt)

      if (renewed !== 1) {
        loseLease(lease, "ownership_lost", { renewalDurationMs })
        return
      }

      record({ outcome: "renewed", renewalDurationMs, ttlMs })
    } catch {
      const renewalDurationMs = Math.max(0, now() - startedAt)
      loseLease(lease, "renewal_error", { renewalDurationMs })
    }
  }

  const release = async (lease: ActiveLease) => {
    if (lease.releasePromise) {
      return lease.releasePromise
    }

    lease.releasing = true
    stopRenewal(lease)
    lease.releasePromise = (async () => {
      await lease.renewalPromise
      const leaseDurationMs = Math.max(0, now() - lease.acquiredAt)

      try {
        const released = await client.eval(
          RELEASE_LOCK_IF_OWNED,
          1,
          MAINTENANCE_LOCK_KEY,
          lease.token
        )
        record({
          leaseDurationMs,
          outcome: released === 1 ? "released" : "release_skipped",
          overrun: leaseDurationMs > ttlMs,
        })
      } catch {
        record({ leaseDurationMs, outcome: "release_failed", overrun: leaseDurationMs > ttlMs })
      } finally {
        if (activeLease === lease) {
          activeLease = undefined
        }
      }
    })()

    return lease.releasePromise
  }

  const leaseView = (lease: ActiveLease): MaintenanceLease => ({
    assertHeld() {
      if (lease.lostReason) {
        throw new MaintenanceLeaseLostError(lease.lostReason)
      }
    },
    signal: lease.abortController.signal,
  })

  return {
    async close() {
      closed = true
      if (activeLease) {
        loseLease(activeLease, "shutdown")
        await release(activeLease)
      }

      try {
        await client.quit()
      } catch {
        client.disconnect()
      }
    },
    async run<T>(operation: (lease: MaintenanceLease) => Promise<T>) {
      if (closed || activeLease) {
        record({ outcome: "skipped", reason: closed ? "closed" : "already_running" })
        return { acquired: false as const }
      }

      const token = tokenFactory()
      const acquired = await client.set(
        MAINTENANCE_LOCK_KEY,
        token,
        "PX",
        ttlMs,
        "NX"
      )
      if (acquired !== "OK") {
        record({ outcome: "skipped", reason: "owned_by_another_worker" })
        return { acquired: false as const }
      }

      const lease: ActiveLease = {
        abortController: new AbortController(),
        acquiredAt: now(),
        releasing: false,
        token,
      }
      lease.renewalTimer = timer.setInterval(() => {
        if (lease.renewalPromise) {
          return
        }

        const renewalPromise = renew(lease)
        lease.renewalPromise = renewalPromise
        void renewalPromise.finally(() => {
          if (lease.renewalPromise === renewalPromise) {
            lease.renewalPromise = undefined
          }
        })
      }, renewIntervalMs)
      activeLease = lease
      record({ outcome: "acquired", renewIntervalMs, ttlMs })

      const operationStartedAt = now()
      try {
        const value = await operation(leaseView(lease))
        leaseView(lease).assertHeld()
        const durationMs = Math.max(0, now() - operationStartedAt)
        record({ durationMs, outcome: "completed", overrun: durationMs > ttlMs })
        return { acquired: true as const, value }
      } finally {
        await release(lease)
      }
    },
  }
}

function defaultLog(event: MaintenanceLeaseEvent) {
  console.log(JSON.stringify(event))
}

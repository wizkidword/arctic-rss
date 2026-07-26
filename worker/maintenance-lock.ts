import { randomUUID } from "node:crypto"

import Redis from "ioredis"

import { durableRedisConnectionOptions } from "../src/lib/redis-config"

const MAINTENANCE_LOCK_KEY = "arctic-rss:worker:maintenance-lock:v1"
const MAINTENANCE_LOCK_TTL_MS = 5 * 60_000
const RELEASE_LOCK_IF_OWNED = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0
`

type MaintenanceLockClient = Pick<Redis, "disconnect" | "eval" | "quit" | "set">

export function createMaintenanceLock({
  client = new Redis(durableRedisConnectionOptions().url, {
    connectTimeout: 2_000,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
  }),
  token = randomUUID(),
}: {
  client?: MaintenanceLockClient
  token?: string
} = {}) {
  let held = false

  return {
    async close() {
      if (held) {
        await client.eval(RELEASE_LOCK_IF_OWNED, 1, MAINTENANCE_LOCK_KEY, token)
        held = false
      }

      try {
        await client.quit()
      } catch {
        client.disconnect()
      }
    },
    async run<T>(operation: () => Promise<T>) {
      const acquired = await client.set(
        MAINTENANCE_LOCK_KEY,
        token,
        "PX",
        MAINTENANCE_LOCK_TTL_MS,
        "NX"
      )
      if (acquired !== "OK") {
        return { acquired: false as const }
      }

      held = true
      try {
        return { acquired: true as const, value: await operation() }
      } finally {
        await client.eval(RELEASE_LOCK_IF_OWNED, 1, MAINTENANCE_LOCK_KEY, token)
        held = false
      }
    },
  }
}

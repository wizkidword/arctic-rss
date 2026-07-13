import { getPrisma } from "./db"
import { getFeedRefreshQueue } from "./feed-refresh-queue"

type HealthCheckState = "failed" | "ok"

export const HEALTH_CHECK_TIMEOUT_MS = 1_500

export type SystemHealthResult = {
  checks: {
    database: HealthCheckState
    redis: HealthCheckState
  }
  status: "degraded" | "ok"
}

export async function checkSystemHealth(): Promise<SystemHealthResult> {
  return checkSystemHealthWithClients({
    database: {
      checkConnection: async () => {
        await getPrisma().$queryRaw`SELECT 1`
      },
    },
    queue: {
      checkConnection: async () => {
        // This is one constant-time queue metadata read, not a global scan.
        await getFeedRefreshQueue().getJobCounts("waiting")
      },
    },
  })
}

export async function checkSystemHealthWithClients({
  database,
  queue,
  timeoutMs = HEALTH_CHECK_TIMEOUT_MS,
}: {
  database: {
    checkConnection(): Promise<void>
  }
  queue: {
    checkConnection(): Promise<void>
  }
  timeoutMs?: number
}): Promise<SystemHealthResult> {
  const boundedTimeoutMs = Math.max(1, Math.round(timeoutMs))
  const [databaseResult, redisResult] = await Promise.allSettled([
    checkWithDeadline(database.checkConnection, boundedTimeoutMs),
    checkWithDeadline(queue.checkConnection, boundedTimeoutMs),
  ])
  const checks = {
    database:
      databaseResult.status === "fulfilled"
        ? ("ok" as const)
        : ("failed" as const),
    redis:
      redisResult.status === "fulfilled"
        ? ("ok" as const)
        : ("failed" as const),
  }

  return {
    checks,
    status:
      checks.database === "ok" && checks.redis === "ok" ? "ok" : "degraded",
  }
}

function checkWithDeadline(
  operation: () => Promise<void>,
  timeoutMs: number
) {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Health check timed out."))
    }, timeoutMs)

    Promise.resolve()
      .then(operation)
      .then(
        () => {
          clearTimeout(timeout)
          resolve()
        },
        (error) => {
          clearTimeout(timeout)
          reject(error)
        }
      )
  })
}

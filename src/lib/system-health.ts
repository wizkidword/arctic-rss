import { getPrisma } from "./db"
import { getFeedRefreshQueue } from "./feed-refresh-queue"

type HealthCheckState = "failed" | "ok"

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
      countUsers: () => getPrisma().user.count(),
    },
    queue: {
      checkConnection: async () => {
        await getFeedRefreshQueue().getJobCounts("waiting")
      },
    },
  })
}

export async function checkSystemHealthWithClients({
  database,
  queue,
}: {
  database: {
    countUsers(): Promise<number>
  }
  queue: {
    checkConnection(): Promise<void>
  }
}): Promise<SystemHealthResult> {
  const [databaseResult, redisResult] = await Promise.allSettled([
    database.countUsers(),
    queue.checkConnection(),
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

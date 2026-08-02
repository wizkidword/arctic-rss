import Redis from "ioredis"

import { getPrisma } from "./db"
import {
  durableRedisConnectionOptions,
  ephemeralRedisConnectionOptions,
} from "./redis-config"
import { inspectQueueReadiness } from "./queue-readiness"
import {
  getRuntimeTopology,
  type RuntimeTopology,
} from "./runtime-topology"
import {
  isFreshDurableWorkerHeartbeat,
  maintenanceTickMaxAgeMs,
  readDurableMaintenanceTick,
  readDurableWorkerHeartbeats,
  type DurableWorkerHeartbeat,
} from "./worker-health"
import type { WorkerMode } from "../../worker/mode"

export type HealthCheckState = "failed" | "ok"
export type ChatGatewayHealthState = HealthCheckState | "disabled"

export const HEALTH_CHECK_TIMEOUT_MS = 1_500

export type SystemHealthResult = {
  checks: {
    chatGateway: ChatGatewayHealthState
    database: HealthCheckState
    durableRedis: HealthCheckState
    ephemeralRedis: HealthCheckState
    maintenance: HealthCheckState
    queues: HealthCheckState
    workers: Partial<Record<WorkerMode, HealthCheckState>>
  }
  status: "degraded" | "ok"
}

type HealthConnection = {
  checkConnection(): Promise<void>
}

type WorkerHeartbeatReader = {
  readMaintenanceTick(mode: WorkerMode): Promise<DurableWorkerHeartbeat | undefined>
  readWorkerHeartbeats(
    modes: readonly WorkerMode[]
  ): Promise<Record<string, DurableWorkerHeartbeat | undefined>>
}

type SystemHealthClients = {
  chatGateway: HealthConnection
  database: HealthConnection
  durableRedis: HealthConnection
  ephemeralRedis: HealthConnection
  queueReadiness: HealthConnection
  workerHeartbeats: WorkerHeartbeatReader
}

export async function checkSystemHealth(): Promise<SystemHealthResult> {
  const topology = getRuntimeTopology()
  const durableRedis = createHealthRedis(durableRedisConnectionOptions().url)
  const ephemeralRedis = createHealthRedis(ephemeralRedisConnectionOptions().url)

  try {
    return await checkSystemHealthWithClients({
      chatGateway: {
        checkConnection: () => checkChatGatewayReadiness(),
      },
      database: {
        checkConnection: async () => {
          await getPrisma().$queryRaw`SELECT 1`
        },
      },
      durableRedis: {
        checkConnection: async () => {
          await durableRedis.ping()
        },
      },
      ephemeralRedis: {
        checkConnection: async () => {
          await ephemeralRedis.ping()
        },
      },
      queueReadiness: {
        checkConnection: async () => {
          const readiness = await inspectQueueReadiness()

          if (!readiness.ready) {
            throw new Error("Queue readiness check failed.")
          }
        },
      },
      workerHeartbeats: {
        readMaintenanceTick: (mode) =>
          readDurableMaintenanceTick({ client: durableRedis, mode }),
        readWorkerHeartbeats: (modes) =>
          readDurableWorkerHeartbeats({ client: durableRedis, modes }),
      },
      topology,
    })
  } finally {
    durableRedis.disconnect()
    ephemeralRedis.disconnect()
  }
}

export async function checkSystemHealthWithClients({
  chatGateway,
  database,
  durableRedis,
  ephemeralRedis,
  now = Date.now,
  queueReadiness,
  timeoutMs = HEALTH_CHECK_TIMEOUT_MS,
  topology = getRuntimeTopology(),
  workerHeartbeats,
}: SystemHealthClients & {
  now?: () => number
  timeoutMs?: number
  topology?: RuntimeTopology
}): Promise<SystemHealthResult> {
  const boundedTimeoutMs = Math.max(1, Math.round(timeoutMs))
  const maintenanceMode: WorkerMode = topology.workerModes.some(
    (mode) => mode === "all"
  )
    ? "all"
    : "maintenance"
  const [databaseResult, durableRedisResult, ephemeralRedisResult, queueReadinessResult, heartbeatsResult, maintenanceResult, chatGatewayResult] =
    await Promise.allSettled([
      checkWithDeadline(database.checkConnection, boundedTimeoutMs),
      checkWithDeadline(durableRedis.checkConnection, boundedTimeoutMs),
      checkWithDeadline(ephemeralRedis.checkConnection, boundedTimeoutMs),
      checkWithDeadline(queueReadiness.checkConnection, boundedTimeoutMs),
      checkWithDeadline(
        () => workerHeartbeats.readWorkerHeartbeats(topology.workerModes),
        boundedTimeoutMs
      ),
      checkWithDeadline(
        () => workerHeartbeats.readMaintenanceTick(maintenanceMode),
        boundedTimeoutMs
      ),
      topology.chatEnabled
        ? checkWithDeadline(chatGateway.checkConnection, boundedTimeoutMs)
        : Promise.resolve(),
    ])

  const workers = Object.fromEntries(
    topology.workerModes.map((mode) => [
      mode,
      heartbeatsResult.status === "fulfilled" &&
      isFreshDurableWorkerHeartbeat(heartbeatsResult.value[mode], { now })
        ? "ok"
        : "failed",
    ])
  ) as Partial<Record<WorkerMode, HealthCheckState>>
  const checks = {
    chatGateway: topology.chatEnabled
      ? chatGatewayResult.status === "fulfilled"
        ? ("ok" as const)
        : ("failed" as const)
      : ("disabled" as const),
    database: toHealthCheckState(databaseResult),
    durableRedis: toHealthCheckState(durableRedisResult),
    ephemeralRedis: toHealthCheckState(ephemeralRedisResult),
    maintenance:
      maintenanceResult.status === "fulfilled" &&
      isFreshDurableWorkerHeartbeat(maintenanceResult.value, {
        maximumAgeMs: maintenanceTickMaxAgeMs(),
        now,
      })
        ? ("ok" as const)
        : ("failed" as const),
    queues: toHealthCheckState(queueReadinessResult),
    workers,
  }

  return {
    checks,
    status:
      checks.database === "ok" &&
      checks.durableRedis === "ok" &&
      checks.ephemeralRedis === "ok" &&
      checks.maintenance === "ok" &&
      checks.queues === "ok" &&
      checks.chatGateway !== "failed" &&
      Object.values(checks.workers).every((check) => check === "ok")
        ? "ok"
        : "degraded",
  }
}

function createHealthRedis(url: string) {
  const redis = new Redis(url, {
    connectTimeout: HEALTH_CHECK_TIMEOUT_MS,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
  })

  redis.on("error", () => {
    // The public route returns only its sanitized status after this operation.
  })

  return redis
}

async function checkChatGatewayReadiness() {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS)

  try {
    const response = await fetch(
      process.env.CHAT_GATEWAY_READINESS_URL?.trim() ||
        "http://chat-gateway:3001/ready",
      { cache: "no-store", signal: controller.signal }
    )

    if (!response.ok) {
      throw new Error("Chat gateway is unavailable.")
    }
  } finally {
    clearTimeout(timeout)
  }
}

function toHealthCheckState(result: PromiseSettledResult<unknown>): HealthCheckState {
  return result.status === "fulfilled" ? "ok" : "failed"
}

function checkWithDeadline<T>(
  operation: () => Promise<T>,
  timeoutMs: number
) {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Health check timed out."))
    }, timeoutMs)

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

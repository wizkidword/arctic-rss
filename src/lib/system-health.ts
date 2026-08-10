import Redis from "ioredis"

import { getPrisma } from "./db"
import {
  durableRedisConnectionOptions,
  ephemeralRedisConnectionOptions,
} from "./redis-config"
import { inspectQueueReadiness } from "./queue-readiness"
import {
  inspectSourceRefreshReliabilityWithStore,
  unavailableSourceRefreshReliability,
  type SourceRefreshReliabilityReport,
} from "./source-refresh-reliability"
import { getRuntimeTopology, type RuntimeTopology } from "./runtime-topology"
import {
  ESSENTIAL_SCHEDULED_RESPONSIBILITIES,
  isFreshDurableWorkerHeartbeat,
  maintenanceTickMaxAgeMs,
  readDurableResponsibilityTicks,
  readDurableWorkerHeartbeats,
  type DurableWorkerHeartbeat,
  type ScheduledResponsibility,
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
    maintenanceResponsibilities: Partial<
      Record<ScheduledResponsibility, HealthCheckState>
    >
    queues: HealthCheckState
    workers: Partial<Record<WorkerMode, HealthCheckState>>
  }
  sourceReliability: SourceRefreshReliabilityReport
  status: "degraded" | "ok"
}

type HealthConnection = {
  checkConnection(): Promise<void>
}

type WorkerHeartbeatReader = {
  readMaintenanceTicks(
    responsibilities: readonly ScheduledResponsibility[]
  ): Promise<Partial<Record<ScheduledResponsibility, DurableWorkerHeartbeat>>>
  readWorkerHeartbeats(
    modes: readonly WorkerMode[]
  ): Promise<Record<string, DurableWorkerHeartbeat | undefined>>
}

type SourceReliabilityReader = {
  inspect(): Promise<SourceRefreshReliabilityReport>
}

type SystemHealthClients = {
  chatGateway: HealthConnection
  database: HealthConnection
  durableRedis: HealthConnection
  ephemeralRedis: HealthConnection
  queueReadiness: HealthConnection
  sourceReliability: SourceReliabilityReader
  workerHeartbeats: WorkerHeartbeatReader
}

export async function checkSystemHealth(): Promise<SystemHealthResult> {
  const topology = getRuntimeTopology()
  const durableRedis = createHealthRedis(durableRedisConnectionOptions().url)
  const ephemeralRedis = createHealthRedis(
    ephemeralRedisConnectionOptions().url
  )

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
      sourceReliability: {
        inspect: () =>
          inspectSourceRefreshReliabilityWithStore({ store: durableRedis }),
      },
      workerHeartbeats: {
        readMaintenanceTicks: (responsibilities) =>
          readDurableResponsibilityTicks({
            client: durableRedis,
            responsibilities,
          }),
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
  sourceReliability: sourceReliabilityReader,
  timeoutMs = HEALTH_CHECK_TIMEOUT_MS,
  topology = getRuntimeTopology(),
  workerHeartbeats,
}: SystemHealthClients & {
  now?: () => number
  timeoutMs?: number
  topology?: RuntimeTopology
}): Promise<SystemHealthResult> {
  const boundedTimeoutMs = Math.max(1, Math.round(timeoutMs))
  const essentialResponsibilities =
    ESSENTIAL_SCHEDULED_RESPONSIBILITIES[topology.name]
  const [
    databaseResult,
    durableRedisResult,
    ephemeralRedisResult,
    queueReadinessResult,
    sourceReliabilityResult,
    heartbeatsResult,
    maintenanceTicksResult,
    chatGatewayResult,
  ] = await Promise.allSettled([
    checkWithDeadline(database.checkConnection, boundedTimeoutMs),
    checkWithDeadline(durableRedis.checkConnection, boundedTimeoutMs),
    checkWithDeadline(ephemeralRedis.checkConnection, boundedTimeoutMs),
    checkWithDeadline(queueReadiness.checkConnection, boundedTimeoutMs),
    checkWithDeadline(sourceReliabilityReader.inspect, boundedTimeoutMs),
    checkWithDeadline(
      () => workerHeartbeats.readWorkerHeartbeats(topology.workerModes),
      boundedTimeoutMs
    ),
    checkWithDeadline(
      () => workerHeartbeats.readMaintenanceTicks(essentialResponsibilities),
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
  const maintenanceResponsibilities = Object.fromEntries(
    essentialResponsibilities.map((responsibility) => [
      responsibility,
      maintenanceTicksResult.status === "fulfilled" &&
      isFreshDurableWorkerHeartbeat(
        maintenanceTicksResult.value[responsibility],
        {
          maximumAgeMs: maintenanceTickMaxAgeMs(),
          now,
        }
      )
        ? "ok"
        : "failed",
    ])
  ) as Partial<Record<ScheduledResponsibility, HealthCheckState>>
  const checks = {
    chatGateway: topology.chatEnabled
      ? chatGatewayResult.status === "fulfilled"
        ? ("ok" as const)
        : ("failed" as const)
      : ("disabled" as const),
    database: toHealthCheckState(databaseResult),
    durableRedis: toHealthCheckState(durableRedisResult),
    ephemeralRedis: toHealthCheckState(ephemeralRedisResult),
    maintenance: Object.values(maintenanceResponsibilities).every(
      (check) => check === "ok"
    )
      ? ("ok" as const)
      : ("failed" as const),
    maintenanceResponsibilities,
    queues: toHealthCheckState(queueReadinessResult),
    workers,
  }
  const sourceReliability =
    sourceReliabilityResult.status === "fulfilled"
      ? sourceReliabilityResult.value
      : unavailableSourceRefreshReliability()

  return {
    checks,
    sourceReliability,
    status:
      checks.database === "ok" &&
      checks.durableRedis === "ok" &&
      checks.ephemeralRedis === "ok" &&
      checks.maintenance === "ok" &&
      checks.queues === "ok" &&
      checks.chatGateway !== "failed" &&
      sourceReliability.platformImpact !== "degraded" &&
      Object.values(checks.workers).every((check) => check === "ok")
        ? "ok"
        : "degraded",
  }
}

function createHealthRedis(url: string) {
  const redis = new Redis(url, {
    connectTimeout: HEALTH_CHECK_TIMEOUT_MS,
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

function toHealthCheckState(
  result: PromiseSettledResult<unknown>
): HealthCheckState {
  return result.status === "fulfilled" ? "ok" : "failed"
}

function checkWithDeadline<T>(operation: () => Promise<T>, timeoutMs: number) {
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

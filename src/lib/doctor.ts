import { stat } from "node:fs/promises"
import { execFile } from "node:child_process"
import { promisify } from "node:util"

import Redis from "ioredis"

import {
  assertSecureProductionConfiguration,
  PRODUCTION_SERVICE_ROLES,
  type ProductionServiceRole,
} from "./production-security"
import { inspectQueueReadiness } from "./queue-readiness"
import { durableRedisConnectionOptions } from "./redis-config"
import { getRuntimeTopology } from "./runtime-topology"
import {
  isFreshDurableWorkerHeartbeat,
  maintenanceTickMaxAgeMs,
  readDurableMaintenanceTick,
  readDurableWorkerHeartbeats,
} from "./worker-health"
import type { WorkerMode } from "../../worker/mode"

const execFileAsync = promisify(execFile)

type DoctorEnvironment = Readonly<Record<string, string | undefined>>

export type DoctorReport = {
  backupMetadata: { ageMs: number | null; status: "available" | "unconfigured" | "unavailable" }
  chatGateway: "disabled" | "failed" | "ok" | "unavailable"
  databaseRoles: { migration: string | null; runtime: string | null }
  migrationStatus: "not-configured" | "pending-or-unavailable" | "up-to-date"
  queueReadiness: Awaited<ReturnType<typeof inspectQueueReadiness>>
  redisSeparation: "distinct" | "invalid" | "shared" | "unconfigured"
  requiredVariables: Record<string, "configured" | "missing">
  securityBoundary: {
    errors: string[]
    status: "failed" | "not-applicable" | "ok"
  }
  topology: { chatEnabled: boolean; name: string; workerModes: readonly WorkerMode[] } | null
  workerHeartbeats: Record<string, { ageMs: number | null; fresh: boolean }>
  maintenanceTick: { ageMs: number | null; fresh: boolean }
}

export const DOCTOR_REQUIRED_VARIABLES: Record<ProductionServiceRole, readonly string[]> = {
  "chat-gateway": ["DATABASE_URL", "EPHEMERAL_REDIS_URL", "ARCTIC_IRC_TOKEN_SECRET"],
  web: [
    "DATABASE_URL",
    "DURABLE_REDIS_URL",
    "EPHEMERAL_REDIS_URL",
    "AUTH_SECRET",
    "AUTH_URL",
    "APP_ORIGIN",
  ],
  "worker-ai-mail": ["DATABASE_URL", "DURABLE_REDIS_URL"],
  "worker-all": ["DATABASE_URL", "DURABLE_REDIS_URL", "EPHEMERAL_REDIS_URL"],
  "worker-chat-events": ["DATABASE_URL", "DURABLE_REDIS_URL", "EPHEMERAL_REDIS_URL"],
  "worker-imports": ["DATABASE_URL", "DURABLE_REDIS_URL"],
  "worker-ingestion": ["DATABASE_URL", "DURABLE_REDIS_URL"],
  "worker-maintenance": ["DATABASE_URL", "DURABLE_REDIS_URL"],
}

export async function collectDoctorReport(
  environment: DoctorEnvironment = process.env
): Promise<DoctorReport> {
  const role = resolveDoctorServiceRole(environment)
  const requiredVariables: DoctorReport["requiredVariables"] = Object.fromEntries(
    DOCTOR_REQUIRED_VARIABLES[role].map((variable) => [
      variable,
      environment[variable]?.trim() ? ("configured" as const) : ("missing" as const),
    ] as const)
  )
  const topology = safelyGetTopology(environment)
  const [queueReadiness, migrationStatus, backupMetadata] = await Promise.all([
    inspectQueueReadiness().catch(() => unavailableQueueReadiness()),
    inspectMigrationStatus(environment),
    inspectBackupMetadata(environment),
  ])
  const heartbeatStatus = await inspectHeartbeatStatus(environment, topology?.workerModes ?? [])

  return {
    backupMetadata,
    chatGateway: await inspectChatGateway(topology?.chatEnabled ?? false, environment),
    databaseRoles: {
      migration: databaseRole(environment.MIGRATE_DATABASE_URL),
      runtime: databaseRole(environment.DATABASE_URL),
    },
    maintenanceTick: heartbeatStatus.maintenanceTick,
    migrationStatus,
    queueReadiness,
    redisSeparation: describeRedisSeparation(environment),
    requiredVariables,
    securityBoundary: inspectSecurityBoundary(environment, role),
    topology,
    workerHeartbeats: heartbeatStatus.workerHeartbeats,
  }
}

export function describeRedisSeparation(environment: DoctorEnvironment) {
  const durable = environment.DURABLE_REDIS_URL?.trim()
  const ephemeral = environment.EPHEMERAL_REDIS_URL?.trim()

  if (!durable || !ephemeral) {
    return "unconfigured" as const
  }

  try {
    return normalizedRedisEndpoint(durable) === normalizedRedisEndpoint(ephemeral)
      ? ("shared" as const)
      : ("distinct" as const)
  } catch {
    return "invalid" as const
  }
}

function resolveDoctorServiceRole(environment: DoctorEnvironment): ProductionServiceRole {
  const role = environment.ARCTIC_RSS_SERVICE_ROLE?.trim()

  return (PRODUCTION_SERVICE_ROLES as readonly string[]).includes(role ?? "")
    ? (role as ProductionServiceRole)
    : "web"
}

function safelyGetTopology(environment: DoctorEnvironment) {
  try {
    const topology = getRuntimeTopology(environment)

    return {
      chatEnabled: topology.chatEnabled,
      name: topology.name,
      workerModes: topology.workerModes,
    }
  } catch {
    return null
  }
}

function inspectSecurityBoundary(
  environment: DoctorEnvironment,
  role: ProductionServiceRole
) {
  if (environment.NODE_ENV !== "production") {
    return { errors: [], status: "not-applicable" as const }
  }

  try {
    assertSecureProductionConfiguration(environment, role)
    return { errors: [], status: "ok" as const }
  } catch (error) {
    return {
      errors: [
        error instanceof Error
          ? redactDoctorError(error.message)
          : "Production configuration validation failed.",
      ],
      status: "failed" as const,
    }
  }
}

async function inspectChatGateway(
  chatEnabled: boolean,
  environment: DoctorEnvironment
) {
  if (!chatEnabled) {
    return "disabled" as const
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 1_500)

  try {
    const response = await fetch(
      environment.CHAT_GATEWAY_READINESS_URL?.trim() ||
        "http://chat-gateway:3001/ready",
      { cache: "no-store", signal: controller.signal }
    )

    return response.ok ? ("ok" as const) : ("failed" as const)
  } catch {
    return "unavailable" as const
  } finally {
    clearTimeout(timeout)
  }
}

async function inspectHeartbeatStatus(
  environment: DoctorEnvironment,
  modes: readonly WorkerMode[]
) {
  const unavailable = {
    maintenanceTick: { ageMs: null, fresh: false },
    workerHeartbeats: Object.fromEntries(
      modes.map((mode) => [mode, { ageMs: null, fresh: false }])
    ),
  }

  try {
    const redis = new Redis(durableRedisConnectionOptions(environment).url, {
      connectTimeout: 2_000,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
    })
    redis.on("error", () => {})

    try {
      const now = Date.now()
      const maintenanceMode: WorkerMode = modes.some((mode) => mode === "all")
        ? "all"
        : "maintenance"
      const [heartbeats, maintenanceTick] = await Promise.all([
        readDurableWorkerHeartbeats({ client: redis, modes }),
        readDurableMaintenanceTick({ client: redis, mode: maintenanceMode }),
      ])

      return {
        maintenanceTick: heartbeatAge(maintenanceTick, now, maintenanceTickMaxAgeMs(environment)),
        workerHeartbeats: Object.fromEntries(
          modes.map((mode) => [mode, heartbeatAge(heartbeats[mode], now)])
        ),
      }
    } finally {
      redis.disconnect()
    }
  } catch {
    return unavailable
  }
}

function heartbeatAge(
  heartbeat: Awaited<ReturnType<typeof readDurableMaintenanceTick>>,
  now: number,
  maximumAgeMs?: number
) {
  const ageMs = heartbeat && heartbeat.timestamp <= now ? now - heartbeat.timestamp : null

  return {
    ageMs,
    fresh: isFreshDurableWorkerHeartbeat(heartbeat, { maximumAgeMs, now: () => now }),
  }
}

async function inspectMigrationStatus(environment: DoctorEnvironment) {
  const migrationUrl = environment.MIGRATE_DATABASE_URL?.trim()

  if (!migrationUrl) {
    return "not-configured" as const
  }

  try {
    await execFileAsync(
      process.execPath,
      ["node_modules/prisma/build/index.js", "migrate", "status"],
      {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: migrationUrl },
        windowsHide: true,
      }
    )
    return "up-to-date" as const
  } catch {
    return "pending-or-unavailable" as const
  }
}

async function inspectBackupMetadata(environment: DoctorEnvironment) {
  const metadataPath = environment.ARCTIC_RSS_BACKUP_METADATA_PATH?.trim()

  if (!metadataPath) {
    return { ageMs: null, status: "unconfigured" as const }
  }

  try {
    const metadata = await stat(metadataPath)
    return {
      ageMs: Math.max(0, Date.now() - metadata.mtimeMs),
      status: "available" as const,
    }
  } catch {
    return { ageMs: null, status: "unavailable" as const }
  }
}

function databaseRole(value: string | undefined) {
  if (!value?.trim()) {
    return null
  }

  try {
    return new URL(value).username || null
  } catch {
    return null
  }
}

function normalizedRedisEndpoint(value: string) {
  const url = new URL(value)
  const database = url.pathname.replace(/^\/+/, "") || "0"

  return `${url.protocol.toLowerCase()}//${url.hostname.toLowerCase().replace(/\.$/, "")}:${url.port || "6379"}/${database}`
}

function redactDoctorError(message: string) {
  // Configuration validators must never include values, but preserve only a
  // bounded diagnostic string if a future validation path changes that rule.
  return message.replace(/:\/\/[^\s]+/g, "[redacted-url]").slice(0, 300)
}

function unavailableQueueReadiness(): Awaited<ReturnType<typeof inspectQueueReadiness>> {
  return {
    available: false,
    oldestActiveJobAgeMs: null,
    oldestWaitingJobAgeMs: null,
    recentFailureCount: 0,
    ready: false,
    suspectedStalledJobCount: 0,
    totalActive: 0,
    totalWaiting: 0,
  }
}

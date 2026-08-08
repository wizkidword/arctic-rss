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
import { getServiceRoleEnvironment } from "./service-role-environment"
import {
  isFreshDurableWorkerHeartbeat,
  maintenanceTickMaxAgeMs,
  readDurableMaintenanceTick,
  readDurableWorkerHeartbeats,
} from "./worker-health"
import type { WorkerMode } from "../../worker/mode"

const execFileAsync = promisify(execFile)

type DoctorEnvironment = Readonly<Record<string, string | undefined>>

export type DoctorScope = "host" | "migrations" | "release" | "runtime"
export type DoctorCheckStatus = "FAILURE" | "NOT_APPLICABLE" | "OK" | "WARNING"

export type RedisServerIdentityReport = {
  durableDatabase: string | null
  durableRole: string | null
  ephemeralDatabase: string | null
  ephemeralRole: string | null
  status:
    | "not-checked"
    | "not-configured"
    | "same-server"
    | "separate-servers"
    | "unavailable"
}

export type DoctorEvaluation = {
  checks: Array<{
    name: string
    required: boolean
    status: DoctorCheckStatus
  }>
  exitCode: 0 | 1
  warnOnly: boolean
}

export type DoctorCommand = {
  role?: string
  scope: DoctorScope
  topology?: string
  warnOnly: boolean
}

export type DoctorReport = {
  backupMetadata: { ageMs: number | null; status: "available" | "unconfigured" | "unavailable" }
  chatGateway: "disabled" | "failed" | "ok" | "unavailable"
  databaseRoles: { migration: string | null; runtime: string | null }
  migrationStatus: "not-configured" | "pending-or-unavailable" | "up-to-date"
  queueReadiness: Awaited<ReturnType<typeof inspectQueueReadiness>>
  redisIdentity: RedisServerIdentityReport
  redisSeparation: "distinct" | "invalid" | "shared" | "unconfigured"
  requiredVariables: Record<string, "configured" | "missing">
  securityBoundary: {
    errors: string[]
    status: "failed" | "not-applicable" | "ok"
  }
  serviceRole: ProductionServiceRole | null
  scope: DoctorScope
  topology: { chatEnabled: boolean; name: string; workerModes: readonly WorkerMode[] } | null
  workerHeartbeats: Record<string, { ageMs: number | null; fresh: boolean }>
  maintenanceTick: { ageMs: number | null; fresh: boolean }
}

export const DOCTOR_REQUIRED_VARIABLES: Record<ProductionServiceRole, readonly string[]> =
  Object.fromEntries(
    PRODUCTION_SERVICE_ROLES.map((role) => [role, getServiceRoleEnvironment(role).required])
  ) as unknown as Record<ProductionServiceRole, readonly string[]>

export async function collectDoctorReport(
  environment: DoctorEnvironment = process.env,
  { scope = "runtime" }: { scope?: DoctorScope } = {}
): Promise<DoctorReport> {
  const role = resolveDoctorServiceRole(environment)
  const requiredVariables: DoctorReport["requiredVariables"] = Object.fromEntries(
    (role ? DOCTOR_REQUIRED_VARIABLES[role] : []).map((variable) => [
      variable,
      environment[variable]?.trim() ? ("configured" as const) : ("missing" as const),
    ] as const)
  )
  const topology = safelyGetTopology(environment)
  const includeRuntimeDiagnostics = scope === "runtime" || scope === "release"
  const includeHostDiagnostics = scope === "host" || scope === "release"
  const includeMigrationDiagnostics = scope === "migrations" || scope === "release"
  const [queueReadiness, migrationStatus, backupMetadata, redisIdentity] = await Promise.all([
    includeRuntimeDiagnostics
      ? inspectQueueReadiness().catch(() => unavailableQueueReadiness())
      : Promise.resolve(unavailableQueueReadiness()),
    includeMigrationDiagnostics
      ? inspectMigrationStatus(environment)
      : Promise.resolve("not-configured" as const),
    includeHostDiagnostics
      ? inspectBackupMetadata(environment)
      : Promise.resolve({ ageMs: null, status: "unconfigured" as const }),
    includeHostDiagnostics
      ? inspectRedisServerIdentity(environment)
      : Promise.resolve({
          durableDatabase: null,
          durableRole: null,
          ephemeralDatabase: null,
          ephemeralRole: null,
          status: "not-checked" as const,
        }),
  ])
  const heartbeatStatus = includeRuntimeDiagnostics
    ? await inspectHeartbeatStatus(environment, topology?.workerModes ?? [])
    : {
        maintenanceTick: { ageMs: null, fresh: false },
        workerHeartbeats: {},
      }

  return {
    backupMetadata,
    chatGateway: includeRuntimeDiagnostics
      ? await inspectChatGateway(topology?.chatEnabled ?? false, environment)
      : "disabled",
    databaseRoles: {
      migration: databaseRole(environment.MIGRATE_DATABASE_URL),
      runtime: databaseRole(environment.DATABASE_URL),
    },
    maintenanceTick: heartbeatStatus.maintenanceTick,
    migrationStatus,
    queueReadiness,
    redisSeparation: describeRedisSeparation(environment),
    redisIdentity,
    requiredVariables,
    securityBoundary: inspectSecurityBoundary(environment, role),
    serviceRole: role,
    scope,
    topology,
    workerHeartbeats: heartbeatStatus.workerHeartbeats,
  }
}

export function parseDoctorCommand(args: readonly string[]): DoctorCommand {
  const [firstArgument, ...remainingArguments] = args
  const scope = firstArgument?.startsWith("--") || !firstArgument
    ? "runtime"
    : firstArgument
  const options = firstArgument?.startsWith("--") ? args : remainingArguments

  if (!isDoctorScope(scope)) {
    throw new Error("Unknown doctor scope.")
  }

  const command: DoctorCommand = { scope, warnOnly: false }

  for (let index = 0; index < options.length; index += 1) {
    const option = options[index]

    if (option === "--warn-only") {
      command.warnOnly = true
      continue
    }

    if (option === "--role" || option === "--topology") {
      const value = options[index + 1]?.trim()

      if (!value || value.startsWith("--")) {
        throw new Error(`${option} requires a value.`)
      }

      if (option === "--role") {
        command.role = value
      } else {
        command.topology = value
      }
      index += 1
      continue
    }

    throw new Error("Unknown doctor option.")
  }

  return command
}

export function evaluateDoctorReport(
  report: DoctorReport,
  { warnOnly = false }: { warnOnly?: boolean } = {}
): DoctorEvaluation {
  const checks: DoctorEvaluation["checks"] = []
  const includesRuntime = report.scope === "runtime" || report.scope === "release"
  const includesHost = report.scope === "host" || report.scope === "release"
  const includesMigrations = report.scope === "migrations" || report.scope === "release"
  const usesDurableRedis = report.serviceRole
    ? DOCTOR_REQUIRED_VARIABLES[report.serviceRole].includes("DURABLE_REDIS_URL")
    : false
  const usesBothRedisWorkloads = report.serviceRole
    ? DOCTOR_REQUIRED_VARIABLES[report.serviceRole].includes("DURABLE_REDIS_URL") &&
      DOCTOR_REQUIRED_VARIABLES[report.serviceRole].includes("EPHEMERAL_REDIS_URL")
    : false

  if (includesRuntime) {
    checks.push({
      name: "runtime.service-role",
      required: true,
      status: report.serviceRole ? "OK" : "FAILURE",
    })
    checks.push({
      name: "runtime.topology",
      required: true,
      status: report.topology ? "OK" : "FAILURE",
    })
    checks.push({
      name: "runtime.security-boundary",
      required: report.securityBoundary.status !== "not-applicable",
      status:
        report.securityBoundary.status === "failed"
          ? "FAILURE"
          : report.securityBoundary.status === "ok"
            ? "OK"
            : "NOT_APPLICABLE",
    })

    for (const [variable, status] of Object.entries(report.requiredVariables)) {
      checks.push({
        name: `runtime.variable.${variable}`,
        required: true,
        status: status === "configured" ? "OK" : "FAILURE",
      })
    }

    checks.push({
      name: "runtime.queue-readiness",
      required: usesDurableRedis,
      status: !usesDurableRedis
        ? "NOT_APPLICABLE"
        : report.queueReadiness.ready
          ? "OK"
          : "FAILURE",
    })
    checks.push({
      name: "runtime.worker-heartbeats",
      required: usesDurableRedis,
      status: !usesDurableRedis
        ? "NOT_APPLICABLE"
        : Object.values(report.workerHeartbeats).every((heartbeat) => heartbeat.fresh)
          ? "OK"
          : "FAILURE",
    })
    checks.push({
      name: "runtime.maintenance-tick",
      required: usesDurableRedis,
      status: !usesDurableRedis
        ? "NOT_APPLICABLE"
        : report.maintenanceTick.fresh
          ? "OK"
          : "FAILURE",
    })
    checks.push({
      name: "runtime.chat-gateway",
      required: report.topology?.chatEnabled === true,
      status:
        report.topology?.chatEnabled !== true
          ? "NOT_APPLICABLE"
          : report.chatGateway === "ok"
            ? "OK"
            : "FAILURE",
    })
    checks.push({
      name: "runtime.redis-url-separation",
      required: usesBothRedisWorkloads,
      status: !usesBothRedisWorkloads
        ? "NOT_APPLICABLE"
        : report.redisSeparation === "distinct"
          ? "OK"
          : "FAILURE",
    })
  }

  if (includesHost) {
    checks.push({
      name: "host.backup-metadata",
      required: true,
      status: report.backupMetadata.status === "available" ? "OK" : "FAILURE",
    })
    checks.push({
      name: "host.redis-server-identity",
      required: true,
      status:
        report.redisIdentity.status === "separate-servers" ? "OK" : "FAILURE",
    })
  }

  if (includesMigrations) {
    checks.push({
      name: "migrations.status",
      required: true,
      status: report.migrationStatus === "up-to-date" ? "OK" : "FAILURE",
    })
  }

  const hasRequiredFailure = checks.some(
    (check) => check.required && check.status === "FAILURE"
  )

  return {
    checks,
    exitCode: warnOnly || !hasRequiredFailure ? 0 : 1,
    warnOnly,
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

type RedisServerIdentity = {
  database: string
  role: string | null
  runId: string
}

type RedisServerIdentityReader = {
  read(url: string): Promise<RedisServerIdentity>
}

async function inspectRedisServerIdentity(environment: DoctorEnvironment) {
  return inspectRedisServerIdentityWithClients({
    durableUrl: environment.DURABLE_REDIS_URL?.trim(),
    ephemeralUrl: environment.EPHEMERAL_REDIS_URL?.trim(),
    reader: { read: readRedisServerIdentity },
  })
}

export async function inspectRedisServerIdentityWithClients({
  durableUrl,
  ephemeralUrl,
  reader,
}: {
  durableUrl?: string
  ephemeralUrl?: string
  reader: RedisServerIdentityReader
}): Promise<RedisServerIdentityReport> {
  if (!durableUrl || !ephemeralUrl) {
    return unavailableRedisIdentity("not-configured")
  }

  try {
    const [durable, ephemeral] = await Promise.all([
      reader.read(durableUrl),
      reader.read(ephemeralUrl),
    ])

    return {
      durableDatabase: durable.database,
      durableRole: durable.role,
      ephemeralDatabase: ephemeral.database,
      ephemeralRole: ephemeral.role,
      status:
        durable.runId === ephemeral.runId ? "same-server" : "separate-servers",
    }
  } catch {
    return unavailableRedisIdentity("unavailable")
  }
}

async function readRedisServerIdentity(url: string): Promise<RedisServerIdentity> {
  const redis = new Redis(url, {
    connectTimeout: 2_000,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
  })
  redis.on("error", () => {})

  try {
    const info = await redis.info()
    const runId = redisInfoValue(info, "run_id")

    if (!runId) {
      throw new Error("Redis server identity is unavailable.")
    }

    return {
      database: redisDatabase(url),
      role: redisInfoValue(info, "role"),
      runId,
    }
  } finally {
    redis.disconnect()
  }
}

function unavailableRedisIdentity(
  status: "not-configured" | "unavailable"
): RedisServerIdentityReport {
  return {
    durableDatabase: null,
    durableRole: null,
    ephemeralDatabase: null,
    ephemeralRole: null,
    status,
  }
}

function redisDatabase(value: string) {
  const database = new URL(value).pathname.replace(/^\/+/, "")

  return database || "0"
}

function redisInfoValue(info: string, name: string) {
  return (
    info
      .split(/\r?\n/)
      .find((line) => line.startsWith(`${name}:`))
      ?.slice(name.length + 1)
      .trim() || null
  )
}

function resolveDoctorServiceRole(
  environment: DoctorEnvironment
): ProductionServiceRole | null {
  const role = environment.ARCTIC_RSS_SERVICE_ROLE?.trim()

  if (!role) {
    return "web"
  }

  return (PRODUCTION_SERVICE_ROLES as readonly string[]).includes(role)
    ? (role as ProductionServiceRole)
    : null
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
  role: ProductionServiceRole | null
) {
  if (environment.NODE_ENV !== "production") {
    return { errors: [], status: "not-applicable" as const }
  }

  if (!role) {
    return { errors: ["Unknown service role."], status: "failed" as const }
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

function isDoctorScope(value: string): value is DoctorScope {
  return ["host", "migrations", "release", "runtime"].includes(value)
}

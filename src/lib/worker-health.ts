import { unlink, writeFile } from "node:fs/promises"

export const WORKER_HEARTBEAT_PATH = "/tmp/arctic-rss-worker-heartbeat"

type WorkerHeartbeatOptions = {
  now?: () => number
  path?: string
}

export const DURABLE_WORKER_HEARTBEAT_TTL_MS = 90_000
export const MAINTENANCE_TICK_KEY = "arctic-rss:maintenance-tick:v1"
export const SCHEDULED_RESPONSIBILITIES = [
  "ai-operation-reconciliation",
  "auth-token-cleanup",
  "chat-retention",
  "feed-scheduling",
  "health-snapshot",
  "orphan-reporting",
  "podcast-scheduling",
  "saved-monitors",
  "security-event-cleanup",
  "smart-digest-email-scheduling",
  "smart-digest-scheduling",
] as const
export type ScheduledResponsibility =
  (typeof SCHEDULED_RESPONSIBILITIES)[number]

/**
 * Public readiness needs the source scheduler, not optional maintenance or
 * publisher-quality work. The matrix is explicit so topology additions must
 * deliberately choose their essential responsibilities.
 */
export const ESSENTIAL_SCHEDULED_RESPONSIBILITIES = {
  "all-in-one": ["feed-scheduling", "podcast-scheduling"],
  "all-in-one-with-chat": ["feed-scheduling", "podcast-scheduling"],
  split: ["feed-scheduling", "podcast-scheduling"],
  "split-with-chat": ["feed-scheduling", "podcast-scheduling"],
} as const satisfies Record<string, readonly ScheduledResponsibility[]>
const DEFAULT_SCHEDULER_INTERVAL_MS = 60_000

export type DurableWorkerHeartbeat = {
  instanceId: string
  mode: string
  timestamp: number
  version: string
}

type DurableWorkerHeartbeatClient = {
  get(key: string): Promise<string | null>
  mget(...keys: string[]): Promise<(string | null)[]>
  set(
    key: string,
    value: string,
    expirationMode: "PX",
    ttlMs: number
  ): Promise<unknown>
}

type DurableWorkerHeartbeatOptions = DurableWorkerHeartbeat & {
  client: Pick<DurableWorkerHeartbeatClient, "set">
  ttlMs?: number
}

/**
 * The Compose health check reads this file. It is deliberately updated by the
 * worker's event loop, so an unresponsive worker is marked unhealthy even if
 * its process is still present.
 */
export async function writeWorkerHeartbeat({
  now = Date.now,
  path = WORKER_HEARTBEAT_PATH,
}: WorkerHeartbeatOptions = {}) {
  await writeFile(path, `${now()}\n`, "utf8")
}

export async function clearWorkerHeartbeat({
  path = WORKER_HEARTBEAT_PATH,
}: Pick<WorkerHeartbeatOptions, "path"> = {}) {
  try {
    await unlink(path)
  } catch (error) {
    if (isMissingFileError(error)) {
      return
    }

    throw error
  }
}

/**
 * This key is shared by a mode because the topology guarantees one owner for
 * each mode. The value still identifies the live container instance, while
 * Redis TTL makes a stopped or wedged worker visible outside its container.
 */
export function durableWorkerHeartbeatKey(mode: string) {
  return `arctic-rss:worker-heartbeat:v1:${mode}`
}

export function durableResponsibilityTickKey(
  responsibility: ScheduledResponsibility
) {
  return `arctic-rss:maintenance-tick:v2:${responsibility}`
}

export async function writeDurableWorkerHeartbeat({
  client,
  instanceId,
  mode,
  timestamp,
  ttlMs = DURABLE_WORKER_HEARTBEAT_TTL_MS,
  version,
}: DurableWorkerHeartbeatOptions) {
  const heartbeat: DurableWorkerHeartbeat = {
    instanceId,
    mode,
    timestamp,
    version,
  }

  await client.set(
    durableWorkerHeartbeatKey(mode),
    JSON.stringify(heartbeat),
    "PX",
    ttlMs
  )

  return heartbeat
}

export async function writeDurableMaintenanceTick({
  client,
  instanceId,
  mode,
  timestamp,
  ttlMs = maintenanceTickMaxAgeMs(),
  version,
}: Omit<DurableWorkerHeartbeatOptions, "ttlMs"> & { ttlMs?: number }) {
  const tick: DurableWorkerHeartbeat = {
    instanceId,
    mode,
    timestamp,
    version,
  }

  await client.set(MAINTENANCE_TICK_KEY, JSON.stringify(tick), "PX", ttlMs)

  return tick
}

export async function writeDurableResponsibilityTick({
  client,
  instanceId,
  responsibility,
  timestamp,
  ttlMs = maintenanceTickMaxAgeMs(),
  version,
}: Omit<DurableWorkerHeartbeatOptions, "mode" | "ttlMs"> & {
  responsibility: ScheduledResponsibility
  ttlMs?: number
}) {
  const tick: DurableWorkerHeartbeat = {
    instanceId,
    mode: responsibility,
    timestamp,
    version,
  }

  await client.set(
    durableResponsibilityTickKey(responsibility),
    JSON.stringify(tick),
    "PX",
    ttlMs
  )

  return tick
}

export function maintenanceTickMaxAgeMs(
  environment: Readonly<Record<string, string | undefined>> = process.env
) {
  const interval = Number(environment.FEED_SCHEDULER_INTERVAL_MS?.trim())
  const schedulerIntervalMs =
    Number.isInteger(interval) && interval >= 10_000 && interval <= 60 * 60_000
      ? interval
      : DEFAULT_SCHEDULER_INTERVAL_MS

  return Math.max(DURABLE_WORKER_HEARTBEAT_TTL_MS, schedulerIntervalMs * 3)
}

export async function readDurableWorkerHeartbeats({
  client,
  modes,
}: {
  client: Pick<DurableWorkerHeartbeatClient, "mget">
  modes: readonly string[]
}) {
  const values = await client.mget(...modes.map(durableWorkerHeartbeatKey))
  const heartbeats: Record<string, DurableWorkerHeartbeat | undefined> = {}

  for (const [index, mode] of modes.entries()) {
    heartbeats[mode] = parseDurableWorkerHeartbeat(values[index], mode)
  }

  return heartbeats
}

export async function readDurableMaintenanceTick({
  client,
  mode,
}: {
  client: Pick<DurableWorkerHeartbeatClient, "get">
  mode: string
}) {
  return parseDurableWorkerHeartbeat(
    await client.get(MAINTENANCE_TICK_KEY),
    mode
  )
}

export async function readDurableResponsibilityTicks({
  client,
  responsibilities,
}: {
  client: Pick<DurableWorkerHeartbeatClient, "mget">
  responsibilities: readonly ScheduledResponsibility[]
}) {
  const values = await client.mget(
    ...responsibilities.map(durableResponsibilityTickKey)
  )
  const ticks: Partial<
    Record<ScheduledResponsibility, DurableWorkerHeartbeat>
  > = {}

  for (const [index, responsibility] of responsibilities.entries()) {
    ticks[responsibility] = parseDurableWorkerHeartbeat(
      values[index],
      responsibility
    )
  }

  return ticks
}

export function isFreshDurableWorkerHeartbeat(
  heartbeat: DurableWorkerHeartbeat | undefined,
  {
    now = Date.now,
    maximumAgeMs = DURABLE_WORKER_HEARTBEAT_TTL_MS,
  }: {
    now?: () => number
    maximumAgeMs?: number
  } = {}
) {
  const currentTime = now()

  return Boolean(
    heartbeat &&
    Number.isFinite(heartbeat.timestamp) &&
    heartbeat.timestamp <= currentTime &&
    currentTime - heartbeat.timestamp < maximumAgeMs
  )
}

function parseDurableWorkerHeartbeat(
  value: string | null | undefined,
  expectedMode: string
) {
  if (!value) {
    return undefined
  }

  try {
    const parsed = JSON.parse(value) as Partial<DurableWorkerHeartbeat>

    if (
      parsed.mode !== expectedMode ||
      typeof parsed.instanceId !== "string" ||
      !parsed.instanceId ||
      typeof parsed.timestamp !== "number" ||
      typeof parsed.version !== "string" ||
      !parsed.version
    ) {
      return undefined
    }

    return {
      instanceId: parsed.instanceId,
      mode: parsed.mode,
      timestamp: parsed.timestamp,
      version: parsed.version,
    }
  } catch {
    return undefined
  }
}

function isMissingFileError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  )
}

export const WORKER_MODES = [
  "ai-mail",
  "all",
  "chat-events",
  "imports",
  "ingestion",
  "maintenance",
] as const

export type WorkerMode = (typeof WORKER_MODES)[number]

const MODE_HEARTBEAT_SUFFIX: Record<WorkerMode, string> = {
  "ai-mail": "ai-mail",
  all: "",
  "chat-events": "chat-events",
  imports: "imports",
  ingestion: "ingestion",
  maintenance: "maintenance",
}

export function getWorkerMode(
  environment: Readonly<Record<string, string | undefined>> = process.env
): WorkerMode {
  const candidate = environment.WORKER_MODE?.trim().toLowerCase()

  if (!candidate) {
    return "all"
  }

  if ((WORKER_MODES as readonly string[]).includes(candidate)) {
    return candidate as WorkerMode
  }

  throw new Error(
    `WORKER_MODE must be one of: ${WORKER_MODES.join(", ")}.`
  )
}

export function runsWorkerResponsibility(
  mode: WorkerMode,
  responsibility: Exclude<WorkerMode, "all">
) {
  return mode === "all" || mode === responsibility
}

export function workerHeartbeatPath(mode: WorkerMode) {
  const suffix = MODE_HEARTBEAT_SUFFIX[mode]

  return suffix
    ? `/tmp/arctic-rss-worker-heartbeat-${suffix}`
    : "/tmp/arctic-rss-worker-heartbeat"
}

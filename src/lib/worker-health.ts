import { unlink, writeFile } from "node:fs/promises"

export const WORKER_HEARTBEAT_PATH = "/tmp/arctic-rss-worker-heartbeat"

type WorkerHeartbeatOptions = {
  now?: () => number
  path?: string
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

function isMissingFileError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  )
}

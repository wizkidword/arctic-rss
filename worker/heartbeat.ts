import type Redis from "ioredis"

import { writeDurableWorkerHeartbeat, writeWorkerHeartbeat } from "../src/lib/worker-health"

export function startWorkerHeartbeat({
  instanceId,
  intervalMs,
  mode,
  path,
  store,
  version,
}: {
  instanceId: string
  intervalMs: number
  mode: "ai-mail" | "all" | "chat-events" | "imports" | "ingestion" | "maintenance"
  path: string
  store: Redis
  version: string
}) {
  const record = () => {
    const timestamp = Date.now()
    writeWorkerHeartbeat({ path }).catch((error) => {
      console.error(`[worker] could not update health heartbeat: ${errorMessage(error)}`)
    })
    writeDurableWorkerHeartbeat({ client: store, instanceId, mode, timestamp, version }).catch((error) => {
      console.error(`[worker] could not update durable health heartbeat: ${errorMessage(error)}`)
    })
  }

  const interval = setInterval(record, intervalMs)
  record()

  return { stop: () => clearInterval(interval) }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "unknown error"
}

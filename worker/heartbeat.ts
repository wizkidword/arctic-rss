import type Redis from "ioredis"

import { writeDurableWorkerHeartbeat, writeWorkerHeartbeat } from "../src/lib/worker-health"

export function startWorkerHeartbeat({
  instanceId,
  intervalMs,
  isControlPlaneReady = () => true,
  mode,
  path,
  store,
  version,
}: {
  instanceId: string
  intervalMs: number
  isControlPlaneReady?: () => boolean
  mode: "ai-mail" | "all" | "chat-events" | "health" | "imports" | "ingestion" | "maintenance"
  path: string
  store: Redis
  version: string
}) {
  const record = () => {
    if (!isControlPlaneReady()) {
      return
    }

    const timestamp = Date.now()
    writeDurableWorkerHeartbeat({ client: store, instanceId, mode, timestamp, version })
      .then(() => writeWorkerHeartbeat({ path }))
      .catch(() => {
        // Connection state is reported once by the control-plane client. A
        // failed durable write must not refresh the local health file.
      })
  }

  const interval = setInterval(record, intervalMs)
  record()

  return { stop: () => clearInterval(interval) }
}

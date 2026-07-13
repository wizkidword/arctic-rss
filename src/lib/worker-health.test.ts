import { mkdtemp, readFile, rm } from "node:fs/promises"
import path from "node:path"
import { tmpdir } from "node:os"
import { describe, expect, it } from "vitest"

import { clearWorkerHeartbeat, writeWorkerHeartbeat } from "./worker-health"

describe("worker health", () => {
  it("writes and clears a worker heartbeat without failing when it is already gone", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "arctic-rss-worker-health-"))
    const heartbeatPath = path.join(directory, "heartbeat")

    try {
      await writeWorkerHeartbeat({
        now: () => 1_752_428_800_000,
        path: heartbeatPath,
      })

      await expect(readFile(heartbeatPath, "utf8")).resolves.toBe(
        "1752428800000\n"
      )

      await clearWorkerHeartbeat({ path: heartbeatPath })
      await expect(readFile(heartbeatPath, "utf8")).rejects.toMatchObject({
        code: "ENOENT",
      })

      await expect(clearWorkerHeartbeat({ path: heartbeatPath })).resolves.toBeUndefined()
    } finally {
      await rm(directory, { force: true, recursive: true })
    }
  })
})

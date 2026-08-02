import { mkdtemp, readFile, rm } from "node:fs/promises"
import path from "node:path"
import { tmpdir } from "node:os"
import { describe, expect, it, vi } from "vitest"

import {
  clearWorkerHeartbeat,
  DURABLE_WORKER_HEARTBEAT_TTL_MS,
  isFreshDurableWorkerHeartbeat,
  readDurableWorkerHeartbeats,
  readDurableMaintenanceTick,
  MAINTENANCE_TICK_KEY,
  maintenanceTickMaxAgeMs,
  writeDurableMaintenanceTick,
  writeDurableWorkerHeartbeat,
  writeWorkerHeartbeat,
} from "./worker-health"

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

  it("publishes a redacted TTL-backed heartbeat per worker mode", async () => {
    const client = {
      mget: vi.fn().mockResolvedValue([
        JSON.stringify({
          instanceId: "container-a",
          mode: "maintenance",
          timestamp: 1_752_428_800_000,
          version: "7915d2f",
        }),
        "not-json",
      ]),
      set: vi.fn().mockResolvedValue("OK"),
    }

    await expect(
      writeDurableWorkerHeartbeat({
        client,
        instanceId: "container-a",
        mode: "maintenance",
        timestamp: 1_752_428_800_000,
        version: "7915d2f",
      })
    ).resolves.toEqual({
      instanceId: "container-a",
      mode: "maintenance",
      timestamp: 1_752_428_800_000,
      version: "7915d2f",
    })
    expect(client.set).toHaveBeenCalledWith(
      "arctic-rss:worker-heartbeat:v1:maintenance",
      JSON.stringify({
        instanceId: "container-a",
        mode: "maintenance",
        timestamp: 1_752_428_800_000,
        version: "7915d2f",
      }),
      "PX",
      DURABLE_WORKER_HEARTBEAT_TTL_MS
    )

    await expect(
      readDurableWorkerHeartbeats({
        client,
        modes: ["maintenance", "ingestion"],
      })
    ).resolves.toEqual({
      ingestion: undefined,
      maintenance: {
        instanceId: "container-a",
        mode: "maintenance",
        timestamp: 1_752_428_800_000,
        version: "7915d2f",
      },
    })
  })

  it("uses three scheduler intervals for maintenance freshness", () => {
    expect(maintenanceTickMaxAgeMs()).toBe(180_000)
    expect(
      maintenanceTickMaxAgeMs({ FEED_SCHEDULER_INTERVAL_MS: "900000" })
    ).toBe(2_700_000)
  })

  it("rejects stale, malformed, or future durable heartbeats", () => {
    const timestamp = 1_752_428_800_000

    expect(
      isFreshDurableWorkerHeartbeat(
        {
          instanceId: "worker-a",
          mode: "all",
          timestamp,
          version: "test",
        },
        { now: () => timestamp + DURABLE_WORKER_HEARTBEAT_TTL_MS - 1 }
      )
    ).toBe(true)
    expect(
      isFreshDurableWorkerHeartbeat(
        {
          instanceId: "worker-a",
          mode: "all",
          timestamp,
          version: "test",
        },
        { now: () => timestamp + DURABLE_WORKER_HEARTBEAT_TTL_MS }
      )
    ).toBe(false)
    expect(
      isFreshDurableWorkerHeartbeat(
        {
          instanceId: "worker-a",
          mode: "all",
          timestamp: timestamp + 1,
          version: "test",
        },
        { now: () => timestamp }
      )
    ).toBe(false)
  })

  it("records and reads the last successful maintenance tick independently", async () => {
    const tick = {
      instanceId: "container-a",
      mode: "all",
      timestamp: 1_752_428_800_000,
      version: "7915d2f",
    }
    const client = {
      get: vi.fn().mockResolvedValue(JSON.stringify(tick)),
      set: vi.fn().mockResolvedValue("OK"),
    }

    await expect(writeDurableMaintenanceTick({ client, ...tick })).resolves.toEqual(tick)
    expect(client.set).toHaveBeenCalledWith(
      MAINTENANCE_TICK_KEY,
      JSON.stringify(tick),
      "PX",
      maintenanceTickMaxAgeMs()
    )
    await expect(
      readDurableMaintenanceTick({ client, mode: "all" })
    ).resolves.toEqual(tick)
  })
})

import { execFile } from "node:child_process"
import { promisify } from "node:util"

import { afterEach, describe, expect, it } from "vitest"

import { clearWorkerHeartbeat, durableWorkerHeartbeatKey } from "../src/lib/worker-health"
import { startWorkerHeartbeat } from "./heartbeat"
import { createWorkerControlPlaneRedis } from "./control-plane-redis"

const execFileAsync = promisify(execFile)
const redisUrl = process.env.ARCTIC_RSS_TEST_REDIS_URL
const redisContainer = process.env.ARCTIC_RSS_TEST_REDIS_CONTAINER
const redisDescribe = redisUrl && redisContainer ? describe : describe.skip

redisDescribe("worker control-plane Redis recovery (real Redis)", () => {
  const cleanup: Array<() => Promise<void>> = []

  afterEach(async () => {
    await Promise.all(cleanup.splice(0).map((close) => close()))
  })

  it("becomes degraded during a restart and resumes durable and local heartbeats", async () => {
    const states: string[] = []
    const control = createWorkerControlPlaneRedis({
      graceMs: 30_000,
      name: "test-heartbeat",
      url: redisUrl,
    })
    cleanup.push(() => control.close())
    control.onStateChange((state) => states.push(state))
    await waitFor(() => control.isReady())

    const heartbeatPath = `${process.env.TEMP ?? "/tmp"}/arctic-rss-control-plane-heartbeat-${process.pid}`
    const heartbeat = startWorkerHeartbeat({
      instanceId: "redis-restart-test",
      intervalMs: 25,
      isControlPlaneReady: control.isReady,
      mode: "ingestion",
      path: heartbeatPath,
      store: control.client,
      version: "test",
    })
    cleanup.push(async () => {
      heartbeat.stop()
      await clearWorkerHeartbeat({ path: heartbeatPath })
    })
    const key = durableWorkerHeartbeatKey("ingestion")
    await waitFor(async () => Boolean(await control.client.get(key)))
    const beforeRestart = JSON.parse((await control.client.get(key))!) as { timestamp: number }

    await execFileAsync("docker", ["restart", "--time", "1", redisContainer!])

    await waitFor(() => states.includes("unavailable") || states.includes("reconnecting"))
    await waitFor(() => control.isReady(), 15_000)
    await waitFor(async () => {
      const value = await control.client.get(key)
      return Boolean(value && JSON.parse(value).timestamp > beforeRestart.timestamp)
    })

    expect(states).toContain("ready")
    expect(states.some((state) => state === "unavailable" || state === "reconnecting")).toBe(true)
  }, 30_000)
})

async function waitFor(predicate: () => boolean | Promise<boolean>, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    try {
      if (await predicate()) {
        return
      }
    } catch {
      // A command can race the disposable Redis restart. The control-plane
      // state and the eventual successful write are the assertion.
    }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }

  throw new Error("Timed out waiting for Redis recovery")
}

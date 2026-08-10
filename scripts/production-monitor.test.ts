import { readFile } from "node:fs/promises"

import { describe, expect, it } from "vitest"

describe("production monitor", () => {
  it("checks readiness for an enabled chat gateway without exposing its port", async () => {
    const script = await readFile("scripts/production-monitor.sh", "utf8")

    expect(script).toContain("app-chat-gateway-1")
    expect(script).toContain("http://127.0.0.1:3001/ready")
    expect(script).toContain('failures+=("chat_gateway_ready")')
    expect(script).toContain("app-edge-proxy-1")
  })

  it("checks both Redis workloads, their policies, and command-pressure signals", async () => {
    const script = await readFile("scripts/production-monitor.sh", "utf8")

    expect(script).toContain("app-redis-ephemeral-1")
    expect(script).toContain("redis_durable_memory_policy")
    expect(script).toContain("redis_ephemeral_memory_policy")
    expect(script).toContain("total_error_replies")
    expect(script).toContain("errorstat_OOM")
    expect(script).toContain("mem_fragmentation_ratio")
    expect(script).toContain("mem_fragmentation_bytes")
    expect(script).toContain("REDIS_FRAGMENTATION_MIN_BYTES")
    expect(script).toContain("actual_ratio > maximum_ratio && actual_bytes > minimum_bytes")
    expect(script).toContain('REDIS_ENV_FILE="${REDIS_ENV_FILE:-$APP_DIR/.env}"')
    expect(script).toContain('docker exec --env-file "$REDIS_ENV_FILE"')
    expect(script).toContain("redis_start_option")
    expect(script).not.toContain("CONFIG GET")
  })

  it("checks each enabled split worker independently", async () => {
    const script = await readFile("scripts/production-monitor.sh", "utf8")

    expect(script).toContain("app-worker-ingestion-1")
    expect(script).toContain("app-worker-ai-mail-1")
    expect(script).toContain("app-worker-imports-1")
    expect(script).toContain("app-worker-maintenance-1")
    expect(script).toContain("app-worker-health-1")
    expect(script).toContain("app-worker-chat-events-1")
  })

  it("warns before a release loses its byte-based workspace reserve", async () => {
    const script = await readFile("scripts/production-monitor.sh", "utf8")

    expect(script).toContain('RELEASE_MIN_FREE_BYTES="${RELEASE_MIN_FREE_BYTES:-4294967296}"')
    expect(script).toContain("RELEASE_MIN_FREE_BYTES must be a positive whole number.")
    expect(script).toContain("release_disk_reserve")
    expect(script).toContain("disk_available_kib * 1024 < RELEASE_MIN_FREE_BYTES")
  })
})

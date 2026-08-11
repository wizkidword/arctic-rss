import { readFile } from "node:fs/promises"

import { describe, expect, it } from "vitest"

describe("production monitor", () => {
  it("derives required service names before checking an enabled chat gateway", async () => {
    const script = await readFile("scripts/production-monitor.sh", "utf8")

    expect(script).toContain("arctic-rss-monitor-topology")
    expect(script).toContain("required_health_services")
    expect(script).toContain("container_name_for_service")
    expect(script).toContain('check_healthy_service edge-proxy')
    expect(script).toContain('check_healthy_service chat-gateway')
    expect(script).toContain("http://127.0.0.1:3001/ready")
    expect(script).toContain('failures+=("chat_gateway_ready")')
    expect(script).not.toContain("app-chat-gateway-1")
    expect(script).not.toContain("app-edge-proxy-1")
  })

  it("checks both Redis workloads, their policies, and command-pressure signals", async () => {
    const script = await readFile("scripts/production-monitor.sh", "utf8")

    expect(script).toContain("redis-ephemeral)")
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

  it("uses the release-bound Compose project for worker, Redis, and Postgres probes", async () => {
    const [script, resolver] = await Promise.all([
      readFile("scripts/production-monitor.sh", "utf8"),
      readFile("scripts/production-monitor-topology.sh", "utf8"),
    ])

    expect(script).toContain('printf \'%s-%s-1\' "$COMPOSE_PROJECT" "$service_name"')
    expect(script).toContain('redis_start_option redis appendonly')
    expect(script).toContain('container_name_for_service postgres')
    expect(resolver).toContain('print(f"required_worker_mode={worker}")')
    expect(resolver).toContain('print(f"compose_project={compose_project}")')
  })

  it("warns before a release loses its byte-based workspace reserve", async () => {
    const script = await readFile("scripts/production-monitor.sh", "utf8")

    expect(script).toContain('RELEASE_MIN_FREE_BYTES="${RELEASE_MIN_FREE_BYTES:-4294967296}"')
    expect(script).toContain("RELEASE_MIN_FREE_BYTES must be a positive whole number.")
    expect(script).toContain("release_disk_reserve")
    expect(script).toContain("disk_available_kib * 1024 < RELEASE_MIN_FREE_BYTES")
  })
})

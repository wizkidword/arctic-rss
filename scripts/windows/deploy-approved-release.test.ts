import { readFile } from "node:fs/promises"

import { describe, expect, it } from "vitest"

describe("approved release command", () => {
  it("enables the opt-in chat profile before building the chat gateway", async () => {
    const script = await readFile("scripts/windows/deploy-approved-release.ps1", "utf8")

    expect(script).toContain(
      'docker compose -p "$compose_project" --project-directory "$stage" --profile chat build migrate web worker chat-gateway',
    )
  })

  it("starts and verifies both Redis workloads before application services", async () => {
    const script = await readFile("scripts/windows/deploy-approved-release.ps1", "utf8")

    expect(script).toContain(
      'up -d --no-deps --force-recreate postgres redis redis-ephemeral'
    )
    expect(script).toContain("app-redis-ephemeral-1")
    expect(script).toContain('test "$redis_ephemeral_health" = healthy')
  })

  it("records migration verification and source-built image identities", async () => {
    const script = await readFile("scripts/windows/deploy-approved-release.ps1", "utf8")

    expect(script).toContain('migration_status="verified"')
    expect(script).toContain("printf 'MIGRATION_STATUS=%s\\n' \"$migration_status\"")
    expect(script).toContain('docker inspect -f \'{{.Image}}\' app-web-1')
    expect(script).toContain('docker inspect -f \'{{.Image}}\' app-worker-1')
    expect(script).toContain('docker inspect -f \'{{.Image}}\' app-chat-gateway-1')
    expect(script).toContain('migrationStatus = $migrationStatus')
    expect(script).toContain('webImage = $webImage')
    expect(script).toContain('workerImage = $workerImage')
    expect(script).toContain('chatGatewayImage = $chatGatewayImage')
  })
})

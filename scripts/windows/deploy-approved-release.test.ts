import { readFile } from "node:fs/promises"

import { describe, expect, it } from "vitest"

describe("approved release command", () => {
  it("enables the opt-in chat profile before building the chat gateway", async () => {
    const script = await readFile("scripts/windows/deploy-approved-release.ps1", "utf8")

    expect(script).toContain(
      'docker compose -p "$compose_project" --project-directory "$stage" --profile chat build migrate web worker chat-gateway',
    )
  })

  it("retains and verifies stateful workloads before application services", async () => {
    const script = await readFile("scripts/windows/deploy-approved-release.ps1", "utf8")

    expect(script).toContain(
      "Stateful services retain their existing containers and volumes during an",
    )
    expect(script).not.toContain(
      'up -d --no-deps --force-recreate postgres redis redis-ephemeral',
    )
    expect(script).toContain("app-redis-ephemeral-1")
    expect(script).toContain('test "$redis_ephemeral_health" = healthy')
  })

  it("uses a pipefail-safe journal retention assertion", async () => {
    const script = await readFile("scripts/windows/deploy-approved-release.ps1", "utf8")

    expect(script).toContain(
      "systemd-analyze cat-config systemd/journald.conf | awk",
    )
    expect(script).not.toContain(
      "systemd-analyze cat-config systemd/journald.conf | grep -qx 'MaxRetentionSec=30day'",
    )
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

  it("checks pending migration ownership before backup, staging, or builds", async () => {
    const script = await readFile("scripts/windows/deploy-approved-release.ps1", "utf8")

    expect(script).toContain("function Get-MigrationOwnershipTargets")
    expect(script).toContain("[AllowEmptyCollection()]")
    expect(script).toContain("[AllowEmptyString()]")
    expect(script).toContain('$MigrationName -notmatch "^[A-Za-z0-9_]+$"')
    expect(script).toContain("ALTER\\s+(?:TYPE|DOMAIN)")
    expect(script).toContain("CREATE\\s+(?:UNIQUE\\s+)?INDEX")
    expect(script).toContain('MIGRATION_OWNERSHIP_PRECHECK=passed')
    expect(script).toContain('process.stdout.write(new URL(process.env.DATABASE_URL).username)')
    expect(script.indexOf("MIGRATION_OWNERSHIP_PRECHECK=passed")).toBeLessThan(
      script.indexOf("arctic-rss-backup.service"),
    )
  })
})

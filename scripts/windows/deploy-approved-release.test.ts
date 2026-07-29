import { readFile } from "node:fs/promises"

import { describe, expect, it } from "vitest"

describe("approved release command", () => {
  it("builds application images locally and loads them on the VPS without a VPS build", async () => {
    const script = await readFile("scripts/windows/deploy-approved-release.ps1", "utf8")

    expect(script).toContain(
      "function New-OffHostReleaseImages",
    )
    expect(script).toContain('"--platform", "linux/amd64"')
    expect(script).toContain('sudo -n docker load --input "$image_archive" >/dev/null')
    expect(script).toContain('run --rm --no-deps --no-build -T migrate')
    expect(script).toContain('up -d --no-deps --no-build --force-recreate web worker')
    expect(script).not.toContain(' --profile chat build migrate web worker chat-gateway')
  })

  it("keeps uploaded release images isolated from the live Compose image tags", async () => {
    const script = await readFile("scripts/windows/deploy-approved-release.ps1", "utf8")

    expect(script).toContain('"$($Config.ComposeProject)-worker:release-$ShortSha"')
    expect(script).toContain('ImageEnvironment = @(')
    expect(script).toContain("release_image_environment_b64=")
    expect(script).toContain("MIGRATE_IMAGE|WEB_IMAGE|WORKER_IMAGE|CHAT_GATEWAY_IMAGE")
    expect(script).toContain("__RELEASE_IMAGE_ENVIRONMENT_BASE64__")
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
    expect(script).toContain('localImageArchiveSha256 = $offHostImages.ArchiveHash')
  })

  it("uses the dedicated local build root and checks OVH disk headroom before backup", async () => {
    const script = await readFile("scripts/windows/deploy-approved-release.ps1", "utf8")

    expect(script).toContain('"D:\\Arctic RSS Docker"')
    expect(script).toContain('$raw.PSObject.Properties["LocalBuildRoot"]')
    expect(script).toContain("function Assert-RemoteImageCapacity")
    expect(script.indexOf("Assert-RemoteImageCapacity")).toBeLessThan(
      script.indexOf("arctic-rss-backup.service"),
    )
  })

  it("reads and normalizes the root-protected public build setting", async () => {
    const script = await readFile("scripts/windows/deploy-approved-release.ps1", "utf8")

    expect(script).toContain(
      "sudo -n awk -F= '$1 == \"NEXT_PUBLIC_GA_MEASUREMENT_ID\"",
    )
    expect(script).toContain('ga_measurement_id="${ga_measurement_id#\\"}"')
    expect(script).toContain('ga_measurement_id="${ga_measurement_id%\\"}"')
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
    expect(script).toContain(
      "process.stdout.write(new URL(process.env.DATABASE_URL).username)' </dev/null 2>/dev/null)",
    )
    expect(script.indexOf("MIGRATION_OWNERSHIP_PRECHECK=passed")).toBeLessThan(
      script.indexOf("arctic-rss-backup.service"),
    )
  })
})

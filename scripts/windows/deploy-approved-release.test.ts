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
    expect(script).toContain('run --rm --no-deps -T migrate')
    expect(script).not.toContain('run --rm --no-deps --no-build -T migrate')
    expect(script).toContain('live_compose up -d --no-deps --no-build --force-recreate "${topology_release_services[@]}"')
    expect(script).not.toContain(' --profile chat build migrate web worker chat-gateway')
  })

  it("requires the current browser coverage CI job before releasing", async () => {
    const script = await readFile("scripts/windows/deploy-approved-release.ps1", "utf8")

    expect(script).toContain('"Browser smoke and reader journeys"')
    expect(script).not.toContain('"Browser smoke test"')
  })

  it("retries post-release local and public health checks before failing", async () => {
    const script = await readFile("scripts/windows/deploy-approved-release.ps1", "utf8")

    expect(script).toContain("function Invoke-ExpectedCurlResponse")
    expect(script).toContain("$MaxAttempts = 12")
    expect(script).toContain("Start-Sleep -Seconds $RetryDelaySeconds")
    expect(script).toContain("wait_for_local_endpoint()")
    expect(script).toContain("for attempt in $(seq 1 12); do")
    expect(script).toContain('curl -fsS --connect-timeout 5 --max-time 10 "$@" 2>/dev/null || true')
    expect(script).toContain('wait_for_local_endpoint health \'{"status":"ok"}\'')
    expect(script).toContain('$publicHealth = Invoke-ExpectedCurlResponse -Label "Public health endpoint"')
    expect(script).toContain('$loginStatus = Invoke-ExpectedCurlResponse -Label "Public login page"')
  })

  it("keeps uploaded release images isolated from the live Compose image tags", async () => {
    const script = await readFile("scripts/windows/deploy-approved-release.ps1", "utf8")

    expect(script).toContain('"$($Config.ComposeProject)-worker:release-$ShortSha"')
    expect(script).toContain('ImageEnvironment = @(')
    expect(script).toContain("release_image_environment_b64=")
    expect(script).toContain("MIGRATE_IMAGE|WEB_IMAGE|WORKER_IMAGE|CHAT_GATEWAY_IMAGE|EDGE_PROXY_IMAGE")
    expect(script).toContain("__RELEASE_IMAGE_ENVIRONMENT_BASE64__")
    expect(script).toContain('(([string[]]$offHostImages.ImageEnvironment -join "`n") + "`n")')
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

  it("attaches legacy stateful containers to the staged topology before migration", async () => {
    const script = await readFile("scripts/windows/deploy-approved-release.ps1", "utf8")

    expect(script).toContain("ensure_stateful_network_alias()")
    expect(script).toContain('docker network connect --alias "$alias" "$network" "$container"')
    expect(script).toContain("ensure_stateful_network_alias durable-data app-postgres-1 postgres")
    expect(script).toContain("ensure_stateful_network_alias web-edge app-postgres-1 postgres")
    expect(script).toContain("ensure_stateful_network_alias durable-data app-redis-1 redis")
    expect(script).toContain("ensure_stateful_network_alias ephemeral-realtime app-redis-ephemeral-1 redis-ephemeral")
    expect(script).toContain('STATEFUL_NETWORK_READINESS=%s\\n')
    expect(script).toContain('statefulNetworkReadiness = $statefulNetworkReadiness')
    expect(script.indexOf("ensure_stateful_network_alias durable-data app-postgres-1 postgres")).toBeLessThan(
      script.indexOf('run --rm --no-deps -T migrate node ./check-migration-risk.mjs'),
    )
  })

  it("uses a pipefail-safe journal retention assertion", async () => {
    const script = await readFile("scripts/windows/deploy-approved-release.ps1", "utf8")

    expect(script).toContain("tr -d '\\r' | bash -se 2>&1")
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
    expect(script).toContain("printf 'CHAT_DATABASE_ROLE=%s\\n' \"$chat_database_role\"")
    expect(script).toContain('chatDatabaseRole = $chatDatabaseRole')
    expect(script).toContain('docker inspect -f \'{{.Image}}\' app-web-1')
    expect(script).toContain("worker_image_entries+=(\"$service=$service_image\")")
    expect(script).toContain('chat_gateway_image="$(sudo -n docker inspect')
    expect(script).toContain('edge_proxy_image="$(sudo -n docker inspect')
    expect(script).toContain('migrationStatus = $migrationStatus')
    expect(script).toContain('webImage = $webImage')
    expect(script).toContain('workerImage = $workerImage')
    expect(script).toContain('chatGatewayImage = $chatGatewayImage')
    expect(script).toContain('edgeProxyHealth = $edgeProxyHealth')
    expect(script).toContain('edgeProxyImage = $edgeProxyImage')
    expect(script).toContain('localImageArchiveSha256 = $offHostImages.ArchiveHash')
    expect(script).toContain('topology = $deployedTopology')
    expect(script).toContain('topologyHealth = $topologyHealth')
  })

  it("bootstraps the restricted chat database role after migrations and before the live swap", async () => {
    const script = await readFile("scripts/windows/deploy-approved-release.ps1", "utf8")

    expect(script).toContain('chat_database_role="not-selected"')
    expect(script).toContain("all-in-one-with-chat|split-with-chat)")
    expect(script).toContain('CHAT_DATABASE_URL must use arctic_chat')
    expect(script).toContain('ops/postgres/bootstrap-chat-runtime-role.sql')
    expect(script).toContain('chat_password_b64')
    expect(script).toContain('base64 -d')
    expect(script).toContain('PGPASSWORD="$chat_password" psql')
    expect(script).toContain('chat_database_role="verified"')
    expect(script.indexOf('migration_status="verified"')).toBeLessThan(
      script.indexOf('ops/postgres/bootstrap-chat-runtime-role.sql'),
    )
    expect(script.indexOf('ops/postgres/bootstrap-chat-runtime-role.sql')).toBeLessThan(
      script.indexOf('sudo -n mv "$live" "$previous"'),
    )
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

  it("keeps off-host build progress out of the release metadata result", async () => {
    const script = await readFile("scripts/windows/deploy-approved-release.ps1", "utf8")

    expect(script).toContain('$imageBuildOutput | Out-Host')
    expect(script).toContain('$imageArchiveOutput | Out-Host')
    expect(script).toContain('ArchiveBytes = $archiveInfo.Length')
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

  it("requires a manifest-defined topology and applies only its profiles and services", async () => {
    const script = await readFile("scripts/windows/deploy-approved-release.ps1", "utf8")

    expect(script).toContain('[ValidateSet("all-in-one", "all-in-one-with-chat", "split", "split-with-chat")]')
    expect(script).toContain("function Get-ReleaseTopology")
    expect(script).toContain('Invoke-LocalCheck -Label "Validating selected topology"')
    expect(script).toContain('$releaseTopology = Get-ReleaseTopology -Name $Topology')
    expect(script).toContain("topology_profiles_b64=")
    expect(script).toContain("stage_compose()")
    expect(script).toContain("live_compose()")
    expect(script).toContain("selected_service()")
    expect(script).toContain("topology_application_services")
    expect(script).toContain("TOPOLOGY_HEALTH")
    expect(script).toContain('ARCTIC_RSS_TOPOLOGY="$topology_name"')
    expect(script).toContain('ARCTIC_RSS_BUILD_SHA="$commit"')
  })

  it("hands the fixed managed-tunnel listener to the edge proxy for chat topologies", async () => {
    const script = await readFile("scripts/windows/deploy-approved-release.ps1", "utf8")

    expect(script).toContain('all-in-one-with-chat|split-with-chat)')
    expect(script).toContain("/^(WEB_PORT|EDGE_PROXY_HOST_PORT)=/d")
    expect(script).toContain("WEB_PORT=3001\\nEDGE_PROXY_HOST_PORT=3000\\n")
  })

  it("captures the exact prior topology, commit, and application image tags for rollback", async () => {
    const script = await readFile("scripts/windows/deploy-approved-release.ps1", "utf8")

    expect(script).toContain("TopologyCatalog = $topologyCatalog")
    expect(script).toContain("topology_catalog_b64=")
    expect(script).toContain('docker ps --filter "label=com.docker.compose.project=$compose_project"')
    expect(script).toContain(".arctic-rss-release.json")
    expect(script).toContain("PREVIOUS_COMMIT")
    expect(script).toContain("PREVIOUS_TOPOLOGY")
    expect(script).toContain("PREVIOUS_IMAGES")
    expect(script).toContain("previousImageTags = @($previousImages -split ' '")
    expect(script).toContain('[[ "$previous_commit" =~ ^[a-f0-9]{40}$ ]]')
  })

  it("retires only unreferenced older release tags after public verification", async () => {
    const script = await readFile("scripts/windows/deploy-approved-release.ps1", "utf8")

    expect(script).toContain("function Invoke-RollbackSafeImageRetention")
    expect(script).toContain("the previous release's complete image environment")
    expect(script).toContain("sudo -n docker ps -a --format '{{.Image}}'")
    expect(script).toContain('docker image rm "$image_name"')
    expect(script).toContain("IMAGE_RETENTION_RETIRED")
    expect(script).toContain('imageRetention = $imageRetention')
    expect(script.lastIndexOf("Invoke-RollbackSafeImageRetention")).toBeGreaterThan(
      script.indexOf('$loginStatus = Invoke-ExpectedCurlResponse'),
    )
    expect(script).toContain("Post-release image retention was not completed")
  })

  it("recognizes only the explicit pre-worker-health chat topology as a rollback predecessor", async () => {
    const script = await readFile("scripts/windows/deploy-approved-release.ps1", "utf8")

    expect(script).toContain("$legacyTopologyCatalog = @(")
    expect(script).toContain(
      '"all-in-one-with-chat|chat-gateway,edge-proxy,web,worker"',
    )
    expect(script).toContain(") + $legacyTopologyCatalog")
    expect(script).toContain("$topologyCatalog.Count -ne 5")
  })
})

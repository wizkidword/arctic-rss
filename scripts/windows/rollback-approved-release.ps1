[CmdletBinding()]
param(
  [Parameter(Mandatory)]
  [string]$ConfigurationPath,

  [Parameter(Mandatory)]
  [string]$ReleaseRecordPath,

  [Parameter(Mandatory)]
  [ValidateSet("all-in-one", "all-in-one-with-chat", "split", "split-with-chat")]
  [string]$Topology,

  [switch]$Approve,

  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-Matches {
  param(
    [Parameter(Mandatory)][string]$Name,
    [Parameter(Mandatory)][string]$Value,
    [Parameter(Mandatory)][string]$Pattern
  )

  if ($Value -notmatch $Pattern) {
    throw "Rollback configuration contains an invalid $Name."
  }
}

function Get-RollbackConfiguration {
  param([Parameter(Mandatory)][string]$Path)

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "Rollback configuration was not found."
  }

  $raw = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
  foreach ($property in "SshHost", "SshUser", "SshKeyPath", "AppDirectory", "ComposeProject", "CanonicalHost") {
    if ([string]::IsNullOrWhiteSpace([string]$raw.$property)) {
      throw "Rollback configuration is missing $property."
    }
  }

  $sshHost = ([string]$raw.SshHost).Trim()
  $sshUser = ([string]$raw.SshUser).Trim()
  $sshKeyPath = [string]$raw.SshKeyPath
  $appDirectory = ([string]$raw.AppDirectory).TrimEnd("/")
  $composeProject = ([string]$raw.ComposeProject).Trim()
  $canonicalHost = ([string]$raw.CanonicalHost).Trim()

  Assert-Matches -Name "SshHost" -Value $sshHost -Pattern "^[A-Za-z0-9.-]+$"
  Assert-Matches -Name "SshUser" -Value $sshUser -Pattern "^[A-Za-z_][A-Za-z0-9_-]*$"
  Assert-Matches -Name "AppDirectory" -Value $appDirectory -Pattern "^/[A-Za-z0-9._/-]+$"
  Assert-Matches -Name "ComposeProject" -Value $composeProject -Pattern "^[A-Za-z][A-Za-z0-9_-]*$"
  Assert-Matches -Name "CanonicalHost" -Value $canonicalHost -Pattern "^[A-Za-z0-9.-]+$"

  if (-not (Test-Path -LiteralPath $sshKeyPath -PathType Leaf)) {
    throw "The configured SSH key file was not found."
  }

  $releaseRootIndex = $appDirectory.LastIndexOf("/")
  if ($releaseRootIndex -le 0) {
    throw "AppDirectory must be nested inside a release root."
  }

  return [pscustomobject]@{
    SshHost = $sshHost
    SshUser = $sshUser
    SshKeyPath = (Resolve-Path -LiteralPath $sshKeyPath).Path
    AppDirectory = $appDirectory
    ReleaseRoot = $appDirectory.Substring(0, $releaseRootIndex)
    ComposeProject = $composeProject
    CanonicalHost = $canonicalHost
  }
}

function Get-RollbackTopology {
  param([Parameter(Mandatory)][string]$Name)

  $manifestPath = Join-Path $PSScriptRoot "..\..\ops\topologies.json"
  $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
  $topology = $manifest.topologies.PSObject.Properties[$Name].Value
  if ($manifest.schemaVersion -ne 1 -or $null -eq $topology) {
    throw "The selected topology is not defined by a supported topology manifest."
  }

  $serviceLists = @("rollbackServices", "requiredHealthServices", "requiredServices")
  foreach ($property in $serviceLists) {
    $values = @($topology.$property | ForEach-Object { [string]$_ })
    if ($values.Count -eq 0 -or @($values | Where-Object { $_ -notmatch "^[a-z0-9-]+$" }).Count -gt 0) {
      throw "The topology manifest has an invalid $property list for $Name."
    }
  }

  $knownServices = @($manifest.services | ForEach-Object { [string]$_ })
  $workerServices = @($manifest.workerServices | ForEach-Object { [string]$_ })
  $requiredServices = @($topology.requiredServices | ForEach-Object { [string]$_ })
  $activeWorkers = @($requiredServices | Where-Object { $workerServices -contains $_ })
  if ($activeWorkers.Count -eq 0 -or (($activeWorkers -contains "worker") -and $activeWorkers.Count -gt 1)) {
    throw "The selected topology has ambiguous worker ownership."
  }

  foreach ($service in @($topology.rollbackServices) + @($topology.requiredHealthServices)) {
    if ($knownServices -notcontains $service -or $requiredServices -notcontains $service) {
      throw "The selected topology references a service that is not required by the topology."
    }
  }

  return [pscustomobject]@{
    Name = $Name
    Profiles = @($topology.profiles | ForEach-Object { [string]$_ })
    RollbackServices = @($topology.rollbackServices | ForEach-Object { [string]$_ })
    RequiredHealthServices = @($topology.requiredHealthServices | ForEach-Object { [string]$_ })
    ApplicationServices = @($knownServices | Where-Object {
      $_ -notin @("postgres", "redis", "redis-ephemeral", "migrate", "cloudflared")
    })
  }
}

function Get-ReleaseRecord {
  param(
    [Parameter(Mandatory)][string]$Path,
    [Parameter(Mandatory)][pscustomobject]$Config,
    [Parameter(Mandatory)][pscustomobject]$Topology
  )

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "The private release record was not found."
  }

  $record = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
  $commit = ([string]$record.commit).Trim()
  $previousRelease = ([string]$record.previousRelease).Trim()
  $failedTopology = ([string]$record.topology).Trim()
  $previousTopology = ([string]$record.previousTopology).Trim()
  $previousCommit = ([string]$record.previousCommit).Trim()
  $previousImageTags = @($record.previousImageTags | ForEach-Object { ([string]$_).Trim() } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  Assert-Matches -Name "Release record commit" -Value $commit -Pattern "^[a-f0-9]{40}$"
  Assert-Matches -Name "Release record previous release" -Value $previousRelease -Pattern "^/[A-Za-z0-9._/-]+$"
  Assert-Matches -Name "Release record failed topology" -Value $failedTopology -Pattern "^(all-in-one|all-in-one-with-chat|split|split-with-chat)$"
  Assert-Matches -Name "Release record previous topology" -Value $previousTopology -Pattern "^(all-in-one|all-in-one-with-chat|split|split-with-chat)$"
  Assert-Matches -Name "Release record previous commit" -Value $previousCommit -Pattern "^[a-f0-9]{40}$"

  if ($previousTopology -ne $Topology.Name) {
    throw "The selected topology must match the recorded topology that will be restored."
  }
  if (-not $previousRelease.StartsWith("$($Config.ReleaseRoot)/previous-", [System.StringComparison]::Ordinal)) {
    throw "The release record references a previous release outside the configured release root."
  }
  if ($previousImageTags.Count -ne $Topology.RollbackServices.Count) {
    throw "The release record image tags do not cover every rollback service."
  }

  $expectedServices = @($Topology.RollbackServices | Sort-Object)
  $recordedServices = @(
    $previousImageTags | ForEach-Object {
      if ($_ -notmatch "^([a-z0-9-]+)=([A-Za-z0-9][A-Za-z0-9._:/@-]*)$") {
        throw "The release record has an invalid previous image tag."
      }
      $Matches[1]
    } | Sort-Object
  )
  if (@(Compare-Object -ReferenceObject $expectedServices -DifferenceObject $recordedServices).Count -ne 0) {
    throw "The release record image tags do not match the selected rollback topology."
  }

  return [pscustomobject]@{
    Commit = $commit
    PreviousRelease = $previousRelease
    PreviousCommit = $previousCommit
    PreviousImageTags = $previousImageTags
    FailedTopology = $failedTopology
    RestoreTopology = $previousTopology
  }
}

function Invoke-RemoteScript {
  param(
    [Parameter(Mandatory)][pscustomobject]$Config,
    [Parameter(Mandatory)][string]$Script
  )

  $target = "$($Config.SshUser)@$($Config.SshHost)"
  $output = @(
    $Script | & ssh -o "BatchMode=yes" -i $Config.SshKeyPath $target "tr -d '\r' | bash -se" 2>&1
  )
  if ($LASTEXITCODE -ne 0) {
    throw "The remote rollback command failed with exit code $LASTEXITCODE."
  }

  return $output
}

function Get-RollbackMarker {
  param(
    [Parameter(Mandatory)][object[]]$Output,
    [Parameter(Mandatory)][string]$Name
  )

  $marker = @(
    $Output |
      ForEach-Object { $_.ToString().Trim() } |
      Where-Object { $_ -like "$Name=*" } |
      Select-Object -Last 1
  )
  if ($marker.Count -ne 1) {
    throw "The remote rollback did not return $Name."
  }

  return $marker[0].Substring($Name.Length + 1)
}

foreach ($command in "ssh", "curl.exe") {
  if ($null -eq (Get-Command $command -ErrorAction SilentlyContinue)) {
    throw "Required command '$command' is not available."
  }
}

$config = Get-RollbackConfiguration -Path $ConfigurationPath
$topology = Get-RollbackTopology -Name $Topology
$record = Get-ReleaseRecord -Path $ReleaseRecordPath -Config $config -Topology $topology
$shortSha = $record.Commit.Substring(0, 7)

Write-Host "Failed release commit: $($record.Commit)"
Write-Host "Recorded previous commit: $($record.PreviousCommit)"
Write-Host "Restored topology: $($topology.Name)"
Write-Host "Rollback services: $($topology.RollbackServices -join ', ')"

if ($DryRun) {
  Write-Host "Dry run passed. No VPS connection or production mutation was performed."
  exit 0
}

if (-not $Approve) {
  Write-Host "Rollback preflight passed. Re-run with -Approve to request the production rollback."
  exit 0
}

$confirmation = Read-Host "Type ROLLBACK $shortSha to restore the recorded previous release"
if ($confirmation -cne "ROLLBACK $shortSha") {
  throw "Production rollback was not approved."
}

$profilesPayload = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes(([string[]]$topology.Profiles -join "`n")))
$rollbackServicesPayload = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes(([string[]]$topology.RollbackServices -join "`n")))
$healthServicesPayload = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes(([string[]]$topology.RequiredHealthServices -join "`n")))
$applicationServicesPayload = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes(([string[]]$topology.ApplicationServices -join "`n")))
$previousImageTagsPayload = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes(([string[]]$record.PreviousImageTags -join "`n")))
$remoteScript = @'
set -euo pipefail
current='__APP_DIRECTORY__'
previous='__PREVIOUS_RELEASE__'
release_root='__RELEASE_ROOT__'
compose_project='__COMPOSE_PROJECT__'
canonical_host='__CANONICAL_HOST__'
topology_name='__TOPOLOGY_NAME__'
topology_profiles_b64='__TOPOLOGY_PROFILES_BASE64__'
topology_rollback_services_b64='__TOPOLOGY_ROLLBACK_SERVICES_BASE64__'
topology_health_services_b64='__TOPOLOGY_HEALTH_SERVICES_BASE64__'
topology_application_services_b64='__TOPOLOGY_APPLICATION_SERVICES_BASE64__'
previous_image_tags_b64='__PREVIOUS_IMAGE_TAGS_BASE64__'
failed="$release_root/failed-rollback-__SHORT_SHA__"

test -d "$current"
test -d "$previous"
test -f "$previous/.env"
test ! -e "$failed"

mapfile -t topology_profiles < <(printf '%s' "$topology_profiles_b64" | base64 -d)
mapfile -t topology_rollback_services < <(printf '%s' "$topology_rollback_services_b64" | base64 -d)
mapfile -t topology_health_services < <(printf '%s' "$topology_health_services_b64" | base64 -d)
mapfile -t topology_application_services < <(printf '%s' "$topology_application_services_b64" | base64 -d)
mapfile -t previous_image_tags < <(printf '%s' "$previous_image_tags_b64" | base64 -d)
test "${#topology_profiles[@]}" -gt 0
test "${#topology_rollback_services[@]}" -gt 0
test "${#topology_health_services[@]}" -gt 0
test "${#previous_image_tags[@]}" -eq "${#topology_rollback_services[@]}"
profile_args=()
for profile in "${topology_profiles[@]}"; do
  test -n "$profile"
  profile_args+=(--profile "$profile")
done
previous_compose() {
  sudo -n docker compose -p "$compose_project" --project-directory "$previous" "${profile_args[@]}" "$@"
}

previous_compose config -q
selected_service() {
  local candidate="$1"
  for service in "${topology_rollback_services[@]}"; do
    [ "$service" = "$candidate" ] && return 0
  done
  return 1
}
previous_compose_services="$(previous_compose config --services)"
previous_compose_images="$(previous_compose config --images)"
for service in "${topology_rollback_services[@]}"; do
  printf '%s\n' "$previous_compose_services" | awk -v expected="$service" '$0 == expected { found = 1 } END { exit !found }'
done
for image_entry in "${previous_image_tags[@]}"; do
  service="${image_entry%%=*}"
  image_name="${image_entry#*=}"
  selected_service "$service"
  printf '%s\n' "$previous_compose_images" | awk -v expected="$image_name" '$0 == expected { found = 1 } END { exit !found }'
  sudo -n docker image inspect "$image_name" >/dev/null
done

for data_service in postgres redis redis-ephemeral; do
  test "$(sudo -n docker inspect -f '{{.State.Health.Status}}' "app-$data_service-1")" = healthy
done

sudo -n mv "$current" "$failed"
sudo -n mv "$previous" "$current"

all_profile_args=(--profile all-in-one --profile split-workers --profile chat-workers --profile chat)
for service in "${topology_application_services[@]}"; do
  if ! selected_service "$service"; then
    sudo -n docker compose -p "$compose_project" --project-directory "$current" "${all_profile_args[@]}" stop "$service" >/dev/null 2>&1 || true
    sudo -n docker compose -p "$compose_project" --project-directory "$current" "${all_profile_args[@]}" rm -f "$service" >/dev/null 2>&1 || true
  fi
done

sudo -n docker compose -p "$compose_project" --project-directory "$current" "${profile_args[@]}" up -d --no-deps --no-build --force-recreate "${topology_rollback_services[@]}"

for image_entry in "${previous_image_tags[@]}"; do
  service="${image_entry%%=*}"
  image_name="${image_entry#*=}"
  actual_image="$(sudo -n docker inspect -f '{{.Config.Image}}' "app-$service-1")"
  test "$actual_image" = "$image_name"
done

for attempt in $(seq 1 18); do
  topology_healthy=true
  for service in "${topology_health_services[@]}"; do
    container_name="app-$service-1"
    health=$(sudo -n docker inspect -f '{{.State.Health.Status}}' "$container_name" 2>/dev/null || true)
    if [ "$health" != healthy ]; then
      topology_healthy=false
      break
    fi
  done
  [ "$topology_healthy" = true ] && break
  sleep 5
done

topology_health=()
for service in "${topology_health_services[@]}"; do
  container_name="app-$service-1"
  health=$(sudo -n docker inspect -f '{{.State.Health.Status}}' "$container_name")
  test "$health" = healthy
  topology_health+=("$service=$health")
  logging_driver=$(sudo -n docker inspect -f '{{.HostConfig.LogConfig.Type}}' "$container_name")
  test "$logging_driver" = journald
done

local_health="$(curl -fsS -H "Host: $canonical_host" http://127.0.0.1:3000/api/health)"
local_live="$(curl -fsS http://127.0.0.1:3000/api/live)"
test "$local_health" = '{"status":"ok"}'
test "$local_live" = '{"status":"ok"}'

printf 'FAILED_RELEASE=%s\n' "$failed"
printf 'FAILED_TOPOLOGY=__FAILED_TOPOLOGY__\n'
printf 'RESTORED_TOPOLOGY=%s\n' "$topology_name"
printf 'TOPOLOGY_HEALTH=%s\n' "${topology_health[*]}"
'@
$remoteScript = $remoteScript.Replace('__APP_DIRECTORY__', $config.AppDirectory).Replace('__PREVIOUS_RELEASE__', $record.PreviousRelease).Replace('__RELEASE_ROOT__', $config.ReleaseRoot).Replace('__COMPOSE_PROJECT__', $config.ComposeProject).Replace('__CANONICAL_HOST__', $config.CanonicalHost).Replace('__TOPOLOGY_NAME__', $topology.Name).Replace('__TOPOLOGY_PROFILES_BASE64__', $profilesPayload).Replace('__TOPOLOGY_ROLLBACK_SERVICES_BASE64__', $rollbackServicesPayload).Replace('__TOPOLOGY_HEALTH_SERVICES_BASE64__', $healthServicesPayload).Replace('__TOPOLOGY_APPLICATION_SERVICES_BASE64__', $applicationServicesPayload).Replace('__PREVIOUS_IMAGE_TAGS_BASE64__', $previousImageTagsPayload).Replace('__FAILED_TOPOLOGY__', $record.FailedTopology).Replace('__SHORT_SHA__', $shortSha)
$output = Invoke-RemoteScript -Config $config -Script $remoteScript
$failedRelease = Get-RollbackMarker -Output $output -Name "FAILED_RELEASE"
$failedTopology = Get-RollbackMarker -Output $output -Name "FAILED_TOPOLOGY"
$rolledBackTopology = Get-RollbackMarker -Output $output -Name "RESTORED_TOPOLOGY"
$topologyHealth = Get-RollbackMarker -Output $output -Name "TOPOLOGY_HEALTH"

$publicHealth = (& curl.exe -fsS "https://$($config.CanonicalHost)/api/health" | Out-String).Trim()
if ($publicHealth -ne '{"status":"ok"}') {
  throw "The public health endpoint did not return the expected status after rollback."
}

Write-Host "Rollback complete and verified. Failed release retained at: $failedRelease"
Write-Host "Restored topology: $rolledBackTopology from $failedTopology ($topologyHealth)"

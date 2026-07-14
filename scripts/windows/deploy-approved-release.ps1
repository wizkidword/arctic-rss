[CmdletBinding()]
param(
  [Parameter(Mandatory)]
  [string]$ConfigurationPath,

  [ValidateRange(1, 120)]
  [int]$CiTimeoutMinutes = 30,

  [switch]$Approve,

  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-RequiredCommand {
  param(
    [Parameter(Mandatory)][string]$FilePath,
    [Parameter(Mandatory)][string[]]$Arguments
  )

  $output = @(& $FilePath @Arguments 2>&1)
  if ($LASTEXITCODE -ne 0) {
    throw "$FilePath failed with exit code $LASTEXITCODE."
  }

  return $output
}

function Invoke-LocalCheck {
  param(
    [Parameter(Mandatory)][string]$Label,
    [Parameter(Mandatory)][string]$FilePath,
    [Parameter(Mandatory)][string[]]$Arguments
  )

  Write-Host "==> $Label"
  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Label failed with exit code $LASTEXITCODE."
  }
}

function Assert-Matches {
  param(
    [Parameter(Mandatory)][string]$Name,
    [Parameter(Mandatory)][string]$Value,
    [Parameter(Mandatory)][string]$Pattern
  )

  if ($Value -notmatch $Pattern) {
    throw "Release configuration contains an invalid $Name."
  }
}

function Get-ReleaseConfiguration {
  param([Parameter(Mandatory)][string]$Path)

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "Release configuration was not found."
  }

  $raw = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
  foreach ($property in "SshHost", "SshUser", "SshKeyPath", "AppDirectory", "ComposeProject", "CanonicalHost") {
    if ([string]::IsNullOrWhiteSpace([string]$raw.$property)) {
      throw "Release configuration is missing $property."
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

  $recordDirectory = if ([string]::IsNullOrWhiteSpace([string]$raw.ReleaseRecordDirectory)) {
    Join-Path ([Environment]::GetFolderPath("LocalApplicationData")) "ArcticRSS\release-records"
  } else {
    [string]$raw.ReleaseRecordDirectory
  }

  return [pscustomobject]@{
    SshHost = $sshHost
    SshUser = $sshUser
    SshKeyPath = (Resolve-Path -LiteralPath $sshKeyPath).Path
    AppDirectory = $appDirectory
    ReleaseRoot = $appDirectory.Substring(0, $releaseRootIndex)
    ComposeProject = $composeProject
    CanonicalHost = $canonicalHost
    ReleaseRecordDirectory = $recordDirectory
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
    throw "The remote release command failed with exit code $LASTEXITCODE."
  }

  return $output
}

function Get-ReleaseMarker {
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
    throw "The remote release did not return $Name."
  }

  return $marker[0].Substring($Name.Length + 1)
}

function Get-ReleaseRun {
  param(
    [Parameter(Mandatory)][string]$Repository,
    [Parameter(Mandatory)][string]$Commit
  )

  $json = (Invoke-RequiredCommand -FilePath "gh" -Arguments @(
    "run", "list", "--repo", $Repository, "--commit", $Commit,
    "--workflow", "ci.yml", "--limit", "20",
    "--json", "databaseId,status,conclusion,url,createdAt"
  ) | Out-String).Trim()
  if ([string]::IsNullOrWhiteSpace($json)) {
    return $null
  }

  return @($json | ConvertFrom-Json | Sort-Object createdAt -Descending | Select-Object -First 1)[0]
}

function Wait-ForSuccessfulCi {
  param(
    [Parameter(Mandatory)][string]$Repository,
    [Parameter(Mandatory)][string]$Commit,
    [Parameter(Mandatory)][int]$TimeoutMinutes
  )

  $requiredJobs = @(
    "Quality, migrations, and unit tests",
    "Browser smoke test",
    "Secret scan",
    "Static analysis",
    "Installed dependency audit",
    "Container scan and SBOM"
  )
  $deadline = (Get-Date).ToUniversalTime().AddMinutes($TimeoutMinutes)

  while ($true) {
    $run = Get-ReleaseRun -Repository $Repository -Commit $Commit
    if ($null -ne $run -and $run.status -eq "completed") {
      if ($run.conclusion -ne "success") {
        throw "GitHub CI did not succeed for the target commit."
      }

      $details = Invoke-RequiredCommand -FilePath "gh" -Arguments @(
        "run", "view", [string]$run.databaseId, "--repo", $Repository,
        "--json", "jobs,status,conclusion,url"
      ) | Out-String | ConvertFrom-Json

      foreach ($requiredJob in $requiredJobs) {
        $job = @($details.jobs | Where-Object { $_.name -eq $requiredJob } | Select-Object -First 1)
        if ($job.Count -ne 1 -or $job[0].conclusion -ne "success") {
          throw "GitHub CI is missing a successful '$requiredJob' job."
        }
      }

      return [pscustomobject]@{
        Id = [string]$run.databaseId
        Url = [string]$details.url
      }
    }

    if ((Get-Date).ToUniversalTime() -ge $deadline) {
      throw "Timed out waiting for successful GitHub CI."
    }

    Write-Host "Waiting for GitHub CI for the target commit..."
    Start-Sleep -Seconds 10
  }
}

foreach ($command in "git", "gh", "npm", "npx", "ssh", "scp", "curl.exe") {
  if ($null -eq (Get-Command $command -ErrorAction SilentlyContinue)) {
    throw "Required command '$command' is not available."
  }
}

$config = Get-ReleaseConfiguration -Path $ConfigurationPath
$workingTree = @(& git status --porcelain)
if ($workingTree.Count -ne 0) {
  throw "Refusing to release from a working tree with uncommitted changes."
}

Invoke-LocalCheck -Label "Fetching origin/main" -FilePath "git" -Arguments @("fetch", "origin", "main")
$commit = (Invoke-RequiredCommand -FilePath "git" -Arguments @("rev-parse", "--verify", "HEAD^{commit}") | Select-Object -Last 1).Trim()
$originMain = (Invoke-RequiredCommand -FilePath "git" -Arguments @("rev-parse", "--verify", "origin/main^{commit}") | Select-Object -Last 1).Trim()
if ($commit -ne $originMain) {
  throw "Refusing to release because HEAD is not the current origin/main commit."
}

Invoke-LocalCheck -Label "Checking patch integrity" -FilePath "git" -Arguments @("diff", "--check")
Invoke-LocalCheck -Label "Running unit tests" -FilePath "npm" -Arguments @("test")
Invoke-LocalCheck -Label "Checking TypeScript" -FilePath "npm" -Arguments @("run", "typecheck")
Invoke-LocalCheck -Label "Running lint" -FilePath "npm" -Arguments @("run", "lint")
Invoke-LocalCheck -Label "Building production application" -FilePath "npm" -Arguments @("run", "build")
$schemaEol = (Invoke-RequiredCommand -FilePath "git" -Arguments @(
  "ls-files", "--eol", "--", "prisma/schema.prisma"
) | Out-String).Trim()
if ([string]::IsNullOrWhiteSpace($schemaEol)) {
  throw "The tracked Prisma schema could not be located for formatting verification."
}

if ($schemaEol -match "\bw/crlf\b") {
  Write-Host "Prisma schema is CRLF-normalized locally; exact-commit CI verifies canonical LF formatting."
} else {
  Invoke-LocalCheck -Label "Checking Prisma format" -FilePath "npx" -Arguments @("prisma", "format", "--check")
}
Invoke-LocalCheck -Label "Validating Prisma schema" -FilePath "npx" -Arguments @("prisma", "validate")

$repository = (Invoke-RequiredCommand -FilePath "gh" -Arguments @("repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner") | Select-Object -Last 1).Trim()
$ci = Wait-ForSuccessfulCi -Repository $repository -Commit $commit -TimeoutMinutes $CiTimeoutMinutes
$shortSha = $commit.Substring(0, 7)

Write-Host "Target commit: $commit"
Write-Host "GitHub CI: $($ci.Url)"

if ($DryRun) {
  Write-Host "Dry run passed. No archive, backup, upload, or production mutation was performed."
  exit 0
}

if (-not $Approve) {
  Write-Host "Preflight passed. Re-run with -Approve to request a production release."
  exit 0
}

$confirmation = Read-Host "Type DEPLOY $shortSha to start the approved production release"
if ($confirmation -cne "DEPLOY $shortSha") {
  throw "Production release was not approved."
}

$backupOutput = Invoke-RemoteScript -Config $config -Script @'
set -euo pipefail
sudo -n systemctl start --wait arctic-rss-backup.service
backup_result="$(sudo -n systemctl show arctic-rss-backup.service -p Result --value)"
backup_status="$(sudo -n systemctl show arctic-rss-backup.service -p ExecMainStatus --value)"
test "$backup_result" = "success"
test "$backup_status" = "0"
backup_id="$(sudo -n /usr/local/sbin/arctic-rss-latest-backup)"
test "$backup_id" != ""
printf 'BACKUP_ID=%s\n' "$backup_id"
'@
$backupId = Get-ReleaseMarker -Output $backupOutput -Name "BACKUP_ID"

$archivePath = Join-Path ([System.IO.Path]::GetTempPath()) "arctic-rss-$shortSha-$PID.tar.gz"
try {
  Invoke-LocalCheck -Label "Creating exact source archive" -FilePath "git" -Arguments @(
    "archive", "--format=tar.gz", "--output=$archivePath", $commit
  )
  $archiveHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $archivePath).Hash.ToLowerInvariant()
  $remoteArchive = "/tmp/arctic-rss-$shortSha.tar.gz"
  $target = "$($config.SshUser)@$($config.SshHost):$remoteArchive"

  Write-Host "==> Uploading exact release archive"
  Invoke-RequiredCommand -FilePath "scp" -Arguments @(
    "-q", "-o", "BatchMode=yes", "-i", $config.SshKeyPath, $archivePath, $target
  ) | Out-Null

  $remoteScript = @'
set -euo pipefail
short_sha='__SHORT_SHA__'
archive='/tmp/arctic-rss-__SHORT_SHA__.tar.gz'
expected_hash='__ARCHIVE_HASH__'
release_root='__RELEASE_ROOT__'
live='__APP_DIRECTORY__'
stage="$release_root/staging/$short_sha"
previous="$release_root/previous-$short_sha"
compose_project='__COMPOSE_PROJECT__'
canonical_host='__CANONICAL_HOST__'

actual_hash="$(sha256sum "$archive" | awk '{print $1}')"
test "$actual_hash" = "$expected_hash"
test ! -e "$stage"
test ! -e "$previous"
test -f "$live/.env"

sudo -n install -d -m 755 "$stage"
sudo -n tar -xzf "$archive" -C "$stage"
test -f "$stage/ops/systemd/60-arctic-rss-log-retention.conf"
sudo -n install -m 600 -o root -g root "$live/.env" "$stage/.env"
sudo -n docker compose -p "$compose_project" --project-directory "$stage" config -q
sudo -n install -d -m 755 /etc/systemd/journald.conf.d
sudo -n install -m 644 "$stage/ops/systemd/60-arctic-rss-log-retention.conf" /etc/systemd/journald.conf.d/60-arctic-rss-log-retention.conf
sudo -n systemctl restart systemd-journald
sudo -n systemd-analyze cat-config systemd/journald.conf | grep -qx 'MaxRetentionSec=30day'
sudo -n journalctl --rotate
sudo -n journalctl --vacuum-time=30d
sudo -n docker compose -p "$compose_project" --project-directory "$stage" build migrate web worker chat-gateway
sudo -n docker compose -p "$compose_project" --project-directory "$stage" run --rm --no-deps -T migrate </dev/null
sudo -n docker compose -p "$compose_project" --project-directory "$stage" run --rm --no-deps -T migrate ./node_modules/.bin/prisma migrate status </dev/null
sudo -n mv "$live" "$previous"
sudo -n mv "$stage" "$live"
sudo -n docker compose -p "$compose_project" --project-directory "$live" up -d --no-deps --force-recreate postgres redis

for attempt in $(seq 1 18); do
  postgres_health="$(sudo -n docker inspect -f '{{.State.Health.Status}}' app-postgres-1)"
  redis_health="$(sudo -n docker inspect -f '{{.State.Health.Status}}' app-redis-1)"
  if [ "$postgres_health" = healthy ] && [ "$redis_health" = healthy ]; then
    break
  fi
  sleep 5
done

test "$postgres_health" = healthy
test "$redis_health" = healthy
sudo -n docker compose -p "$compose_project" --project-directory "$live" up -d --no-deps --force-recreate web worker

for attempt in $(seq 1 18); do
  web_health="$(sudo -n docker inspect -f '{{.State.Health.Status}}' app-web-1)"
  worker_health="$(sudo -n docker inspect -f '{{.State.Health.Status}}' app-worker-1)"
  if [ "$web_health" = healthy ] && [ "$worker_health" = healthy ]; then
    break
  fi
  sleep 5
done

test "$web_health" = healthy
test "$worker_health" = healthy

for container in app-postgres-1 app-redis-1 app-web-1 app-worker-1; do
  test "$(sudo -n docker inspect -f '{{.HostConfig.LogConfig.Type}}' "$container")" = journald
done

local_health="$(curl -fsS -H "Host: $canonical_host" http://127.0.0.1:3000/api/health)"
local_live="$(curl -fsS http://127.0.0.1:3000/api/live)"
test "$local_health" = '{"status":"ok"}'
test "$local_live" = '{"status":"ok"}'
monitor_timer="$(sudo -n systemctl is-active arctic-rss-monitor.timer)"
monitor_result="$(sudo -n systemctl show arctic-rss-monitor.service -p Result --value)"
monitor_status="$(sudo -n systemctl show arctic-rss-monitor.service -p ExecMainStatus --value)"
test "$monitor_timer" = active
test "$monitor_result" = success
test "$monitor_status" = 0

printf 'PREVIOUS_RELEASE=%s\n' "$previous"
printf 'WEB_HEALTH=%s\n' "$web_health"
printf 'WORKER_HEALTH=%s\n' "$worker_health"
'@
  $remoteScript = $remoteScript.Replace('__SHORT_SHA__', $shortSha).Replace('__ARCHIVE_HASH__', $archiveHash).Replace('__RELEASE_ROOT__', $config.ReleaseRoot).Replace('__APP_DIRECTORY__', $config.AppDirectory).Replace('__COMPOSE_PROJECT__', $config.ComposeProject).Replace('__CANONICAL_HOST__', $config.CanonicalHost)
  $stageOutput = Invoke-RemoteScript -Config $config -Script $remoteScript
  $previousRelease = Get-ReleaseMarker -Output $stageOutput -Name "PREVIOUS_RELEASE"
  $webHealth = Get-ReleaseMarker -Output $stageOutput -Name "WEB_HEALTH"
  $workerHealth = Get-ReleaseMarker -Output $stageOutput -Name "WORKER_HEALTH"

  $publicHealth = (Invoke-RequiredCommand -FilePath "curl.exe" -Arguments @(
    "-fsS", "https://$($config.CanonicalHost)/api/health"
  ) | Out-String).Trim()
  if ($publicHealth -ne '{"status":"ok"}') {
    throw "The public health endpoint did not return the expected status."
  }
  $loginStatus = (Invoke-RequiredCommand -FilePath "curl.exe" -Arguments @(
    "-fsS", "-o", "NUL", "-w", "%{http_code}", "https://$($config.CanonicalHost)/login"
  ) | Out-String).Trim()
  if ($loginStatus -ne "200") {
    throw "The public login page did not return HTTP 200."
  }

  New-Item -ItemType Directory -Force -Path $config.ReleaseRecordDirectory | Out-Null
  $deployedAt = (Get-Date).ToUniversalTime().ToString("o")
  $recordName = "$($deployedAt.Replace(':', '-'))-$shortSha.json"
  $recordPath = Join-Path $config.ReleaseRecordDirectory $recordName
  [ordered]@{
    archiveSha256 = $archiveHash
    backupId = $backupId
    commit = $commit
    deployedAtUtc = $deployedAt
    githubCiRun = $ci.Url
    loginHttpStatus = $loginStatus
    previousRelease = $previousRelease
    publicHealth = $publicHealth
    webHealth = $webHealth
    workerHealth = $workerHealth
  } | ConvertTo-Json | Set-Content -LiteralPath $recordPath -Encoding utf8

  Write-Host "Release complete and verified. Private release record: $recordPath"
} finally {
  if (Test-Path -LiteralPath $archivePath) {
    Remove-Item -LiteralPath $archivePath -Force
  }
}

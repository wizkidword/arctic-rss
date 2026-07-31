[CmdletBinding()]
param(
  [Parameter(Mandatory)]
  [string]$ConfigurationPath,

  [ValidateRange(1, 120)]
  [int]$CiTimeoutMinutes = 30,

  # Keep production image builds off the VPS. The default matches the dedicated
  # local builder location; operators on another machine can set this private,
  # non-secret path in their release configuration instead.
  [string]$LocalBuildRoot,

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

  $configuredBuildRootProperty = $raw.PSObject.Properties["LocalBuildRoot"]
  $configuredBuildRoot = if ($null -eq $configuredBuildRootProperty) {
    ""
  } else {
    [string]$configuredBuildRootProperty.Value
  }

  $localBuildRoot = if ([string]::IsNullOrWhiteSpace([string]$LocalBuildRoot)) {
    if ([string]::IsNullOrWhiteSpace($configuredBuildRoot)) {
      "D:\Arctic RSS Docker"
    } else {
      $configuredBuildRoot
    }
  } else {
    $LocalBuildRoot
  }

  if (-not (Test-Path -LiteralPath $localBuildRoot -PathType Container)) {
    throw "The local Docker build root was not found. Create it or set LocalBuildRoot in the private release configuration."
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
    LocalBuildRoot = (Resolve-Path -LiteralPath $localBuildRoot).Path
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

function Get-DockerExecutable {
  $dockerCommand = Get-Command "docker" -ErrorAction SilentlyContinue
  if ($null -ne $dockerCommand) {
    return $dockerCommand.Source
  }

  $perUserDocker = Join-Path $env:LOCALAPPDATA "Programs\DockerDesktop\resources\bin\docker.exe"
  if (Test-Path -LiteralPath $perUserDocker -PathType Leaf) {
    return $perUserDocker
  }

  throw "Docker Desktop's command-line client was not found. Start Docker Desktop and open a new terminal before releasing."
}

function Get-RemotePublicBuildSettings {
  param([Parameter(Mandatory)][pscustomobject]$Config)

  # This reads only the client-visible analytics identifier. It is returned in
  # base64 so the remote command's structured output remains single-line and
  # it is never written to the console or release record.
  $script = @'
set -euo pipefail
env_file='__APP_DIRECTORY__/.env'
test -f "$env_file"
ga_measurement_id="$(sudo -n awk -F= '$1 == "NEXT_PUBLIC_GA_MEASUREMENT_ID" { sub(/^[^=]*=/, ""); print; exit }' "$env_file")"
case "$ga_measurement_id" in
  \"*\")
    ga_measurement_id="${ga_measurement_id#\"}"
    ga_measurement_id="${ga_measurement_id%\"}"
    ;;
esac
case "$ga_measurement_id" in
  ""|G-[A-Z0-9]*) ;;
  *) printf 'Invalid public analytics identifier in the live environment.\n' >&2; exit 1 ;;
esac
printf 'NEXT_PUBLIC_GA_MEASUREMENT_ID_B64=%s\n' "$(printf '%s' "$ga_measurement_id" | base64 | tr -d '\n')"
'@
  $script = $script.Replace('__APP_DIRECTORY__', $Config.AppDirectory)
  $output = Invoke-RemoteScript -Config $Config -Script $script
  $encodedMeasurementId = Get-ReleaseMarker -Output $output -Name "NEXT_PUBLIC_GA_MEASUREMENT_ID_B64"

  try {
    $measurementId = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($encodedMeasurementId))
  } catch {
    throw "The remote public build setting was not valid base64."
  }

  if ($measurementId -notmatch '^(|G-[A-Z0-9]+)$') {
    throw "The remote public analytics identifier had an unexpected format."
  }

  return [pscustomobject]@{
    AppOrigin = "https://$($Config.CanonicalHost)"
    GoogleAnalyticsMeasurementId = $measurementId
  }
}

function New-OffHostReleaseImages {
  param(
    [Parameter(Mandatory)][pscustomobject]$Config,
    [Parameter(Mandatory)][string]$DockerExecutable,
    [Parameter(Mandatory)][string]$Commit,
    [Parameter(Mandatory)][string]$ShortSha,
    [Parameter(Mandatory)][pscustomobject]$BuildSettings
  )

  $workspaceRoot = Join-Path $Config.LocalBuildRoot "build-workspace"
  $archiveRoot = Join-Path $Config.LocalBuildRoot "image-archives"
  $sourceDirectory = Join-Path $workspaceRoot "release-$ShortSha"
  # Keep the archive outside the Docker build context so it cannot become an
  # unnecessary layer in every production image.
  $sourceArchive = Join-Path $workspaceRoot "release-$ShortSha-source.tar"
  $imageArchive = Join-Path $archiveRoot "arctic-rss-$ShortSha-images.tar"

  New-Item -ItemType Directory -Force -Path $workspaceRoot, $archiveRoot | Out-Null
  if ((Test-Path -LiteralPath $sourceDirectory) -or (Test-Path -LiteralPath $sourceArchive)) {
    throw "The exact local image-build workspace already exists. Review or remove it before rebuilding this release."
  }
  if (Test-Path -LiteralPath $imageArchive) {
    throw "The exact local image archive already exists. Review or remove it before rebuilding this release."
  }

  New-Item -ItemType Directory -Path $sourceDirectory | Out-Null
  $sourceArchiveOutput = Invoke-LocalCheck -Label "Creating exact local image-build source" -FilePath "git" -Arguments @(
    "archive", "--format=tar", "--output=$sourceArchive", $Commit
  )
  $sourceArchiveOutput | Out-Host
  $sourceExtractionOutput = Invoke-LocalCheck -Label "Extracting exact local image-build source" -FilePath "tar.exe" -Arguments @(
    "-xf", $sourceArchive, "-C", $sourceDirectory
  )
  $sourceExtractionOutput | Out-Host

  $images = [ordered]@{
    # The tag is intentionally unique to this release. Loading an archive must
    # never replace the image selected by the currently live Compose source.
    Migrate = "$($Config.ComposeProject)-migrate:release-$ShortSha"
    Web = "$($Config.ComposeProject)-web:release-$ShortSha"
    Worker = "$($Config.ComposeProject)-worker:release-$ShortSha"
    ChatGateway = "$($Config.ComposeProject)-chat-gateway:release-$ShortSha"
    EdgeProxy = "$($Config.ComposeProject)-edge-proxy:release-$ShortSha"
  }
  $imageEnvironmentVariables = [ordered]@{
    Migrate = "MIGRATE_IMAGE"
    Web = "WEB_IMAGE"
    Worker = "WORKER_IMAGE"
    ChatGateway = "CHAT_GATEWAY_IMAGE"
    EdgeProxy = "EDGE_PROXY_IMAGE"
  }
  $buildTargets = [ordered]@{
    Migrate = "migrate"
    Web = "runner"
    Worker = "worker"
    ChatGateway = "chat-gateway"
    EdgeProxy = "edge-proxy"
  }

  foreach ($name in $images.Keys) {
    $imageBuildOutput = Invoke-LocalCheck -Label "Building $name image locally" -FilePath $DockerExecutable -Arguments @(
      "build", "--platform", "linux/amd64", "--file", (Join-Path $sourceDirectory "Dockerfile"),
      "--target", $buildTargets[$name], "--tag", $images[$name],
      "--build-arg", "APP_ORIGIN=$($BuildSettings.AppOrigin)",
      "--build-arg", "NEXT_PUBLIC_GA_MEASUREMENT_ID=$($BuildSettings.GoogleAnalyticsMeasurementId)",
      $sourceDirectory
    )
    $imageBuildOutput | Out-Host
  }

  $imageSaveArguments = @("image", "save", "--output", $imageArchive) + @($images.Values)
  $imageArchiveOutput = Invoke-LocalCheck -Label "Creating transfer-ready image archive" -FilePath $DockerExecutable -Arguments $imageSaveArguments
  $imageArchiveOutput | Out-Host

  $archiveInfo = Get-Item -LiteralPath $imageArchive
  if ($archiveInfo.Length -le 0) {
    throw "The local image archive was empty."
  }

  return [pscustomobject]@{
    ArchivePath = $imageArchive
    ArchiveHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $imageArchive).Hash.ToLowerInvariant()
    ArchiveBytes = $archiveInfo.Length
    Images = @($images.Values)
    ImageEnvironment = @(
      $images.Keys | ForEach-Object {
        "$($imageEnvironmentVariables[$_])=$($images[$_])"
      }
    )
  }
}

function Assert-RemoteImageCapacity {
  param(
    [Parameter(Mandatory)][pscustomobject]$Config,
    [Parameter(Mandatory)][long]$ImageArchiveBytes
  )

  # Keep room for the uploaded archive, Docker's loaded layers, and normal OS
  # work. This is deliberately conservative and stops before backup or any
  # application mutation when the current host does not have the margin.
  $requiredBytes = ($ImageArchiveBytes * 2L) + 2GB
  $script = @'
set -euo pipefail
available_kib="$(df -Pk / | awk 'NR == 2 { print $4 }')"
echo "ROOT_AVAILABLE_KIB=$available_kib"
'@
  $output = Invoke-RemoteScript -Config $Config -Script $script
  $availableKib = Get-ReleaseMarker -Output $output -Name "ROOT_AVAILABLE_KIB"
  if ($availableKib -notmatch '^[0-9]+$') {
    throw "The remote disk-capacity preflight returned an invalid value."
  }

  if (([int64]$availableKib * 1KB) -lt $requiredBytes) {
    throw "The OVH host does not have enough free disk for the transferred images with the required safety margin."
  }
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

function Add-MigrationOwnershipTarget {
  param(
    [Parameter(Mandatory)][AllowEmptyCollection()][System.Collections.Generic.List[object]]$Targets,
    [Parameter(Mandatory)][hashtable]$Seen,
    [Parameter(Mandatory)][string]$MigrationName,
    [Parameter(Mandatory)][string]$Kind,
    [Parameter(Mandatory)][string]$Schema,
    [Parameter(Mandatory)][AllowEmptyString()][string]$ObjectName
  )

  if ($MigrationName -notmatch "^[A-Za-z0-9_]+$") {
    throw "Migration ownership preflight found an unsupported identifier."
  }
  foreach ($value in @($Kind, $Schema)) {
    if ($value -notmatch "^[A-Za-z_][A-Za-z0-9_]*$") {
      throw "Migration ownership preflight found an unsupported identifier."
    }
  }
  if (-not [string]::IsNullOrWhiteSpace($ObjectName) -and $ObjectName -notmatch "^[A-Za-z_][A-Za-z0-9_]*$") {
    throw "Migration ownership preflight found an unsupported identifier."
  }

  $key = "$MigrationName|$Kind|$Schema|$ObjectName"
  if ($Seen.ContainsKey($key)) {
    return
  }

  $Seen[$key] = $true
  $Targets.Add([pscustomobject]@{
    MigrationName = $MigrationName
    Kind = $Kind
    Schema = $Schema
    ObjectName = $ObjectName
  })
}

function Get-MigrationOwnershipTargets {
  param([Parameter(Mandatory)][string]$MigrationsDirectory)

  if (-not (Test-Path -LiteralPath $MigrationsDirectory -PathType Container)) {
    throw "The tracked Prisma migrations directory could not be located."
  }

  $targets = [System.Collections.Generic.List[object]]::new()
  $seen = @{}
  $objectPatterns = @(
    [pscustomobject]@{ Kind = "TYPE"; Pattern = '(?im)^\s*ALTER\s+(?:TYPE|DOMAIN)\s+(?:(?<schema>"[A-Za-z_][A-Za-z0-9_]*"|[A-Za-z_][A-Za-z0-9_]*)\.)?(?<object>"[A-Za-z_][A-Za-z0-9_]*")' },
    [pscustomobject]@{ Kind = "RELATION"; Pattern = '(?im)^\s*ALTER\s+(?:TABLE|SEQUENCE|MATERIALIZED\s+VIEW|INDEX)\s+(?:IF\s+EXISTS\s+)?(?:(?<schema>"[A-Za-z_][A-Za-z0-9_]*"|[A-Za-z_][A-Za-z0-9_]*)\.)?(?<object>"[A-Za-z_][A-Za-z0-9_]*")' },
    [pscustomobject]@{ Kind = "RELATION"; Pattern = '(?im)^\s*CREATE\s+(?:UNIQUE\s+)?INDEX(?:\s+CONCURRENTLY)?(?:\s+IF\s+NOT\s+EXISTS)?\s+"[A-Za-z_][A-Za-z0-9_]*"\s+ON\s+(?:(?<schema>"[A-Za-z_][A-Za-z0-9_]*"|[A-Za-z_][A-Za-z0-9_]*)\.)?(?<object>"[A-Za-z_][A-Za-z0-9_]*")' }
  )

  foreach ($directory in Get-ChildItem -LiteralPath $MigrationsDirectory -Directory | Sort-Object Name) {
    $migrationName = $directory.Name
    if ($migrationName -notmatch "^[A-Za-z0-9_]+$") {
      throw "Migration ownership preflight found an unsupported migration directory."
    }

    $migrationPath = Join-Path $directory.FullName "migration.sql"
    if (-not (Test-Path -LiteralPath $migrationPath -PathType Leaf)) {
      continue
    }

    $sql = Get-Content -LiteralPath $migrationPath -Raw
    foreach ($pattern in $objectPatterns) {
      foreach ($match in [regex]::Matches($sql, $pattern.Pattern)) {
        $schema = $match.Groups["schema"].Value -replace '^"|"$', ''
        if ([string]::IsNullOrWhiteSpace($schema)) {
          $schema = "public"
        }
        $objectName = $match.Groups["object"].Value -replace '^"|"$', ''
        Add-MigrationOwnershipTarget -Targets $targets -Seen $seen -MigrationName $migrationName -Kind $pattern.Kind -Schema $schema -ObjectName $objectName
      }
    }

    if ($sql -match '(?im)^\s*CREATE\s+(?:TABLE|TYPE|SEQUENCE|VIEW|MATERIALIZED\s+VIEW)\b') {
      Add-MigrationOwnershipTarget -Targets $targets -Seen $seen -MigrationName $migrationName -Kind "SCHEMA_CREATE" -Schema "public" -ObjectName ""
    }
    if ($sql -match '(?im)^\s*CREATE\s+EXTENSION\b') {
      Add-MigrationOwnershipTarget -Targets $targets -Seen $seen -MigrationName $migrationName -Kind "DATABASE_CREATE" -Schema "public" -ObjectName ""
    }
  }

  return $targets.ToArray()
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

foreach ($command in "git", "gh", "npm", "npx", "ssh", "scp", "curl.exe", "tar.exe") {
  if ($null -eq (Get-Command $command -ErrorAction SilentlyContinue)) {
    throw "Required command '$command' is not available."
  }
}

$config = Get-ReleaseConfiguration -Path $ConfigurationPath
$dockerExecutable = Get-DockerExecutable
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
$migrationOwnershipTargets = Get-MigrationOwnershipTargets -MigrationsDirectory (Join-Path (Get-Location) "prisma/migrations")

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

if ($migrationOwnershipTargets.Count -gt 0) {
  $ownershipTargetLines = @(
    $migrationOwnershipTargets | ForEach-Object {
      "$($_.MigrationName)`t$($_.Kind)`t$($_.Schema)`t$($_.ObjectName)"
    }
  )
  $ownershipTargetPayload = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes(($ownershipTargetLines -join "`n")))
  $ownershipPreflightScript = @'
set -euo pipefail
live='__APP_DIRECTORY__'
compose_project='__COMPOSE_PROJECT__'
target_payload_b64='__OWNERSHIP_TARGETS_BASE64__'
targets="$(printf '%s' "$target_payload_b64" | base64 -d)"

query_database() {
  local sql="$1"
  sudo -n docker exec app-postgres-1 sh -c 'exec psql -v ON_ERROR_STOP=1 -At -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "$1"' sh "$sql"
}

finished_migrations="$(query_database "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;")"
is_migration_finished() {
  printf '%s\n' "$finished_migrations" | awk -v candidate="$1" '$0 == candidate { found = 1 } END { exit !found }'
}

pending_targets=0
while IFS=$'\t' read -r migration kind schema object_name; do
  [ -n "$migration" ] || continue
  if ! is_migration_finished "$migration"; then
    pending_targets=$((pending_targets + 1))
  fi
done <<< "$targets"

if [ "$pending_targets" -eq 0 ]; then
  printf 'MIGRATION_OWNERSHIP_PRECHECK=passed\n'
  exit 0
fi

migration_user="$(sudo -n docker compose -p "$compose_project" --project-directory "$live" run --rm --no-deps -T migrate node -e 'process.stdout.write(new URL(process.env.DATABASE_URL).username)' </dev/null 2>/dev/null)"
printf '%s' "$migration_user" | grep -Eq '^[A-Za-z_][A-Za-z0-9_]*$'

ownership_failure=0
while IFS=$'\t' read -r migration kind schema object_name; do
  [ -n "$migration" ] || continue
  if is_migration_finished "$migration"; then
    continue
  fi

  case "$kind" in
    TYPE)
      ownership_state="$(query_database "SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM pg_type type_object JOIN pg_namespace schema_object ON schema_object.oid = type_object.typnamespace WHERE schema_object.nspname = '$schema' AND type_object.typname = '$object_name') THEN 'missing' WHEN EXISTS (SELECT 1 FROM pg_type type_object JOIN pg_namespace schema_object ON schema_object.oid = type_object.typnamespace WHERE schema_object.nspname = '$schema' AND type_object.typname = '$object_name' AND (type_object.typowner = (SELECT oid FROM pg_roles WHERE rolname = '$migration_user') OR pg_has_role('$migration_user', type_object.typowner, 'USAGE') OR (SELECT rolsuper FROM pg_roles WHERE rolname = '$migration_user'))) THEN 'owned' ELSE 'unowned' END;")"
      ;;
    RELATION)
      ownership_state="$(query_database "SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM pg_class relation_object JOIN pg_namespace schema_object ON schema_object.oid = relation_object.relnamespace WHERE schema_object.nspname = '$schema' AND relation_object.relname = '$object_name') THEN 'missing' WHEN EXISTS (SELECT 1 FROM pg_class relation_object JOIN pg_namespace schema_object ON schema_object.oid = relation_object.relnamespace WHERE schema_object.nspname = '$schema' AND relation_object.relname = '$object_name' AND (relation_object.relowner = (SELECT oid FROM pg_roles WHERE rolname = '$migration_user') OR pg_has_role('$migration_user', relation_object.relowner, 'USAGE') OR (SELECT rolsuper FROM pg_roles WHERE rolname = '$migration_user'))) THEN 'owned' ELSE 'unowned' END;")"
      ;;
    SCHEMA_CREATE)
      ownership_state="$(query_database "SELECT CASE WHEN has_schema_privilege('$migration_user', '$schema', 'CREATE') OR (SELECT rolsuper FROM pg_roles WHERE rolname = '$migration_user') THEN 'owned' ELSE 'unowned' END;")"
      ;;
    DATABASE_CREATE)
      ownership_state="$(query_database "SELECT CASE WHEN has_database_privilege('$migration_user', current_database(), 'CREATE') OR (SELECT rolsuper FROM pg_roles WHERE rolname = '$migration_user') THEN 'owned' ELSE 'unowned' END;")"
      ;;
    *)
      printf 'Migration ownership preflight encountered an unsupported target kind.\n' >&2
      exit 1
      ;;
  esac

  if [ "$ownership_state" = "unowned" ]; then
    printf 'Migration ownership preflight failed: %s needs %s access to %s.%s.\n' "$migration" "$kind" "$schema" "$object_name" >&2
    ownership_failure=1
  fi
done <<< "$targets"

test "$ownership_failure" = 0
printf 'MIGRATION_OWNERSHIP_PRECHECK=passed\n'
'@
  $ownershipPreflightScript = $ownershipPreflightScript.Replace('__APP_DIRECTORY__', $config.AppDirectory).Replace('__COMPOSE_PROJECT__', $config.ComposeProject).Replace('__OWNERSHIP_TARGETS_BASE64__', $ownershipTargetPayload)
  $ownershipOutput = Invoke-RemoteScript -Config $config -Script $ownershipPreflightScript
  $ownershipStatus = Get-ReleaseMarker -Output $ownershipOutput -Name "MIGRATION_OWNERSHIP_PRECHECK"
  if ($ownershipStatus -ne "passed") {
    throw "The migration ownership preflight did not pass."
  }
}

$buildSettings = Get-RemotePublicBuildSettings -Config $config
$offHostImages = New-OffHostReleaseImages -Config $config -DockerExecutable $dockerExecutable -Commit $commit -ShortSha $shortSha -BuildSettings $buildSettings
Assert-RemoteImageCapacity -Config $config -ImageArchiveBytes $offHostImages.ArchiveBytes

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
  $remoteImageArchive = "/tmp/arctic-rss-$shortSha-images.tar"
  $sourceTarget = "$($config.SshUser)@$($config.SshHost):$remoteArchive"
  $imageTarget = "$($config.SshUser)@$($config.SshHost):$remoteImageArchive"

  Write-Host "==> Uploading locally built release images"
  Invoke-RequiredCommand -FilePath "scp" -Arguments @(
    "-q", "-o", "BatchMode=yes", "-i", $config.SshKeyPath, $offHostImages.ArchivePath, $imageTarget
  ) | Out-Null

  Write-Host "==> Uploading exact release archive"
  Invoke-RequiredCommand -FilePath "scp" -Arguments @(
    "-q", "-o", "BatchMode=yes", "-i", $config.SshKeyPath, $archivePath, $sourceTarget
  ) | Out-Null

  $remoteScript = @'
set -euo pipefail
short_sha='__SHORT_SHA__'
archive='/tmp/arctic-rss-__SHORT_SHA__.tar.gz'
expected_hash='__ARCHIVE_HASH__'
image_archive='/tmp/arctic-rss-__SHORT_SHA__-images.tar'
expected_image_hash='__IMAGE_ARCHIVE_HASH__'
expected_images_b64='__OFFHOST_IMAGES_BASE64__'
release_image_environment_b64='__RELEASE_IMAGE_ENVIRONMENT_BASE64__'
release_root='__RELEASE_ROOT__'
live='__APP_DIRECTORY__'
stage="$release_root/staging/$short_sha"
previous="$release_root/previous-$short_sha"
compose_project='__COMPOSE_PROJECT__'
canonical_host='__CANONICAL_HOST__'

actual_hash="$(sha256sum "$archive" | awk '{print $1}')"
test "$actual_hash" = "$expected_hash"
actual_image_hash="$(sha256sum "$image_archive" | awk '{print $1}')"
test "$actual_image_hash" = "$expected_image_hash"
test ! -e "$stage"
test ! -e "$previous"
test -f "$live/.env"

sudo -n install -d -m 755 "$stage"
sudo -n tar -xzf "$archive" -C "$stage"
test -f "$stage/ops/systemd/60-arctic-rss-log-retention.conf"
sudo -n install -m 600 -o root -g root "$live/.env" "$stage/.env"
# Compose reads the image variables from the staged environment file. Keep the
# tag immutable so a loaded archive cannot alter the still-live source before
# the release has passed migrations and health checks.
sudo -n sed -i -E '/^(MIGRATE_IMAGE|WEB_IMAGE|WORKER_IMAGE|CHAT_GATEWAY_IMAGE|EDGE_PROXY_IMAGE)=/d' "$stage/.env"
printf '%s' "$release_image_environment_b64" | base64 -d | sudo -n tee -a "$stage/.env" >/dev/null
sudo -n docker compose -p "$compose_project" --project-directory "$stage" config -q
compose_images="$(sudo -n docker compose -p "$compose_project" --project-directory "$stage" --profile chat config --images)"
sudo -n docker load --input "$image_archive" >/dev/null
while IFS= read -r image_name; do
  [ -n "$image_name" ] || continue
  printf '%s\n' "$compose_images" | awk -v expected="$image_name" '$0 == expected { found = 1 } END { exit !found }'
  sudo -n docker image inspect "$image_name" >/dev/null
done <<< "$(printf '%s' "$expected_images_b64" | base64 -d)"
rm -f "$image_archive"
sudo -n install -d -m 755 /etc/systemd/journald.conf.d
sudo -n install -m 644 "$stage/ops/systemd/60-arctic-rss-log-retention.conf" /etc/systemd/journald.conf.d/60-arctic-rss-log-retention.conf
sudo -n systemctl restart systemd-journald
# Do not use `grep -q` here: with `pipefail`, its expected early exit can
# surface as SIGPIPE from systemd-analyze and abort an otherwise valid staged
# release. Awk consumes the complete stream before returning the assertion.
sudo -n systemd-analyze cat-config systemd/journald.conf | awk '$0 == "MaxRetentionSec=30day" { found = 1 } END { exit !found }'
sudo -n journalctl --rotate
sudo -n journalctl --vacuum-time=30d
# Application images were built and archived locally from the exact source
# commit, then hash-verified and loaded above. Never build them on OVH.
# `docker compose run` does not support `--no-build` on the OVH Compose
# version. It never builds unless `--build` is explicitly supplied, so these
# remain off-host-image-only while staying compatible with that runtime.
sudo -n docker compose -p "$compose_project" --project-directory "$stage" run --rm --no-deps -T migrate </dev/null
sudo -n docker compose -p "$compose_project" --project-directory "$stage" run --rm --no-deps -T migrate ./node_modules/.bin/prisma migrate status </dev/null
migration_status="verified"
sudo -n mv "$live" "$previous"
sudo -n mv "$stage" "$live"

# Stateful services retain their existing containers and volumes during an
# application release. Their health is a release precondition, not a reason to
# restart PostgreSQL or either Redis workload while swapping application code.
for attempt in $(seq 1 18); do
  postgres_health="$(sudo -n docker inspect -f '{{.State.Health.Status}}' app-postgres-1)"
  redis_health="$(sudo -n docker inspect -f '{{.State.Health.Status}}' app-redis-1)"
  redis_ephemeral_health="$(sudo -n docker inspect -f '{{.State.Health.Status}}' app-redis-ephemeral-1)"
  if [ "$postgres_health" = healthy ] && [ "$redis_health" = healthy ] && [ "$redis_ephemeral_health" = healthy ]; then
    break
  fi
  sleep 5
done

test "$postgres_health" = healthy
test "$redis_health" = healthy
test "$redis_ephemeral_health" = healthy

# A running chat gateway holds its own fail-closed Redis clients for token
# replay protection. Recreate it after Redis so fresh browser sessions do not
# authenticate against a stale client connection. Do not start chat when it
# was intentionally inactive before the release.
chat_gateway_health="not-running"
chat_gateway_image="not-running"
edge_proxy_health="not-running"
edge_proxy_image="not-running"
chat_gateway_was_running="$(sudo -n docker inspect -f '{{.State.Running}}' app-chat-gateway-1 2>/dev/null || true)"
if [ "$chat_gateway_was_running" = true ]; then
  sudo -n docker compose -p "$compose_project" --project-directory "$live" --profile chat up -d --no-deps --no-build --force-recreate chat-gateway

  for attempt in $(seq 1 18); do
    chat_gateway_health="$(sudo -n docker inspect -f '{{.State.Health.Status}}' app-chat-gateway-1)"
    if [ "$chat_gateway_health" = healthy ]; then
      break
    fi
    sleep 5
  done

  test "$chat_gateway_health" = healthy
  chat_gateway_image="$(sudo -n docker inspect -f '{{.Image}}' app-chat-gateway-1)"

  sudo -n docker compose -p "$compose_project" --project-directory "$live" --profile chat up -d --no-deps --no-build --force-recreate edge-proxy
  for attempt in $(seq 1 18); do
    edge_proxy_health="$(sudo -n docker inspect -f '{{.State.Health.Status}}' app-edge-proxy-1)"
    if [ "$edge_proxy_health" = healthy ]; then
      break
    fi
    sleep 5
  done

  test "$edge_proxy_health" = healthy
  edge_proxy_image="$(sudo -n docker inspect -f '{{.Image}}' app-edge-proxy-1)"
fi

sudo -n docker compose -p "$compose_project" --project-directory "$live" up -d --no-deps --no-build --force-recreate web worker

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

web_image="$(sudo -n docker inspect -f '{{.Image}}' app-web-1)"
worker_image="$(sudo -n docker inspect -f '{{.Image}}' app-worker-1)"

for container in app-postgres-1 app-redis-1 app-redis-ephemeral-1 app-web-1 app-worker-1; do
  test "$(sudo -n docker inspect -f '{{.HostConfig.LogConfig.Type}}' "$container")" = journald
done
if [ "$edge_proxy_health" = healthy ]; then
  test "$(sudo -n docker inspect -f '{{.HostConfig.LogConfig.Type}}' app-edge-proxy-1)" = journald
fi

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
printf 'MIGRATION_STATUS=%s\n' "$migration_status"
printf 'WEB_HEALTH=%s\n' "$web_health"
printf 'WEB_IMAGE=%s\n' "$web_image"
printf 'WORKER_HEALTH=%s\n' "$worker_health"
printf 'WORKER_IMAGE=%s\n' "$worker_image"
printf 'REDIS_EPHEMERAL_HEALTH=%s\n' "$redis_ephemeral_health"
printf 'CHAT_GATEWAY_HEALTH=%s\n' "$chat_gateway_health"
printf 'CHAT_GATEWAY_IMAGE=%s\n' "$chat_gateway_image"
printf 'EDGE_PROXY_HEALTH=%s\n' "$edge_proxy_health"
printf 'EDGE_PROXY_IMAGE=%s\n' "$edge_proxy_image"
'@
  $offHostImagesPayload = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes(([string[]]$offHostImages.Images -join "`n")))
  $releaseImageEnvironmentPayload = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes(([string[]]$offHostImages.ImageEnvironment -join "`n")))
  $remoteScript = $remoteScript.Replace('__SHORT_SHA__', $shortSha).Replace('__ARCHIVE_HASH__', $archiveHash).Replace('__IMAGE_ARCHIVE_HASH__', $offHostImages.ArchiveHash).Replace('__OFFHOST_IMAGES_BASE64__', $offHostImagesPayload).Replace('__RELEASE_IMAGE_ENVIRONMENT_BASE64__', $releaseImageEnvironmentPayload).Replace('__RELEASE_ROOT__', $config.ReleaseRoot).Replace('__APP_DIRECTORY__', $config.AppDirectory).Replace('__COMPOSE_PROJECT__', $config.ComposeProject).Replace('__CANONICAL_HOST__', $config.CanonicalHost)
  $stageOutput = Invoke-RemoteScript -Config $config -Script $remoteScript
  $previousRelease = Get-ReleaseMarker -Output $stageOutput -Name "PREVIOUS_RELEASE"
  $migrationStatus = Get-ReleaseMarker -Output $stageOutput -Name "MIGRATION_STATUS"
  $webHealth = Get-ReleaseMarker -Output $stageOutput -Name "WEB_HEALTH"
  $webImage = Get-ReleaseMarker -Output $stageOutput -Name "WEB_IMAGE"
  $workerHealth = Get-ReleaseMarker -Output $stageOutput -Name "WORKER_HEALTH"
  $workerImage = Get-ReleaseMarker -Output $stageOutput -Name "WORKER_IMAGE"
  $chatGatewayHealth = Get-ReleaseMarker -Output $stageOutput -Name "CHAT_GATEWAY_HEALTH"
  $chatGatewayImage = Get-ReleaseMarker -Output $stageOutput -Name "CHAT_GATEWAY_IMAGE"
  $edgeProxyHealth = Get-ReleaseMarker -Output $stageOutput -Name "EDGE_PROXY_HEALTH"
  $edgeProxyImage = Get-ReleaseMarker -Output $stageOutput -Name "EDGE_PROXY_IMAGE"

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
    localImageArchiveBytes = $offHostImages.ArchiveBytes
    localImageArchiveSha256 = $offHostImages.ArchiveHash
    githubCiRun = $ci.Url
    loginHttpStatus = $loginStatus
    migrationStatus = $migrationStatus
    previousRelease = $previousRelease
    publicHealth = $publicHealth
    chatGatewayHealth = $chatGatewayHealth
    chatGatewayImage = $chatGatewayImage
    edgeProxyHealth = $edgeProxyHealth
    edgeProxyImage = $edgeProxyImage
    webHealth = $webHealth
    webImage = $webImage
    workerHealth = $workerHealth
    workerImage = $workerImage
  } | ConvertTo-Json | Set-Content -LiteralPath $recordPath -Encoding utf8

  Write-Host "Release complete and verified. Private release record: $recordPath"
} finally {
  if (Test-Path -LiteralPath $archivePath) {
    Remove-Item -LiteralPath $archivePath -Force
  }
}

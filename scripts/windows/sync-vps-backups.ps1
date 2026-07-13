[CmdletBinding()]
param(
  [Parameter(Mandatory)]
  [string]$ConfigurationPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-SyncLog {
  param([Parameter(Mandatory)][string]$Message)

  $timestamp = (Get-Date).ToUniversalTime().ToString("o")
  [System.IO.File]::AppendAllText($script:LogPath, "$timestamp $Message$([Environment]::NewLine)")
}

function Invoke-RequiredCommand {
  param(
    [Parameter(Mandatory)][string]$FilePath,
    [Parameter(Mandatory)][string[]]$Arguments
  )

  $output = & $FilePath @Arguments 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "$FilePath failed with exit code $LASTEXITCODE."
  }

  return $output
}

function Get-ExpectedHash {
  param([Parameter(Mandatory)][string]$ChecksumPath)

  $line = Get-Content -LiteralPath $ChecksumPath -TotalCount 1
  if ($line -notmatch '^(?<hash>[A-Fa-f0-9]{64})\s+\*?.+$') {
    throw "Invalid checksum file: $ChecksumPath"
  }

  return $Matches.hash.ToLowerInvariant()
}

function Assert-Checksum {
  param(
    [Parameter(Mandatory)][string]$FilePath,
    [Parameter(Mandatory)][string]$ChecksumPath
  )

  $expected = Get-ExpectedHash -ChecksumPath $ChecksumPath
  $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $FilePath).Hash.ToLowerInvariant()
  if ($actual -ne $expected) {
    throw "Checksum verification failed for $([System.IO.Path]::GetFileName($FilePath))."
  }
}

function Remove-ExpiredBackups {
  param(
    [Parameter(Mandatory)][string]$Destination,
    [Parameter(Mandatory)][int]$RetentionDays
  )

  $cutoff = (Get-Date).ToUniversalTime().AddDays(-$RetentionDays)
  Get-ChildItem -LiteralPath $Destination -Directory | Where-Object {
    $_.Name -match '^20\d{6}T\d{6}Z$' -and $_.LastWriteTimeUtc -lt $cutoff
  } | Remove-Item -Recurse -Force
}

function Send-FailureNotification {
  param([Parameter(Mandatory)][pscustomobject]$Config)

  try {
    Invoke-RequiredCommand -FilePath "ssh" -Arguments @(
      "-o", "BatchMode=yes",
      "-i", $Config.SshKeyPath,
      "$($Config.SshUser)@$($Config.SshHost)",
      "sudo /usr/local/sbin/arctic-rss-notify backup-sync-failure windows-backup-sync"
    ) | Out-Null
  } catch {
    Write-SyncLog "Unable to request the backup-sync failure notification."
  }
}

if (-not (Test-Path -LiteralPath $ConfigurationPath -PathType Leaf)) {
  throw "Backup sync configuration was not found."
}

$config = Get-Content -LiteralPath $ConfigurationPath -Raw | ConvertFrom-Json
foreach ($property in "DestinationPath", "RemoteBackupDirectory", "SshHost", "SshKeyPath", "SshUser") {
  if ([string]::IsNullOrWhiteSpace([string]$config.$property)) {
    throw "Backup sync configuration is missing $property."
  }
}

$retentionDays = if ($config.RetentionDays) { [int]$config.RetentionDays } else { 90 }
if ($retentionDays -lt 1) {
  throw "RetentionDays must be at least one."
}

$destination = [System.IO.Path]::GetFullPath([string]$config.DestinationPath)
New-Item -ItemType Directory -Force -Path $destination | Out-Null
$script:LogPath = Join-Path $destination "backup-sync.log"

$backupFiles = @(
  "database.dump",
  "database.catalog",
  "database.globals.sql",
  "database.dump.sha256",
  "database.globals.sql.sha256",
  "metadata"
)

try {
  $latest = (Invoke-RequiredCommand -FilePath "ssh" -Arguments @(
    "-o", "BatchMode=yes",
    "-i", $config.SshKeyPath,
    "$($config.SshUser)@$($config.SshHost)",
    "sudo /usr/local/sbin/arctic-rss-latest-backup"
  ) | Select-Object -Last 1).Trim()

  if ($latest -notmatch '^20\d{6}T\d{6}Z$') {
    throw "The VPS returned an invalid backup identifier."
  }

  $final = Join-Path $destination $latest
  if (Test-Path -LiteralPath $final -PathType Container) {
    Assert-Checksum -FilePath (Join-Path $final "database.dump") -ChecksumPath (Join-Path $final "database.dump.sha256")
    Assert-Checksum -FilePath (Join-Path $final "database.globals.sql") -ChecksumPath (Join-Path $final "database.globals.sql.sha256")
    Remove-ExpiredBackups -Destination $destination -RetentionDays $retentionDays
    Write-SyncLog "Backup $latest is already present and verified."
    exit 0
  }

  $staging = Join-Path $destination ".staging-$latest-$PID"
  New-Item -ItemType Directory -Path $staging | Out-Null

  try {
    foreach ($file in $backupFiles) {
      $remoteFile = "$($config.SshUser)@$($config.SshHost):$($config.RemoteBackupDirectory)/$latest/$file"
      Invoke-RequiredCommand -FilePath "scp" -Arguments @(
        "-p",
        "-q",
        "-o", "BatchMode=yes",
        "-i", $config.SshKeyPath,
        $remoteFile,
        (Join-Path $staging $file)
      ) | Out-Null
    }

    Assert-Checksum -FilePath (Join-Path $staging "database.dump") -ChecksumPath (Join-Path $staging "database.dump.sha256")
    Assert-Checksum -FilePath (Join-Path $staging "database.globals.sql") -ChecksumPath (Join-Path $staging "database.globals.sql.sha256")
    Move-Item -LiteralPath $staging -Destination $final
  } finally {
    if (Test-Path -LiteralPath $staging) {
      Remove-Item -LiteralPath $staging -Recurse -Force
    }
  }

  Remove-ExpiredBackups -Destination $destination -RetentionDays $retentionDays

  Write-SyncLog "Backup $latest copied and checksum verified."
} catch {
  Write-SyncLog "Backup sync failed."
  Send-FailureNotification -Config $config
  throw
}

import { readFile } from "node:fs/promises"

import { describe, expect, it } from "vitest"

describe("production backup evidence workflow", () => {
  it("creates an initial artifact record and keeps a stable latest-record link", async () => {
    const script = await readFile("scripts/production-backup.sh", "utf8")

    expect(script).toContain('"schemaVersion": 1')
    expect(script).toContain('"artifactPath": "database.dump"')
    expect(script).toContain('"offHostTarget": None')
    expect(script).toContain('"restoreTestedAt": None')
    expect(script).toContain("latest-backup-evidence.json")
    expect(script).toContain('ln -s "$timestamp/backup-evidence.json"')
  })

  it("requires evidence for latest-backup discovery and records off-host proof only through the restricted helper", async () => {
    const [latest, recorder, sync] = await Promise.all([
      readFile("scripts/production-latest-backup.sh", "utf8"),
      readFile("scripts/production-record-backup-offhost.sh", "utf8"),
      readFile("scripts/windows/sync-vps-backups.ps1", "utf8"),
    ])

    expect(latest).toContain("backup-evidence.json")
    expect(latest).toContain('backup_id != expected_backup_id')
    expect(recorder).toContain("BACKUP_OFF_HOST_TARGET")
    expect(recorder).toContain("BACKUP_EVIDENCE_ID")
    expect(recorder).toContain("os.replace(temporary_path, path)")
    expect(sync).toContain("Confirm-RemoteOffHostEvidence")
    expect(sync).toContain("arctic-rss-record-backup-offhost $BackupId")
    expect(sync).toContain("Copy-RemoteEvidence")
  })

  it("keeps the existing 30-day default while allowing an off-host-gated daily cap", async () => {
    const script = await readFile("scripts/production-backup.sh", "utf8")

    expect(script).toContain('MAX_BACKUPS_PER_DAY="${MAX_BACKUPS_PER_DAY:-0}"')
    expect(script).toContain('MAX_BACKUPS_PER_DAY must be zero or a positive whole number.')
    expect(script).toContain('evidence.get("offHostVerifiedAt")')
    expect(script).toContain('Pruned off-host-verified excess backup')
    expect(script).toContain('named recovery archives are')
  })

  it("uses an explicit, root-only manifest for named recovery archive review deadlines", async () => {
    const [registrar, monitor] = await Promise.all([
      readFile("scripts/production-register-backup-archive.sh", "utf8"),
      readFile("scripts/production-monitor.sh", "utf8"),
    ])

    expect(registrar).toContain("<named-recovery-archive> <review-by-utc-date>")
    expect(registrar).toContain('"reviewBy": review_by')
    expect(registrar).toContain("os.replace(temporary_path, path)")
    expect(monitor).toContain("backup_archive_review")
    expect(monitor).toContain("backup_archive_manifest")
  })

  it("records successful restore drills and release provenance against the exact evidence ID", async () => {
    const [drill, release] = await Promise.all([
      readFile("scripts/production-restore-drill.sh", "utf8"),
      readFile("scripts/windows/deploy-approved-release.ps1", "utf8"),
    ])

    expect(drill).toContain('evidence["restoreTestedAt"] = tested_at')
    expect(drill).toContain("os.replace(temporary_path, path)")
    expect(release).toContain("BACKUP_EVIDENCE_ID")
    expect(release).toContain("backupEvidenceId = $backupEvidenceId")
  })
})

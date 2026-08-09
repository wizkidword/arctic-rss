import { createHash } from "node:crypto"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  BACKUP_EVIDENCE_SCHEMA_VERSION,
  inspectBackupEvidence,
} from "./backup-evidence"

const now = Date.parse("2026-08-08T12:00:00Z")
const temporaryDirectories: string[] = []

async function createFixture(
  overrides: Record<string, unknown> = {},
  { artifact = "database.dump", artifactBytes = "verified backup" } = {}
) {
  const directory = await mkdtemp(join(tmpdir(), "arctic-rss-backup-evidence-"))
  temporaryDirectories.push(directory)
  const artifactPath = join(directory, artifact)
  await mkdir(join(directory, "nested"), { recursive: true })
  await writeFile(artifactPath, artifactBytes)

  const evidence = {
    artifactPath: artifact,
    backupId: "20260808T110000Z",
    bytes: Buffer.byteLength(artifactBytes),
    completedAt: "2026-08-08T11:00:00Z",
    database: "arctic_rss",
    environment: "production",
    offHostTarget: "encrypted-windows-replica",
    offHostVerifiedAt: "2026-08-08T11:05:00Z",
    restoreTestedAt: "2026-08-08T11:10:00Z",
    schemaVersion: BACKUP_EVIDENCE_SCHEMA_VERSION,
    sha256: createHash("sha256").update(artifactBytes).digest("hex"),
    toolVersion: "arctic-rss-backup-evidence-v1",
    ...overrides,
  }
  const evidencePath = join(directory, "backup-evidence.json")
  await writeFile(evidencePath, JSON.stringify(evidence))

  return { directory, evidencePath }
}

function environment(evidencePath: string, overrides: Record<string, string | undefined> = {}) {
  return {
    ARCTIC_RSS_BACKUP_EVIDENCE_PATH: evidencePath,
    ARCTIC_RSS_BACKUP_EXPECTED_DATABASE: "arctic_rss",
    ...overrides,
  }
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })))
})

describe("structured backup evidence", () => {
  it("accepts a fresh, checksum-verified, off-host-restored artifact", async () => {
    const fixture = await createFixture()

    await expect(inspectBackupEvidence(environment(fixture.evidencePath), { now })).resolves.toEqual({
      ageMs: 60 * 60 * 1_000,
      restoreTestAgeMs: 50 * 60 * 1_000,
      status: "available",
    })
  })

  it.each([
    ["a malformed record", { schemaVersion: "1" }, "malformed"],
    ["an unsupported schema", { schemaVersion: 2 }, "unsupported-schema"],
    ["a future backup time", { completedAt: "2026-08-08T12:00:01Z" }, "future-timestamp"],
    ["a stale backup", { completedAt: "2026-08-07T05:00:00Z" }, "stale"],
    ["a wrong database", { database: "other_database" }, "identity-mismatch"],
    ["a wrong environment", { environment: "staging" }, "identity-mismatch"],
    ["missing off-host acknowledgement", { offHostTarget: null }, "off-host-missing"],
  ])("rejects %s", async (_name, overrides, status) => {
    const fixture = await createFixture(overrides)

    await expect(inspectBackupEvidence(environment(fixture.evidencePath), { now })).resolves.toMatchObject({ status })
  })

  it("rejects a restore drill that exceeds its configured freshness policy", async () => {
    const fixture = await createFixture()

    await expect(inspectBackupEvidence(environment(fixture.evidencePath, {
      ARCTIC_RSS_RESTORE_TEST_MAX_AGE_SECONDS: "1800",
    }), { now })).resolves.toMatchObject({ status: "restore-stale" })
  })

  it("rejects a missing artifact, an empty artifact, mismatched bytes, and an altered artifact", async () => {
    const missing = await createFixture({ artifactPath: "missing.dump" })
    await expect(inspectBackupEvidence(environment(missing.evidencePath), { now })).resolves.toMatchObject({
      status: "artifact-missing",
    })

    const empty = await createFixture({ bytes: 0, sha256: createHash("sha256").update("").digest("hex") }, { artifactBytes: "" })
    await expect(inspectBackupEvidence(environment(empty.evidencePath), { now })).resolves.toMatchObject({
      status: "empty-artifact",
    })

    const sizeMismatch = await createFixture({ bytes: 1 })
    await expect(inspectBackupEvidence(environment(sizeMismatch.evidencePath), { now })).resolves.toMatchObject({
      status: "artifact-size-mismatch",
    })

    const altered = await createFixture()
    await writeFile(join(altered.directory, "database.dump"), "modified after evidence")
    await expect(inspectBackupEvidence(environment(altered.evidencePath), { now })).resolves.toMatchObject({
      status: "artifact-size-mismatch",
    })

    const checksumMismatch = await createFixture()
    await writeFile(join(checksumMismatch.directory, "database.dump"), "tampered backup")
    await expect(inspectBackupEvidence(environment(checksumMismatch.evidencePath), { now })).resolves.toMatchObject({
      status: "checksum-mismatch",
    })
  })

  it("rejects a traversal artifact path and invalid policy values without disclosing paths", async () => {
    const traversal = await createFixture({ artifactPath: "../database.dump" })
    await expect(inspectBackupEvidence(environment(traversal.evidencePath), { now })).resolves.toMatchObject({
      status: "invalid-artifact-path",
    })

    const invalidPolicy = await createFixture()
    await expect(inspectBackupEvidence(environment(invalidPolicy.evidencePath, {
      ARCTIC_RSS_BACKUP_MAX_AGE_SECONDS: "zero",
    }), { now })).resolves.toMatchObject({ status: "invalid-policy" })
  })
})

import { createReadStream } from "node:fs"
import { lstat, readFile, realpath, stat } from "node:fs/promises"
import { createHash } from "node:crypto"
import { dirname, isAbsolute, relative, resolve, sep } from "node:path"

export const BACKUP_EVIDENCE_SCHEMA_VERSION = 1
export const DEFAULT_BACKUP_MAX_AGE_MS = 30 * 60 * 60 * 1_000
export const DEFAULT_RESTORE_TEST_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1_000

const MAX_EVIDENCE_BYTES = 16 * 1_024
const BACKUP_ID_PATTERN = /^20\d{6}T\d{6}Z$/
const SHA256_PATTERN = /^[a-f0-9]{64}$/i
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/

type BackupEvidenceDocument = {
  artifactPath: string
  backupId: string
  bytes: number
  completedAt: string
  database: string
  environment: string
  offHostTarget: string | null
  offHostVerifiedAt?: string | null
  restoreTestedAt: string | null
  schemaVersion: number
  sha256: string
  toolVersion: string
}

type BackupEvidenceEnvironment = Readonly<Record<string, string | undefined>>

export type BackupEvidenceStatus =
  | "available"
  | "artifact-missing"
  | "artifact-size-mismatch"
  | "checksum-mismatch"
  | "empty-artifact"
  | "future-timestamp"
  | "identity-mismatch"
  | "invalid-artifact-path"
  | "invalid-policy"
  | "malformed"
  | "off-host-missing"
  | "restore-missing"
  | "restore-stale"
  | "stale"
  | "unavailable"
  | "unconfigured"
  | "unsupported-schema"

export type BackupEvidenceReport = {
  ageMs: number | null
  restoreTestAgeMs: number | null
  status: BackupEvidenceStatus
}

export async function inspectBackupEvidence(
  environment: BackupEvidenceEnvironment,
  { now = Date.now() }: { now?: number } = {}
): Promise<BackupEvidenceReport> {
  const evidencePath = environment.ARCTIC_RSS_BACKUP_EVIDENCE_PATH?.trim()
  const expectedDatabase = expectedBackupDatabase(environment)
  const expectedEnvironment = environment.ARCTIC_RSS_BACKUP_EXPECTED_ENVIRONMENT?.trim() || "production"
  const backupMaximumAge = policyMilliseconds(
    environment.ARCTIC_RSS_BACKUP_MAX_AGE_SECONDS,
    DEFAULT_BACKUP_MAX_AGE_MS
  )
  const restoreMaximumAge = policyMilliseconds(
    environment.ARCTIC_RSS_RESTORE_TEST_MAX_AGE_SECONDS,
    DEFAULT_RESTORE_TEST_MAX_AGE_MS
  )

  if (!evidencePath || !expectedDatabase) {
    return unavailable("unconfigured")
  }
  if (backupMaximumAge === null || restoreMaximumAge === null) {
    return unavailable("invalid-policy")
  }

  let resolvedEvidencePath: string
  let document: unknown
  try {
    const evidenceMetadata = await stat(evidencePath)
    if (!evidenceMetadata.isFile() || evidenceMetadata.size > MAX_EVIDENCE_BYTES) {
      return unavailable("malformed")
    }
    resolvedEvidencePath = await realpath(evidencePath)
    document = JSON.parse(await readFile(resolvedEvidencePath, "utf8"))
  } catch {
    return unavailable("unavailable")
  }

  if (!isBackupEvidenceDocument(document)) {
    return unavailable("malformed")
  }
  if (document.schemaVersion !== BACKUP_EVIDENCE_SCHEMA_VERSION) {
    return unavailable("unsupported-schema")
  }
  if (document.environment !== expectedEnvironment || document.database !== expectedDatabase) {
    return unavailable("identity-mismatch")
  }

  const completedAt = timestampMilliseconds(document.completedAt)
  if (completedAt === null) {
    return unavailable("malformed")
  }
  if (completedAt > now) {
    return unavailable("future-timestamp")
  }

  const ageMs = Math.max(0, now - completedAt)
  if (ageMs > backupMaximumAge) {
    return { ageMs, restoreTestAgeMs: null, status: "stale" }
  }

  const artifactPath = resolveArtifactPath(dirname(resolvedEvidencePath), document.artifactPath)
  if (!artifactPath) {
    return { ageMs, restoreTestAgeMs: null, status: "invalid-artifact-path" }
  }

  try {
    const artifactMetadata = await lstat(artifactPath)
    if (!artifactMetadata.isFile()) {
      return { ageMs, restoreTestAgeMs: null, status: "artifact-missing" }
    }
    if (document.bytes === 0 || artifactMetadata.size === 0) {
      return { ageMs, restoreTestAgeMs: null, status: "empty-artifact" }
    }
    if (artifactMetadata.size !== document.bytes) {
      return { ageMs, restoreTestAgeMs: null, status: "artifact-size-mismatch" }
    }
    if ((await sha256File(artifactPath)) !== document.sha256.toLowerCase()) {
      return { ageMs, restoreTestAgeMs: null, status: "checksum-mismatch" }
    }
  } catch {
    return { ageMs, restoreTestAgeMs: null, status: "artifact-missing" }
  }

  const offHostVerifiedAt = timestampMilliseconds(document.offHostVerifiedAt)
  if (!document.offHostTarget || offHostVerifiedAt === null || offHostVerifiedAt > now || offHostVerifiedAt < completedAt) {
    return { ageMs, restoreTestAgeMs: null, status: "off-host-missing" }
  }

  const restoreTestedAt = timestampMilliseconds(document.restoreTestedAt)
  if (restoreTestedAt === null || restoreTestedAt > now || restoreTestedAt < completedAt) {
    return { ageMs, restoreTestAgeMs: null, status: "restore-missing" }
  }

  const restoreTestAgeMs = Math.max(0, now - restoreTestedAt)
  if (restoreTestAgeMs > restoreMaximumAge) {
    return { ageMs, restoreTestAgeMs, status: "restore-stale" }
  }

  return { ageMs, restoreTestAgeMs, status: "available" }
}

function unavailable(status: Exclude<BackupEvidenceStatus, "available" | "stale" | "restore-stale">): BackupEvidenceReport {
  return { ageMs: null, restoreTestAgeMs: null, status }
}

function expectedBackupDatabase(environment: BackupEvidenceEnvironment) {
  const configured = environment.ARCTIC_RSS_BACKUP_EXPECTED_DATABASE?.trim()
  if (configured) {
    return configured
  }

  const databaseUrl = environment.DATABASE_URL?.trim()
  if (!databaseUrl) {
    return null
  }

  try {
    const database = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\/+/, ""))
    return database || null
  } catch {
    return null
  }
}

function policyMilliseconds(value: string | undefined, fallback: number) {
  if (!value?.trim()) {
    return fallback
  }
  if (!/^[1-9]\d*$/.test(value)) {
    return null
  }

  const seconds = Number(value)
  return Number.isSafeInteger(seconds) && seconds <= Math.floor(Number.MAX_SAFE_INTEGER / 1_000)
    ? seconds * 1_000
    : null
}

function isBackupEvidenceDocument(value: unknown): value is BackupEvidenceDocument {
  if (!value || typeof value !== "object") {
    return false
  }

  const evidence = value as Record<string, unknown>
  return typeof evidence.artifactPath === "string"
    && typeof evidence.backupId === "string"
    && BACKUP_ID_PATTERN.test(evidence.backupId)
    && typeof evidence.bytes === "number"
    && Number.isSafeInteger(evidence.bytes)
    && evidence.bytes >= 0
    && typeof evidence.completedAt === "string"
    && typeof evidence.database === "string"
    && typeof evidence.environment === "string"
    && (typeof evidence.offHostTarget === "string" || evidence.offHostTarget === null)
    && (typeof evidence.offHostVerifiedAt === "string" || evidence.offHostVerifiedAt === null || evidence.offHostVerifiedAt === undefined)
    && (typeof evidence.restoreTestedAt === "string" || evidence.restoreTestedAt === null)
    && typeof evidence.schemaVersion === "number"
    && typeof evidence.sha256 === "string"
    && SHA256_PATTERN.test(evidence.sha256)
    && typeof evidence.toolVersion === "string"
    && evidence.toolVersion.length > 0
}

function timestampMilliseconds(value: unknown) {
  if (typeof value !== "string" || !TIMESTAMP_PATTERN.test(value)) {
    return null
  }

  const timestamp = Date.parse(value)
  const normalized = new Date(timestamp).toISOString()
  return Number.isFinite(timestamp) && (normalized === value || normalized.replace(".000Z", "Z") === value)
    ? timestamp
    : null
}

function resolveArtifactPath(evidenceDirectory: string, artifactPath: string) {
  if (!artifactPath || isAbsolute(artifactPath)) {
    return null
  }

  const resolved = resolve(evidenceDirectory, artifactPath)
  const pathFromEvidence = relative(evidenceDirectory, resolved)
  return pathFromEvidence && !pathFromEvidence.startsWith(`..${sep}`) && pathFromEvidence !== ".."
    ? resolved
    : null
}

async function sha256File(path: string) {
  return await new Promise<string>((resolveHash, rejectHash) => {
    const hash = createHash("sha256")
    const stream = createReadStream(path)
    stream.on("error", rejectHash)
    stream.on("data", (chunk) => hash.update(chunk))
    stream.on("end", () => resolveHash(hash.digest("hex")))
  })
}

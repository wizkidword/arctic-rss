const BACKUP_ID = /^20\d{6}T\d{6}Z$/
const SHA256 = /^[a-f0-9]{64}$/i

export type BackupPruneRecord = {
  backupId: string
  catalogVerified: boolean
  databaseSha256: string
  globalsSha256: string | null
  hold: boolean
  namedArchive: boolean
  offHostAcknowledgement: {
    databaseSha256: string
    globalsSha256: string | null
    status: "verified"
    targetClass: string
    verifiedAt: string
  } | null
}

export type BackupPruneDecision = {
  backupId: string
  eligible: boolean
  reason: string
}

/**
 * Produces a read-only eligibility report. It never performs deletion and
 * only allows an older standard backup to be superseded by a newer, complete
 * acknowledgement from the same UTC day.
 */
export function evaluateSameDayBackupPruning(
  records: readonly BackupPruneRecord[],
  { maximumBackupsPerDay }: { maximumBackupsPerDay: number }
): BackupPruneDecision[] {
  if (!Number.isInteger(maximumBackupsPerDay) || maximumBackupsPerDay < 1) {
    throw new Error("Backup pruning requires a positive daily retention count.")
  }

  return records.map((record) => {
    if (!isStandardBackupId(record.backupId)) {
      return decision(record, false, "not a standard timestamp backup")
    }
    if (record.namedArchive) {
      return decision(record, false, "named recovery archive")
    }
    if (record.hold) {
      return decision(record, false, "operator or legal hold")
    }
    if (!hasValidAcknowledgement(record)) {
      return decision(record, false, "missing or invalid off-host acknowledgement")
    }
    if (!record.catalogVerified) {
      return decision(record, false, "backup catalog has not been validated")
    }

    const sameDay = records
      .filter((candidate) => candidate.backupId.slice(0, 8) === record.backupId.slice(0, 8))
      .filter(isPruneSafeRecord)
      .sort((left, right) => right.backupId.localeCompare(left.backupId))
    const position = sameDay.findIndex((candidate) => candidate.backupId === record.backupId)
    if (position < maximumBackupsPerDay) {
      return decision(record, false, "minimum same-day recovery points are retained")
    }
    const replacement = sameDay.slice(0, position).find((candidate) => candidate.backupId > record.backupId)
    if (!replacement) {
      return decision(record, false, "no newer verified same-day replacement")
    }
    return decision(record, true, `superseded by ${replacement.backupId}`)
  })
}

function isPruneSafeRecord(record: BackupPruneRecord) {
  return isStandardBackupId(record.backupId)
    && !record.namedArchive
    && !record.hold
    && record.catalogVerified
    && hasValidAcknowledgement(record)
}

function hasValidAcknowledgement(record: BackupPruneRecord) {
  const acknowledgement = record.offHostAcknowledgement
  return Boolean(
    acknowledgement &&
    acknowledgement.status === "verified" &&
    acknowledgement.targetClass.trim() &&
    isTimestamp(acknowledgement.verifiedAt) &&
    validChecksum(record.databaseSha256) &&
    acknowledgement.databaseSha256.toLowerCase() === record.databaseSha256.toLowerCase() &&
    validNullableChecksum(record.globalsSha256) &&
    acknowledgement.globalsSha256 === record.globalsSha256
  )
}

function isStandardBackupId(value: string) {
  return BACKUP_ID.test(value)
}

function validChecksum(value: string) {
  return SHA256.test(value)
}

function validNullableChecksum(value: string | null) {
  return value === null || validChecksum(value)
}

function isTimestamp(value: string) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value) && Number.isFinite(Date.parse(value))
}

function decision(record: BackupPruneRecord, eligible: boolean, reason: string): BackupPruneDecision {
  return { backupId: record.backupId, eligible, reason }
}

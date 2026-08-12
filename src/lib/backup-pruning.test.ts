import { describe, expect, it } from "vitest"

import { evaluateSameDayBackupPruning, type BackupPruneRecord } from "./backup-pruning"

const checksum = "a".repeat(64)
const globalsChecksum = "b".repeat(64)

function record(backupId: string, overrides: Partial<BackupPruneRecord> = {}): BackupPruneRecord {
  return {
    backupId,
    catalogVerified: true,
    databaseSha256: checksum,
    globalsSha256: globalsChecksum,
    hold: false,
    namedArchive: false,
    offHostAcknowledgement: {
      databaseSha256: checksum,
      globalsSha256: globalsChecksum,
      status: "verified",
      targetClass: "encrypted-windows-replica",
      verifiedAt: "2026-08-12T12:30:00Z",
    },
    ...overrides,
  }
}

describe("same-day backup pruning eligibility", () => {
  it("requires a newer acknowledged replacement and retains the daily recovery point", () => {
    const decisions = evaluateSameDayBackupPruning([
      record("20260812T090000Z"),
      record("20260812T120000Z"),
    ], { maximumBackupsPerDay: 1 })

    expect(decisions).toEqual([
      { backupId: "20260812T090000Z", eligible: true, reason: "superseded by 20260812T120000Z" },
      { backupId: "20260812T120000Z", eligible: false, reason: "minimum same-day recovery points are retained" },
    ])
  })

  it.each([
    ["missing acknowledgement", { offHostAcknowledgement: null }, "missing or invalid off-host acknowledgement"],
    ["invalid acknowledgement checksum", { offHostAcknowledgement: { ...record("20260812T090000Z").offHostAcknowledgement!, databaseSha256: "c".repeat(64) } }, "missing or invalid off-host acknowledgement"],
    ["named archive", { namedArchive: true }, "named recovery archive"],
    ["operator hold", { hold: true }, "operator or legal hold"],
    ["unverified catalog", { catalogVerified: false }, "backup catalog has not been validated"],
  ] as const)("keeps %s protected", (_name, overrides, reason) => {
    const decisions = evaluateSameDayBackupPruning([
      record("20260812T090000Z", overrides),
      record("20260812T120000Z"),
    ], { maximumBackupsPerDay: 1 })

    expect(decisions[0]).toEqual({ backupId: "20260812T090000Z", eligible: false, reason })
  })
})

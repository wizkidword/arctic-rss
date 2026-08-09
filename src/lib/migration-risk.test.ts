import { describe, expect, it } from "vitest"

import {
  classifyMigrationSql,
  migrationSqlSha256,
  missingMigrationRiskReportFields,
  validateMigrationRiskReport,
} from "./migration-risk"

const reviewedMigrationSql = 'ALTER TABLE "Article" ADD COLUMN "fingerprint" TEXT;'

function riskReport({
  approvalTimestamp = "Not recorded because Production ready is false.",
  approver = "Not approved for production execution.",
  measuredRowCounts = "Not measured in this local source-only worktree.",
  productionReady = "false",
  sql = reviewedMigrationSql,
}: {
  approvalTimestamp?: string
  approver?: string
  measuredRowCounts?: string
  productionReady?: string
  sql?: string
} = {}) {
  return `
Migration name: example_migration
Migration SQL SHA-256: \`${migrationSqlSha256(sql)}\`
Author/date: Codex / 2026-08-08
Affected tables: Article
Measured row counts: ${measuredRowCounts}
Measured table and index sizes: Not measured in this local source-only worktree.
Expected lock type: ACCESS EXCLUSIVE risk reviewed
Rewrite or scan risk: no
Expected duration: bounded by rehearsal
Online-safe strategy: expand and contract
Backfill plan: no backfill in this migration
Validation plan: schema and index validation
Maintenance mode required: no
Rollback feasibility: forward recovery only
Forward-recovery plan: restore compatible application path
Backup evidence ID requirement: exact backup evidence ID must be captured by the approved release.
Approver: ${approver}
Approval timestamp: ${approvalTimestamp}
Production ready: ${productionReady}
Production result: not deployed
`
}

describe("migration risk classification", () => {
  it("allows a safe additive table and concurrent index", () => {
    expect(
      classifyMigrationSql(`
        CREATE TABLE "Audit" ("id" TEXT NOT NULL PRIMARY KEY);
        CREATE INDEX CONCURRENTLY "Audit_createdAt_idx" ON "Audit" ("createdAt");
        ALTER TABLE "Audit" ADD COLUMN "note" TEXT;
      `)
    ).toEqual([])
  })

  it.each([
    ["non-concurrent index", 'CREATE INDEX "Article_title_idx" ON "Article" ("title");', "NON_CONCURRENT_INDEX"],
    ["stored generated column", 'ALTER TABLE "Article" ADD COLUMN "search" tsvector GENERATED ALWAYS AS (to_tsvector(\'simple\', "title")) STORED;', "STORED_GENERATED_COLUMN"],
    ["alter column type", 'ALTER TABLE "Article" ALTER COLUMN "title" TYPE TEXT;', "ALTER_COLUMN_TYPE"],
    ["drop column", 'ALTER TABLE "Account" DROP COLUMN "token";', "DROP_COLUMN"],
    ["unbounded update", 'UPDATE "Article" SET "title" = trim("title");', "UNBOUNDED_UPDATE"],
    ["non-null addition", 'ALTER TABLE "Article" ADD COLUMN "state" TEXT NOT NULL;', "NON_NULL_ADDITION"],
    ["foreign key without staged validation", 'ALTER TABLE "Child" ADD CONSTRAINT "Child_parent_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id");', "FOREIGN_KEY_WITHOUT_NOT_VALID"],
  ])("flags %s", (_name, sql, code) => {
    expect(classifyMigrationSql(sql).map((finding) => finding.code)).toContain(code)
  })

  it("allows bounded updates and staged foreign-key validation", () => {
    expect(
      classifyMigrationSql(`
        UPDATE "Article" SET "title" = trim("title") WHERE "id" > 'cursor';
        ALTER TABLE "Child" ADD CONSTRAINT "Child_parent_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") NOT VALID;
      `)
    ).toEqual([])
  })

  it("requires every risk-report field to have a decision", () => {
    expect(validateMigrationRiskReport(undefined)).toEqual(["risk report"])
    expect(missingMigrationRiskReportFields("Migration name: example")).toContain("Approver")
    expect(
      missingMigrationRiskReportFields(`
Migration name: example
Migration SQL SHA-256: abc
Author/date: Codex / 2026-08-08
Affected tables: Article
Measured row counts: measured during release preflight
Measured table and index sizes: measured during release preflight
Expected lock type: ACCESS EXCLUSIVE risk reviewed
Rewrite or scan risk: yes
Expected duration: bounded by rehearsal
Online-safe strategy: expand and contract
Backfill plan: no backfill in this migration
Validation plan: schema and index validation
Maintenance mode required: yes
Rollback feasibility: forward recovery only
Forward-recovery plan: restore compatible application path
Backup evidence ID requirement: exact backup evidence ID required before production
Approver: required before production
Approval timestamp: not recorded because Production ready is false
Production ready: false
Production result: not yet deployed
      `)
    ).toEqual([])
  })

  it("binds the report identity and hash to the exact migration SQL", () => {
    expect(
      validateMigrationRiskReport(riskReport(), {
        migrationName: "example_migration",
        sql: reviewedMigrationSql,
      })
    ).toEqual([])

    expect(
      validateMigrationRiskReport(riskReport({ sql: "ALTER TABLE \"Article\" DROP COLUMN \"fingerprint\";" }), {
        migrationName: "example_migration",
        sql: reviewedMigrationSql,
      })
    ).toContain("Migration SQL SHA-256 does not match migration SQL")
    expect(
      validateMigrationRiskReport(riskReport(), {
        migrationName: "other_migration",
        sql: reviewedMigrationSql,
      })
    ).toContain("Migration name does not match migration SQL")
  })

  it("uses the reviewed hash for equivalent LF and CRLF migration SQL", () => {
    const lfSql = 'ALTER TABLE "Article" ADD COLUMN "fingerprint" TEXT;\nCREATE INDEX CONCURRENTLY "Article_fingerprint_idx" ON "Article" ("fingerprint");\n'
    const crlfSql = lfSql.replace(/\n/g, "\r\n")

    expect(migrationSqlSha256(crlfSql)).toBe(migrationSqlSha256(lfSql))
    expect(
      validateMigrationRiskReport(riskReport({ sql: lfSql }), {
        migrationName: "example_migration",
        sql: crlfSql,
      })
    ).toEqual([])
  })

  it("allows historical records to stay non-ready but rejects unmeasured evidence in a ready record", () => {
    expect(
      validateMigrationRiskReport(riskReport(), {
        migrationName: "example_migration",
        sql: reviewedMigrationSql,
      })
    ).toEqual([])

    expect(
      validateMigrationRiskReport(riskReport({
        approvalTimestamp: "2026-08-08T12:00:00Z",
        approver: "Release owner",
        productionReady: "true",
      }), {
        migrationName: "example_migration",
        sql: reviewedMigrationSql,
      })
    ).toEqual(expect.arrayContaining([
      "Measured row counts contains unverified production evidence",
      "Measured table and index sizes contains unverified production evidence",
    ]))
  })

  it("requires an exact approval timestamp and backup evidence ID language before a record can be ready", () => {
    const report = riskReport({
      approvalTimestamp: "2026-08-08",
      approver: "Release owner",
      measuredRowCounts: "Article: 1,200 rows measured 2026-08-08.",
      productionReady: "true",
    }).replace(
      "Measured table and index sizes: Not measured in this local source-only worktree.",
      "Measured table and index sizes: Article table 48 MB and index 12 MB measured 2026-08-08."
    ).replace(
      "Backup evidence ID requirement: exact backup evidence ID must be captured by the approved release.",
      "Backup evidence ID requirement: fresh backup required."
    )

    expect(
      validateMigrationRiskReport(report, {
        migrationName: "example_migration",
        sql: reviewedMigrationSql,
      })
    ).toEqual(expect.arrayContaining([
      "Approval timestamp must be an ISO-8601 UTC timestamp when Production ready is true",
      "Backup evidence ID requirement must name the exact backup evidence ID when Production ready is true",
    ]))
  })
})

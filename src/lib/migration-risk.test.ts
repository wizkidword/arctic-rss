import { describe, expect, it } from "vitest"

import {
  classifyMigrationSql,
  missingMigrationRiskReportFields,
  validateMigrationRiskReport,
} from "./migration-risk"

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
    expect(missingMigrationRiskReportFields("Migration name: example")).toContain("Owner approval")
    expect(
      missingMigrationRiskReportFields(`
Migration name: example
Author/date: Codex / 2026-08-08
Affected tables: Article
Estimated row counts: measured during release preflight
Estimated table and index sizes: measured during release preflight
Expected lock type: ACCESS EXCLUSIVE risk reviewed
Rewrite or scan risk: yes
Expected duration: bounded by rehearsal
Online-safe strategy: expand and contract
Backfill plan: no backfill in this migration
Validation plan: schema and index validation
Maintenance mode required: yes
Rollback feasibility: forward recovery only
Forward-recovery plan: restore compatible application path
Backup evidence required: fresh off-host backup
Owner approval: required before production
Production result: not yet deployed
      `)
    ).toEqual([])
  })
})

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { migrationSqlSha256 } from "../src/lib/migration-risk"
import { inspectMigration } from "./check-migration-risk"

const temporaryDirectories: string[] = []

function riskReport(name: string, sql: string, { hash = migrationSqlSha256(sql) } = {}) {
  return `
Migration name: ${name}
Migration SQL SHA-256: ${hash}
Author/date: Codex / 2026-08-08
Affected tables: Article
Measured row counts: not measured in this non-ready fixture
Measured table and index sizes: not measured in this non-ready fixture
Expected lock type: metadata lock
Rewrite or scan risk: no
Expected duration: bounded
Online-safe strategy: expand only
Backfill plan: none
Validation plan: disposable schema check
Maintenance mode required: no
Rollback feasibility: compatible application rollback
Forward-recovery plan: reviewed correction
Backup evidence ID requirement: exact backup evidence ID required before execution
Approver: not approved for production execution
Approval timestamp: not recorded because Production ready is false
Production ready: false
Production result: not deployed
`
}

async function createMigrationFixture({ report, sql }: { report?: string; sql: string }) {
  const root = await mkdtemp(join(tmpdir(), "arctic-rss-migration-risk-"))
  temporaryDirectories.push(root)
  const name = "20260808120000_fixture"
  const migrationDirectory = join(root, "prisma", "migrations", name)
  await mkdir(migrationDirectory, { recursive: true })
  await writeFile(join(migrationDirectory, "migration.sql"), sql)
  if (report) {
    const reportDirectory = join(root, "docs", "operations", "migration-risk")
    await mkdir(reportDirectory, { recursive: true })
    await writeFile(join(reportDirectory, `${name}.md`), report)
  }

  return { name, root }
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })))
})

describe("migration risk checker", () => {
  it("requires hash-bound evidence even when the advisory classifier finds nothing", async () => {
    const sql = 'ALTER TABLE "Article" ADD COLUMN "fingerprint" TEXT;'
    const missing = await createMigrationFixture({ sql })
    expect(inspectMigration(missing.name, missing.root)).toMatchObject({
      errors: [expect.stringContaining("risk report")],
      findings: [],
    })

    const wrongHash = await createMigrationFixture({
      report: riskReport("20260808120000_fixture", sql, { hash: "0".repeat(64) }),
      sql,
    })
    expect(inspectMigration(wrongHash.name, wrongHash.root)).toMatchObject({
      errors: [expect.stringContaining("Migration SQL SHA-256 does not match migration SQL")],
      findings: [],
    })

    const verified = await createMigrationFixture({
      report: riskReport("20260808120000_fixture", sql),
      sql,
    })
    expect(inspectMigration(verified.name, verified.root)).toMatchObject({ errors: [], findings: [] })
  })

  it("keeps classifier findings visible after exact report validation", async () => {
    const sql = 'CREATE INDEX "Article_title_idx" ON "Article" ("title");'
    const fixture = await createMigrationFixture({
      report: riskReport("20260808120000_fixture", sql),
      sql,
    })

    expect(inspectMigration(fixture.name, fixture.root)).toMatchObject({
      errors: [],
      findings: [expect.objectContaining({ code: "NON_CONCURRENT_INDEX" })],
    })
  })
})

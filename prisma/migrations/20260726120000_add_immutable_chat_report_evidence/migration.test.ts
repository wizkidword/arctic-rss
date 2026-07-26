import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const migrationPath = join(
  process.cwd(),
  "prisma",
  "migrations",
  "20260726120000_add_immutable_chat_report_evidence",
  "migration.sql"
)

describe("immutable chat report evidence migration", () => {
  it("marks older snapshots partial without overwriting their stored evidence", async () => {
    const migration = await readFile(migrationPath, "utf8")

    expect(migration).toContain('DEFAULT \'LEGACY_PARTIAL\'')
    expect(migration).toContain('ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP')
    expect(migration).not.toMatch(/UPDATE\s+"ChatReportEvidence"/i)
  })

  it("prevents in-place evidence updates while keeping report-cascade deletion available", async () => {
    const migration = await readFile(migrationPath, "utf8")

    expect(migration).toContain('BEFORE UPDATE ON "ChatReportEvidence"')
    expect(migration).not.toMatch(/BEFORE DELETE ON "ChatReportEvidence"/i)
  })
})

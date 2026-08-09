import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const migrationPath = join(
  process.cwd(),
  "prisma",
  "migrations",
  "20260809130000_add_opml_entry_leases",
  "migration.sql",
)

describe("OPML entry lease migration", () => {
  it("adds only expand-safe entry fencing metadata", async () => {
    const migration = await readFile(migrationPath, "utf8")

    expect(migration).toContain("ALTER TYPE \"ImportEntryStatus\" ADD VALUE 'PROCESSING'")
    expect(migration).toContain('ADD COLUMN "attempt" INTEGER NOT NULL DEFAULT 0')
    expect(migration).toContain('ADD COLUMN "leaseOwner" TEXT')
    expect(migration).toContain('ADD COLUMN "leaseExpiresAt" TIMESTAMP(3)')
    expect(migration).toContain('ADD COLUMN "processingStartedAt" TIMESTAMP(3)')
    expect(migration).toContain('"ImportJobEntry_importJobId_status_leaseExpiresAt_sequence_idx"')
    expect(migration).not.toMatch(/DROP\s+(COLUMN|TABLE)/i)
  })
})

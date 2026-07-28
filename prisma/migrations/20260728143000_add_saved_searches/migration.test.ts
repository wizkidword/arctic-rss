import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const migrationPath = join(
  process.cwd(),
  "prisma",
  "migrations",
  "20260728143000_add_saved_searches",
  "migration.sql"
)

describe("saved searches migration", () => {
  it("stores versioned search definitions under a user-owned cascade", async () => {
    const migration = await readFile(migrationPath, "utf8")

    expect(migration).toContain('CREATE TABLE "SavedSearch"')
    expect(migration).toContain('"definitionVersion" INTEGER NOT NULL DEFAULT 1')
    expect(migration).toContain('"SavedSearch_userId_fkey"')
    expect(migration).toContain('REFERENCES "User"("id") ON DELETE CASCADE')
  })

  it("includes the owner-scoped lookup and composite ownership indexes", async () => {
    const migration = await readFile(migrationPath, "utf8")

    expect(migration).toContain('"SavedSearch_userId_id_key"')
    expect(migration).toContain('"SavedSearch_userId_updatedAt_idx"')
  })
})

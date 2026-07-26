import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const migrationPath = join(
  process.cwd(),
  "prisma",
  "migrations",
  "20260726130000_make_chat_moderation_atomic",
  "migration.sql"
)

describe("atomic chat moderation migration", () => {
  it("prevents duplicate active legal holds without altering existing holds", async () => {
    const migration = await readFile(migrationPath, "utf8")

    expect(migration).toContain('ON "ChatLegalHold"("subjectType", "subjectId")')
    expect(migration).toContain('WHERE "releasedAt" IS NULL')
    expect(migration).not.toMatch(/(?:UPDATE|DELETE)\s+"ChatLegalHold"/i)
  })
})

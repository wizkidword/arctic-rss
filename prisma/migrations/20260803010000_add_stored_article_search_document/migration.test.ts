import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const migrationPath = join(
  process.cwd(),
  "prisma",
  "migrations",
  "20260803010000_add_stored_article_search_document",
  "migration.sql"
)

describe("stored article search document migration", () => {
  it("replaces the repeated expression index with a generated weighted vector", async () => {
    const migration = await readFile(migrationPath, "utf8")

    expect(migration).toContain('ADD COLUMN "searchDocument" tsvector GENERATED ALWAYS AS')
    expect(migration).toContain("setweight(to_tsvector('simple'::regconfig")
    expect(migration).toContain('CREATE INDEX "Article_searchDocument_stored_idx"')
    expect(migration).toContain('DROP INDEX "Article_searchDocument_idx"')
    expect(migration).toContain('RENAME TO "Article_searchDocument_idx"')
  })
})

import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const migrationPath = join(
  process.cwd(),
  "prisma",
  "migrations",
  "20260809153000_add_subscription_reverse_indexes",
  "migration.sql",
)

describe("subscription reverse-index migration", () => {
  it("builds both reverse indexes concurrently", async () => {
    const migration = await readFile(migrationPath, "utf8")

    expect(migration).toContain(
      'CREATE INDEX CONCURRENTLY "FeedSubscription_feedId_idx"',
    )
    expect(migration).toContain(
      'CREATE INDEX CONCURRENTLY "PodcastSubscription_podcastId_idx"',
    )
    expect(migration).not.toMatch(/CREATE\s+INDEX(?!\s+CONCURRENTLY)/i)
  })
})

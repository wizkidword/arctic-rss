import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const migrationPath = join(
  process.cwd(),
  "prisma",
  "migrations",
  "20260726140000_add_ai_operation_leases",
  "migration.sql",
)

describe("AI operation lease migration", () => {
  it("adds only expand-safe fencing and recovery metadata", async () => {
    const migration = await readFile(migrationPath, "utf8")

    expect(migration).toContain('ADD COLUMN "leaseOwner" TEXT')
    expect(migration).toContain('ADD COLUMN "leaseExpiresAt" TIMESTAMP(3)')
    expect(migration).toContain('ADD COLUMN "attempt" INTEGER NOT NULL DEFAULT 0')
    expect(migration).toContain('ADD COLUMN "lastHeartbeatAt" TIMESTAMP(3)')
    expect(migration).toContain('ADD COLUMN "retryableAt" TIMESTAMP(3)')
    expect(migration).not.toMatch(/DROP\s+(COLUMN|TABLE)/i)
  })
})

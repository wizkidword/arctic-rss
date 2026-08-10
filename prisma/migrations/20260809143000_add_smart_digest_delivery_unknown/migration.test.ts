import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

const migrationPath = fileURLToPath(new URL("./migration.sql", import.meta.url))

describe("add smart digest delivery-unknown migration", () => {
  it("adds an additive delivery reconciliation state", async () => {
    const migration = await readFile(migrationPath, "utf8")

    expect(migration).toContain('ALTER TYPE "SmartDigestEmailStatus" ADD VALUE')
    expect(migration).toContain("'DELIVERY_UNKNOWN'")
    expect(migration).not.toMatch(/DROP|RENAME|DELETE|UPDATE/i)
  })
})

import { describe, expect, it } from "vitest"

import {
  DATABASE_APPLICATION_CONNECTION_BUDGET,
  DATABASE_CONNECTION_BUDGET,
  DATABASE_CONNECTION_RESERVE_TOTAL,
  DATABASE_RUNTIME_ROLES,
  getDatabaseConnectionBudgetForRole,
} from "./database-connection-budget"

describe("database connection budget", () => {
  it("keeps explicit admin, recovery, and monitoring capacity outside application pools", () => {
    expect(DATABASE_CONNECTION_BUDGET.postgres.maxConnections).toBe(100)
    expect(DATABASE_CONNECTION_RESERVE_TOTAL).toBe(15)
    expect(DATABASE_APPLICATION_CONNECTION_BUDGET).toBe(85)
    expect(getDatabaseConnectionBudgetForRole("migrate").poolMax).toBeLessThanOrEqual(
      DATABASE_CONNECTION_BUDGET.postgres.reserves.migrationRecovery
    )
  })

  it("gives every Prisma-backed production role a named, bounded pool", () => {
    for (const role of DATABASE_RUNTIME_ROLES) {
      const budget = getDatabaseConnectionBudgetForRole(role)

      expect(budget.poolMax).toBeGreaterThan(0)
      expect(budget.applicationName).toMatch(/^arctic-rss-[a-z0-9-]+$/)
    }
  })
})

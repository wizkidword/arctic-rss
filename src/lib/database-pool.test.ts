import { describe, expect, it, vi } from "vitest"

import { createDatabasePool } from "./database-pool"

describe("database pool", () => {
  it("passes the reviewed limits to node-postgres and records only safe startup fields", async () => {
    const logger = vi.fn()
    const pool = createDatabasePool({
      connectionString: "postgresql://runtime:password@localhost:5432/arctic_rss",
      logger,
      serviceRole: "web",
      settings: {
        applicationName: "arctic-rss-web",
        connectionTimeoutMs: 3000,
        idleTimeoutMs: 10000,
        poolMax: 6,
        statementTimeoutMs: 15000,
      },
    })

    expect(pool.options).toMatchObject({
      application_name: "arctic-rss-web",
      connectionTimeoutMillis: 3000,
      idleTimeoutMillis: 10000,
      max: 6,
      statement_timeout: 15000,
    })
    expect(logger).toHaveBeenCalledWith(
      "database_pool_configured",
      expect.objectContaining({
        db_application_name: "arctic-rss-web",
        db_pool_max: 6,
        db_statement_timeout_ms: 15000,
        service_role: "web",
      })
    )
    expect(JSON.stringify(logger.mock.calls)).not.toContain("password")

    await pool.end()
  })
})

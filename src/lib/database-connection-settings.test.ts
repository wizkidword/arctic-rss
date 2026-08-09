import { describe, expect, it } from "vitest"

import {
  assertDatabaseConnectionSettings,
  DatabaseConnectionConfigurationError,
  getDatabaseConnectionSettings,
} from "./database-connection-settings"

describe("database connection settings", () => {
  it("uses the reviewed settings and application name for a service role", () => {
    expect(
      assertDatabaseConnectionSettings(
        {
          DB_APPLICATION_NAME: "arctic-rss-web",
          DB_CONNECTION_TIMEOUT_MS: "3000",
          DB_IDLE_TIMEOUT_MS: "10000",
          DB_POOL_MAX: "6",
          DB_STATEMENT_TIMEOUT_MS: "15000",
        },
        "web"
      )
    ).toEqual({
      applicationName: "arctic-rss-web",
      connectionTimeoutMs: 3000,
      idleTimeoutMs: 10000,
      poolMax: 6,
      statementTimeoutMs: 15000,
    })
  })

  it("uses safe local defaults only when a service role is absent", () => {
    expect(getDatabaseConnectionSettings({})).toEqual({
      applicationName: "arctic-rss-local",
      connectionTimeoutMs: 3000,
      idleTimeoutMs: 10000,
      poolMax: 4,
      statementTimeoutMs: 15000,
    })
  })

  it("rejects a pool that exceeds its role allocation", () => {
    expect(() =>
      assertDatabaseConnectionSettings(
        {
          DB_APPLICATION_NAME: "arctic-rss-worker-health",
          DB_POOL_MAX: "3",
        },
        "worker-health"
      )
    ).toThrow("DB_POOL_MAX must be between 1 and 2 for worker-health")
  })

  it("rejects invalid timeout and application-name values", () => {
    expect(() =>
      getDatabaseConnectionSettings({ DB_CONNECTION_TIMEOUT_MS: "unbounded" })
    ).toThrow(DatabaseConnectionConfigurationError)

    expect(() =>
      getDatabaseConnectionSettings({ DB_STATEMENT_TIMEOUT_MS: "60001" })
    ).toThrow("DB_STATEMENT_TIMEOUT_MS must be between 1000 and 60000")

    expect(() =>
      assertDatabaseConnectionSettings(
        { DB_APPLICATION_NAME: "arctic-rss-web-extra" },
        "web"
      )
    ).toThrow("DB_APPLICATION_NAME must be arctic-rss-web for web")
  })
})

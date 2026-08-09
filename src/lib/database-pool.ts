import { Pool, type PoolClient } from "pg"

import type { DatabaseConnectionSettings } from "./database-connection-settings"

type DatabasePoolMetricFields = Record<string, number | string>
type DatabasePoolLogger = (
  event: string,
  fields: DatabasePoolMetricFields
) => void

type ConnectCallback = (
  error: Error | undefined,
  client: PoolClient | undefined,
  release: (error?: Error) => void
) => void

const SLOW_POOL_WAIT_MS = 100

function defaultLogger(event: string, fields: DatabasePoolMetricFields) {
  console.info(JSON.stringify({ event, ...fields }))
}

function poolCounts(pool: Pool) {
  return {
    pool_active_count: Math.max(0, pool.totalCount - pool.idleCount),
    pool_idle_count: pool.idleCount,
    pool_waiting_count: pool.waitingCount,
  }
}

function baseMetricFields(
  pool: Pool,
  settings: DatabaseConnectionSettings,
  serviceRole: string
) {
  return {
    db_application_name: settings.applicationName,
    db_statement_timeout_ms: settings.statementTimeoutMs,
    service_role: serviceRole,
    ...poolCounts(pool),
  }
}

function isConnectionAcquisitionTimeout(error: Error) {
  return /timeout/i.test(error.message) && /connect|connection/i.test(error.message)
}

/**
 * Prisma uses both `pool.query()` and `pool.connect()`. Wrapping `connect`
 * captures both paths because node-postgres routes pool queries through it.
 * Slow waits and timeouts are logged as low-cardinality operational metrics;
 * routine sub-100ms acquisitions are deliberately not logged per query.
 */
function instrumentPoolAcquisition(
  pool: Pool,
  settings: DatabaseConnectionSettings,
  serviceRole: string,
  logger: DatabasePoolLogger
) {
  const originalConnect = pool.connect.bind(pool) as unknown as (
    callback?: ConnectCallback
  ) => Promise<PoolClient> | void

  const recordAcquired = (startedAt: number) => {
    const waitDurationMs = Math.max(0, Date.now() - startedAt)

    if (waitDurationMs >= SLOW_POOL_WAIT_MS) {
      logger("database_pool_wait", {
        ...baseMetricFields(pool, settings, serviceRole),
        pool_wait_duration_ms: waitDurationMs,
      })
    }
  }

  const recordFailure = (startedAt: number, error: Error) => {
    if (isConnectionAcquisitionTimeout(error)) {
      logger("database_pool_acquisition_timeout", {
        ...baseMetricFields(pool, settings, serviceRole),
        pool_wait_duration_ms: Math.max(0, Date.now() - startedAt),
      })
    }
  }

  const wrappedConnect = ((callback?: ConnectCallback) => {
    const startedAt = Date.now()

    if (callback) {
      return originalConnect((error, client, release) => {
        if (error) {
          recordFailure(startedAt, error)
        } else {
          recordAcquired(startedAt)
        }

        callback(error, client, release)
      })
    }

    return (originalConnect() as Promise<PoolClient>).then(
      (client) => {
        recordAcquired(startedAt)
        return client
      },
      (error: unknown) => {
        if (error instanceof Error) {
          recordFailure(startedAt, error)
        }

        throw error
      }
    )
  }) as unknown as Pool["connect"]

  pool.connect = wrappedConnect
}

export function createDatabasePool({
  connectionString,
  logger = defaultLogger,
  serviceRole = process.env.ARCTIC_RSS_SERVICE_ROLE?.trim() || "local",
  settings,
}: {
  connectionString: string
  logger?: DatabasePoolLogger
  serviceRole?: string
  settings: DatabaseConnectionSettings
}) {
  const pool = new Pool({
    application_name: settings.applicationName,
    connectionString,
    connectionTimeoutMillis: settings.connectionTimeoutMs,
    idleTimeoutMillis: settings.idleTimeoutMs,
    max: settings.poolMax,
    statement_timeout: settings.statementTimeoutMs,
  })

  instrumentPoolAcquisition(pool, settings, serviceRole, logger)

  pool.on("connect", () => {
    logger("database_pool_connected", baseMetricFields(pool, settings, serviceRole))
  })

  pool.on("error", () => {
    logger("database_pool_error", baseMetricFields(pool, settings, serviceRole))
  })

  logger("database_pool_configured", {
    ...baseMetricFields(pool, settings, serviceRole),
    db_connection_timeout_ms: settings.connectionTimeoutMs,
    db_idle_timeout_ms: settings.idleTimeoutMs,
    db_pool_max: settings.poolMax,
  })

  return pool
}

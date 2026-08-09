import {
  getDatabaseConnectionBudgetForRole,
  isDatabaseRuntimeRole,
  type DatabaseRuntimeRole,
} from "./database-connection-budget"

type Environment = Readonly<Record<string, string | undefined>>

export const DATABASE_CONNECTION_ENVIRONMENT_VARIABLES = [
  "DB_APPLICATION_NAME",
  "DB_CONNECTION_TIMEOUT_MS",
  "DB_IDLE_TIMEOUT_MS",
  "DB_POOL_MAX",
  "DB_STATEMENT_TIMEOUT_MS",
] as const

export const DEFAULT_DATABASE_CONNECTION_SETTINGS = {
  applicationName: "arctic-rss-local",
  connectionTimeoutMs: 3_000,
  idleTimeoutMs: 10_000,
  poolMax: 4,
  statementTimeoutMs: 15_000,
} as const

const NUMERIC_BOUNDS = {
  DB_CONNECTION_TIMEOUT_MS: { minimum: 250, maximum: 10_000 },
  DB_IDLE_TIMEOUT_MS: { minimum: 1_000, maximum: 60_000 },
  DB_STATEMENT_TIMEOUT_MS: { minimum: 1_000, maximum: 60_000 },
} as const

export class DatabaseConnectionConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DatabaseConnectionConfigurationError"
  }
}

export type DatabaseConnectionSettings = {
  applicationName: string
  connectionTimeoutMs: number
  idleTimeoutMs: number
  poolMax: number
  statementTimeoutMs: number
}

function parseBoundedInteger(
  environment: Environment,
  variable: keyof typeof NUMERIC_BOUNDS,
  fallback: number
) {
  const raw = environment[variable]?.trim()

  if (!raw) {
    return fallback
  }

  if (!/^\d+$/.test(raw)) {
    throw new DatabaseConnectionConfigurationError(
      `${variable} must be a whole number.`
    )
  }

  const value = Number(raw)
  const { maximum, minimum } = NUMERIC_BOUNDS[variable]

  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new DatabaseConnectionConfigurationError(
      `${variable} must be between ${minimum} and ${maximum}.`
    )
  }

  return value
}

function getConfiguredRuntimeRole(environment: Environment) {
  const role = environment.ARCTIC_RSS_SERVICE_ROLE?.trim()

  return role && isDatabaseRuntimeRole(role) ? role : undefined
}

function parsePoolMax(
  environment: Environment,
  role: DatabaseRuntimeRole | undefined
) {
  const raw = environment.DB_POOL_MAX?.trim()
  const roleMaximum = role
    ? getDatabaseConnectionBudgetForRole(role).poolMax
    : DEFAULT_DATABASE_CONNECTION_SETTINGS.poolMax
  const fallback = roleMaximum

  if (!raw) {
    return fallback
  }

  if (!/^\d+$/.test(raw)) {
    throw new DatabaseConnectionConfigurationError(
      "DB_POOL_MAX must be a whole number."
    )
  }

  const value = Number(raw)

  if (!Number.isSafeInteger(value) || value < 1 || value > roleMaximum) {
    throw new DatabaseConnectionConfigurationError(
      `DB_POOL_MAX must be between 1 and ${roleMaximum}${role ? ` for ${role}` : ""}.`
    )
  }

  return value
}

function parseApplicationName(
  environment: Environment,
  role: DatabaseRuntimeRole | undefined
) {
  const fallback = role
    ? getDatabaseConnectionBudgetForRole(role).applicationName
    : DEFAULT_DATABASE_CONNECTION_SETTINGS.applicationName
  const applicationName = environment.DB_APPLICATION_NAME?.trim() || fallback

  if (
    Buffer.byteLength(applicationName, "utf8") > 63 ||
    !/^[a-z][a-z0-9_-]*$/.test(applicationName)
  ) {
    throw new DatabaseConnectionConfigurationError(
      "DB_APPLICATION_NAME must be a lowercase PostgreSQL application name of at most 63 bytes."
    )
  }

  if (
    role &&
    applicationName !== getDatabaseConnectionBudgetForRole(role).applicationName
  ) {
    throw new DatabaseConnectionConfigurationError(
      `DB_APPLICATION_NAME must be ${getDatabaseConnectionBudgetForRole(role).applicationName} for ${role}.`
    )
  }

  return applicationName
}

export function getDatabaseConnectionSettings(
  environment: Environment = process.env
): DatabaseConnectionSettings {
  const role = getConfiguredRuntimeRole(environment)

  return {
    applicationName: parseApplicationName(environment, role),
    connectionTimeoutMs: parseBoundedInteger(
      environment,
      "DB_CONNECTION_TIMEOUT_MS",
      DEFAULT_DATABASE_CONNECTION_SETTINGS.connectionTimeoutMs
    ),
    idleTimeoutMs: parseBoundedInteger(
      environment,
      "DB_IDLE_TIMEOUT_MS",
      DEFAULT_DATABASE_CONNECTION_SETTINGS.idleTimeoutMs
    ),
    poolMax: parsePoolMax(environment, role),
    statementTimeoutMs: parseBoundedInteger(
      environment,
      "DB_STATEMENT_TIMEOUT_MS",
      DEFAULT_DATABASE_CONNECTION_SETTINGS.statementTimeoutMs
    ),
  }
}

export function assertDatabaseConnectionSettings(
  environment: Environment,
  role: DatabaseRuntimeRole
) {
  return getDatabaseConnectionSettings({
    ...environment,
    ARCTIC_RSS_SERVICE_ROLE: role,
  })
}

import { isEmailVerificationRequired } from "./email-verification-policy"
import {
  AppOriginConfigurationError,
  assertProductionAppOrigin,
  getAllowedAppHosts,
  getAppOrigin,
} from "./app-origin"
import { assertTurnstileConfiguration } from "./turnstile"

export class UnsafeProductionConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "UnsafeProductionConfigurationError"
  }
}

const REQUIRED_SECRET_VALUES = new Set([
  "change_me",
  "example",
  "password",
  "postgres",
  "redis",
  "replace_me",
  "secret",
])

function assertRequiredValue(
  environment: NodeJS.ProcessEnv,
  variable: string
) {
  const value = environment[variable]?.trim()

  if (!value) {
    throw new UnsafeProductionConfigurationError(
      `${variable} must be configured in production.`
    )
  }

  return value
}

function assertNonPlaceholderSecret(variable: string, value: string) {
  const normalized = value.trim().toLowerCase()
  const isTemplateValue =
    normalized.startsWith("change_me") ||
    normalized.startsWith("replace_me") ||
    REQUIRED_SECRET_VALUES.has(normalized)

  if (isTemplateValue) {
    throw new UnsafeProductionConfigurationError(
      `${variable} must not use a placeholder or known insecure default in production.`
    )
  }
}

function assertRequiredSecret(
  environment: NodeJS.ProcessEnv,
  variable: string,
  minimumBytes = 1
) {
  const value = assertRequiredValue(environment, variable)

  assertNonPlaceholderSecret(variable, value)

  if (Buffer.byteLength(value, "utf8") < minimumBytes) {
    throw new UnsafeProductionConfigurationError(
      `${variable} must be at least ${minimumBytes} bytes in production.`
    )
  }

  return value
}

function decodeUrlCredential(url: URL, variable: string) {
  try {
    return decodeURIComponent(url.password)
  } catch {
    throw new UnsafeProductionConfigurationError(
      `${variable} must contain a valid URL-encoded password in production.`
    )
  }
}

function assertCredentialedUrl(
  environment: NodeJS.ProcessEnv,
  variable: string,
  protocols: ReadonlySet<string>,
  { requireUsername = true }: { requireUsername?: boolean } = {}
) {
  const value = assertRequiredValue(environment, variable)
  let url: URL

  try {
    url = new URL(value)
  } catch {
    throw new UnsafeProductionConfigurationError(
      `${variable} must be a valid connection URL in production.`
    )
  }

  if (!protocols.has(url.protocol)) {
    throw new UnsafeProductionConfigurationError(
      `${variable} must use an approved connection protocol in production.`
    )
  }

  if (!url.password || (requireUsername && !url.username)) {
    throw new UnsafeProductionConfigurationError(
      `${variable} must include ${requireUsername ? "a username and password" : "a password"} in production.`
    )
  }

  assertNonPlaceholderSecret(variable, decodeUrlCredential(url, variable))

  return url
}

function databaseTarget(url: URL) {
  const databaseName = decodeURIComponent(url.pathname).replace(/^\/+/, "")
  const schema = url.searchParams.get("schema") ?? "public"

  if (!databaseName) {
    throw new UnsafeProductionConfigurationError(
      "Production database URLs must include a database name."
    )
  }

  return { databaseName, schema }
}

function assertCompatibleDatabaseUrls(runtimeUrl: URL, migrationUrl: URL) {
  const runtimeTarget = databaseTarget(runtimeUrl)
  const migrationTarget = databaseTarget(migrationUrl)

  if (
    runtimeTarget.databaseName !== migrationTarget.databaseName ||
    runtimeTarget.schema !== migrationTarget.schema
  ) {
    throw new UnsafeProductionConfigurationError(
      "DATABASE_URL and MIGRATE_DATABASE_URL must target the same database and schema in production."
    )
  }
}

function assertProductionServiceSecrets(environment: NodeJS.ProcessEnv) {
  assertRequiredSecret(environment, "POSTGRES_PASSWORD")

  const runtimeDatabaseUrl = assertCredentialedUrl(
    environment,
    "DATABASE_URL",
    new Set(["postgres:", "postgresql:"])
  )
  const migrationDatabaseUrl = assertCredentialedUrl(
    environment,
    "MIGRATE_DATABASE_URL",
    new Set(["postgres:", "postgresql:"])
  )

  assertCompatibleDatabaseUrls(runtimeDatabaseUrl, migrationDatabaseUrl)

  const redisPassword = assertRequiredSecret(environment, "REDIS_PASSWORD")
  const redisUrl = assertCredentialedUrl(
    environment,
    "REDIS_URL",
    new Set(["redis:", "rediss:"]),
    { requireUsername: false }
  )

  if (decodeUrlCredential(redisUrl, "REDIS_URL") !== redisPassword) {
    throw new UnsafeProductionConfigurationError(
      "REDIS_URL password must match REDIS_PASSWORD in production."
    )
  }

  assertRequiredSecret(environment, "AUTH_SECRET", 32)
}

export function assertSecureProductionConfiguration(
  environment: NodeJS.ProcessEnv = process.env
) {
  if (environment.NODE_ENV !== "production") {
    return
  }

  if (!isEmailVerificationRequired(environment.REQUIRE_EMAIL_VERIFICATION)) {
    throw new UnsafeProductionConfigurationError(
      "REQUIRE_EMAIL_VERIFICATION must be enabled in production."
    )
  }

  if (environment.ADMIN_EMAILS?.trim()) {
    throw new UnsafeProductionConfigurationError(
      "ADMIN_EMAILS is no longer supported. Remove it before starting production."
    )
  }

  let appOrigin: URL

  try {
    appOrigin = assertProductionAppOrigin(environment)
    getAllowedAppHosts(environment)
  } catch (error) {
    if (error instanceof AppOriginConfigurationError) {
      throw new UnsafeProductionConfigurationError(error.message)
    }

    throw error
  }

  if (!environment.AUTH_URL?.trim()) {
    throw new UnsafeProductionConfigurationError(
      "AUTH_URL must be configured in production."
    )
  }

  for (const variable of ["AUTH_URL", "NEXTAUTH_URL", "NEXT_PUBLIC_APP_URL"]) {
    const value = environment[variable]?.trim()

    if (!value) {
      continue
    }

    let configuredOrigin: URL

    try {
      configuredOrigin = getAppOrigin({ APP_ORIGIN: value })
    } catch {
      throw new UnsafeProductionConfigurationError(
        `${variable} must be a valid application origin when configured.`
      )
    }

    if (configuredOrigin.origin !== appOrigin.origin) {
      throw new UnsafeProductionConfigurationError(
        `${variable} must match APP_ORIGIN in production.`
      )
    }
  }

  assertProductionServiceSecrets(environment)

  assertTurnstileConfiguration(environment)
}

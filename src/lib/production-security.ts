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

export const PRODUCTION_SERVICE_ROLES = [
  "chat-gateway",
  "web",
  "worker-ai-mail",
  "worker-all",
  "worker-chat-events",
  "worker-imports",
  "worker-ingestion",
  "worker-maintenance",
] as const

export type ProductionServiceRole = (typeof PRODUCTION_SERVICE_ROLES)[number]
type ProductionEnvironment = Readonly<Record<string, string | undefined>>

const REQUIRED_SECRET_VALUES = new Set([
  "change_me",
  "example",
  "password",
  "postgres",
  "redis",
  "replace_me",
  "secret",
])

const WORKER_ROLES = new Set<ProductionServiceRole>([
  "worker-ai-mail",
  "worker-all",
  "worker-chat-events",
  "worker-imports",
  "worker-ingestion",
  "worker-maintenance",
])

const WORKER_FORBIDDEN_VARIABLES = [
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
  "AUTH_SECRET",
  "CLOUDFLARE_TUNNEL_TOKEN",
  "MIGRATE_DATABASE_URL",
  "POSTGRES_PASSWORD",
  "REDIS_PASSWORD",
  "TURNSTILE_SECRET_KEY",
] as const

function assertRequiredValue(
  environment: ProductionEnvironment,
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
  environment: ProductionEnvironment,
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
  environment: ProductionEnvironment,
  variable: string,
  protocols: ReadonlySet<string>,
  { requireUsername = true }: { requireUsername?: boolean } = {}
) {
  return assertCredentialedUrlValue(
    assertRequiredValue(environment, variable),
    variable,
    protocols,
    { requireUsername }
  )
}

function assertCredentialedUrlValue(
  value: string,
  variable: string,
  protocols: ReadonlySet<string>,
  { requireUsername = true }: { requireUsername?: boolean } = {}
) {
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

function assertRedisUrl(
  environment: ProductionEnvironment,
  workloadVariable: "DURABLE_REDIS_URL" | "EPHEMERAL_REDIS_URL"
) {
  const workloadUrl = environment[workloadVariable]?.trim()
  const legacyUrl = environment.REDIS_URL?.trim()
  const variable = workloadUrl ? workloadVariable : "REDIS_URL"
  const value = workloadUrl || legacyUrl

  if (!value) {
    throw new UnsafeProductionConfigurationError(
      `${workloadVariable} or REDIS_URL must be configured in production.`
    )
  }

  return assertCredentialedUrlValue(
    value,
    variable,
    new Set(["redis:", "rediss:"]),
    { requireUsername: false }
  )
}

function assertRuntimeDatabaseUrl(environment: ProductionEnvironment) {
  return assertCredentialedUrl(
    environment,
    "DATABASE_URL",
    new Set(["postgres:", "postgresql:"])
  )
}

function assertNoSensitiveVariables(
  environment: ProductionEnvironment,
  role: ProductionServiceRole,
  variables: readonly string[]
) {
  for (const variable of variables) {
    if (environment[variable]?.trim()) {
      throw new UnsafeProductionConfigurationError(
        `${variable} must not be present for the ${role} service.`
      )
    }
  }
}

function assertWebOrigins(environment: ProductionEnvironment) {
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
}

function assertWebConfiguration(environment: ProductionEnvironment) {
  assertNoSensitiveVariables(environment, "web", [
    "CLOUDFLARE_TUNNEL_TOKEN",
    "MIGRATE_DATABASE_URL",
    "POSTGRES_PASSWORD",
    "REDIS_PASSWORD",
  ])
  assertWebOrigins(environment)
  assertRuntimeDatabaseUrl(environment)
  assertRedisUrl(environment, "DURABLE_REDIS_URL")
  assertRedisUrl(environment, "EPHEMERAL_REDIS_URL")
  assertRequiredSecret(environment, "AUTH_SECRET", 32)
  assertTurnstileConfiguration(environment)
}

function assertWorkerConfiguration(
  environment: ProductionEnvironment,
  role: ProductionServiceRole
) {
  assertNoSensitiveVariables(environment, role, WORKER_FORBIDDEN_VARIABLES)
  assertRuntimeDatabaseUrl(environment)
  assertRedisUrl(environment, "DURABLE_REDIS_URL")

  if (role === "worker-all" || role === "worker-chat-events") {
    assertRedisUrl(environment, "EPHEMERAL_REDIS_URL")
  }
}

function assertChatGatewayConfiguration(environment: ProductionEnvironment) {
  assertNoSensitiveVariables(environment, "chat-gateway", [
    "ANTHROPIC_API_KEY",
    "AUTH_GOOGLE_ID",
    "AUTH_GOOGLE_SECRET",
    "AUTH_SECRET",
    "CLOUDFLARE_TUNNEL_TOKEN",
    "MIGRATE_DATABASE_URL",
    "OPENAI_API_KEY",
    "POSTGRES_PASSWORD",
    "REDIS_PASSWORD",
    "SMTP_PASSWORD",
    "SMTP_USER",
    "TURNSTILE_SECRET_KEY",
  ])

  try {
    assertProductionAppOrigin(environment)
  } catch (error) {
    if (error instanceof AppOriginConfigurationError) {
      throw new UnsafeProductionConfigurationError(error.message)
    }

    throw error
  }

  assertRuntimeDatabaseUrl(environment)
  assertRedisUrl(environment, "EPHEMERAL_REDIS_URL")
  assertRequiredSecret(environment, "ARCTIC_IRC_TOKEN_SECRET", 32)
}

function resolveProductionServiceRole(role: string): ProductionServiceRole {
  if ((PRODUCTION_SERVICE_ROLES as readonly string[]).includes(role)) {
    return role as ProductionServiceRole
  }

  throw new UnsafeProductionConfigurationError(
    `ARCTIC_RSS_SERVICE_ROLE must be one of: ${PRODUCTION_SERVICE_ROLES.join(", ")}.`
  )
}

export function assertSecureProductionConfiguration(
  environment: ProductionEnvironment = process.env,
  role = "web"
) {
  if (environment.NODE_ENV !== "production") {
    return
  }

  const serviceRole = resolveProductionServiceRole(role)

  if (serviceRole === "web") {
    assertWebConfiguration(environment)
    return
  }

  if (serviceRole === "chat-gateway") {
    assertChatGatewayConfiguration(environment)
    return
  }

  if (WORKER_ROLES.has(serviceRole)) {
    assertWorkerConfiguration(environment, serviceRole)
  }
}

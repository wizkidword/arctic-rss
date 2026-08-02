export type RedisConnectionOptions = {
  url: string
}

type RedisEnvironment = Readonly<Record<string, string | undefined>>

const DEFAULT_REDIS_URL = "redis://localhost:6379"
export const LEGACY_REDIS_MIGRATION_FLAG =
  "ARCTIC_RSS_ALLOW_LEGACY_REDIS_URL_FOR_MIGRATION"

export class RedisConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "RedisConfigurationError"
  }
}

function redisUrl(
  environment: RedisEnvironment,
  preferredVariable: "DURABLE_REDIS_URL" | "EPHEMERAL_REDIS_URL"
) {
  const workloadUrl = environment[preferredVariable]?.trim()

  if (workloadUrl) {
    return workloadUrl
  }

  const legacyUrl = environment.REDIS_URL?.trim()
  const isProduction = environment.NODE_ENV === "production"
  const legacyMigrationAllowed =
    environment[LEGACY_REDIS_MIGRATION_FLAG]?.trim().toLowerCase() === "true"

  if (legacyUrl && (!isProduction || legacyMigrationAllowed)) {
    return legacyUrl
  }

  if (isProduction) {
    throw new RedisConfigurationError(
      `${preferredVariable} must be configured in production; REDIS_URL requires ${LEGACY_REDIS_MIGRATION_FLAG}=true.`
    )
  }

  return DEFAULT_REDIS_URL
}

export function durableRedisConnectionOptions(
  environment: RedisEnvironment = process.env
): RedisConnectionOptions {
  return { url: redisUrl(environment, "DURABLE_REDIS_URL") }
}

export function ephemeralRedisConnectionOptions(
  environment: RedisEnvironment = process.env
): RedisConnectionOptions {
  return { url: redisUrl(environment, "EPHEMERAL_REDIS_URL") }
}

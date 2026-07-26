export type RedisConnectionOptions = {
  url: string
}

type RedisEnvironment = Readonly<Record<string, string | undefined>>

const DEFAULT_REDIS_URL = "redis://localhost:6379"

function redisUrl(
  environment: RedisEnvironment,
  preferredVariable: "DURABLE_REDIS_URL" | "EPHEMERAL_REDIS_URL"
) {
  return (
    environment[preferredVariable]?.trim() ||
    // REDIS_URL remains a deliberate temporary fallback for a one-instance
    // rollout. New deployments must set both workload-specific URLs.
    environment.REDIS_URL?.trim() ||
    DEFAULT_REDIS_URL
  )
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

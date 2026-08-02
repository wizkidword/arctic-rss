import { describe, expect, it } from "vitest"

import {
  durableRedisConnectionOptions,
  ephemeralRedisConnectionOptions,
  RedisConfigurationError,
} from "./redis-config"

describe("Redis workload connection configuration", () => {
  it("uses distinct workload URLs when both are configured", () => {
    const environment = {
      DURABLE_REDIS_URL: "redis://durable:6379",
      EPHEMERAL_REDIS_URL: "redis://ephemeral:6379",
      REDIS_URL: "redis://legacy:6379",
    }

    expect(durableRedisConnectionOptions(environment).url).toBe(
      "redis://durable:6379"
    )
    expect(ephemeralRedisConnectionOptions(environment).url).toBe(
      "redis://ephemeral:6379"
    )
  })

  it("uses the legacy URL for both workloads during a one-Redis rollout", () => {
    const environment = { REDIS_URL: "redis://legacy:6379" }

    expect(durableRedisConnectionOptions(environment).url).toBe(
      "redis://legacy:6379"
    )
    expect(ephemeralRedisConnectionOptions(environment).url).toBe(
      "redis://legacy:6379"
    )
  })

  it("rejects a legacy production fallback unless the temporary migration flag is set", () => {
    const environment = {
      NODE_ENV: "production",
      REDIS_URL: "redis://legacy:6379",
    }

    expect(() => durableRedisConnectionOptions(environment)).toThrow(
      RedisConfigurationError
    )

    expect(
      durableRedisConnectionOptions({
        ...environment,
        ARCTIC_RSS_ALLOW_LEGACY_REDIS_URL_FOR_MIGRATION: "true",
      }).url
    ).toBe("redis://legacy:6379")
  })

  it("keeps the local default when no Redis URL is configured", () => {
    expect(durableRedisConnectionOptions({}).url).toBe("redis://localhost:6379")
    expect(ephemeralRedisConnectionOptions({}).url).toBe("redis://localhost:6379")
  })
})

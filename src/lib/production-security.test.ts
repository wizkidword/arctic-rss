import { describe, expect, it } from "vitest"

import {
  assertSecureProductionConfiguration,
  UnsafeProductionConfigurationError,
} from "./production-security"

describe("production security configuration", () => {
  const secureProductionEnvironment = {
    APP_ORIGIN: "https://arcticrss.com",
    AUTH_URL: "https://arcticrss.com",
    AUTH_SECRET: "production-auth-secret-that-is-at-least-32-bytes",
    DATABASE_URL:
      "postgresql://arctic_runtime:runtime-password@postgres:5432/arctic_rss?schema=public",
    MIGRATE_DATABASE_URL:
      "postgresql://arctic_migrate:migration-password@postgres:5432/arctic_rss?schema=public",
    NODE_ENV: "production",
    POSTGRES_PASSWORD: "postgres-container-password",
    REDIS_PASSWORD: "redis-container-password",
    REDIS_URL: "redis://:redis-container-password@redis:6379",
    REQUIRE_EMAIL_VERIFICATION: "true",
  } as const

  it("rejects disabled email verification in production", () => {
    expect(() =>
      assertSecureProductionConfiguration({
        NODE_ENV: "production",
        REQUIRE_EMAIL_VERIFICATION: "false",
      })
    ).toThrow(UnsafeProductionConfigurationError)
  })

  it("rejects the retired admin email allowlist in production", () => {
    expect(() =>
      assertSecureProductionConfiguration({
        ADMIN_EMAILS: "owner@example.com",
        NODE_ENV: "production",
        REQUIRE_EMAIL_VERIFICATION: "true",
      })
    ).toThrow(UnsafeProductionConfigurationError)
  })

  it("accepts the secure production configuration", () => {
    expect(() =>
      assertSecureProductionConfiguration(secureProductionEnvironment)
    ).not.toThrow()
  })

  it("requires a canonical HTTPS origin and matching Auth.js URL in production", () => {
    expect(() =>
      assertSecureProductionConfiguration({
        AUTH_URL: "https://arcticrss.com",
        NODE_ENV: "production",
        REQUIRE_EMAIL_VERIFICATION: "true",
      })
    ).toThrow(UnsafeProductionConfigurationError)

    expect(() =>
      assertSecureProductionConfiguration({
        ...secureProductionEnvironment,
        AUTH_URL: "https://attacker.example",
      })
    ).toThrow("AUTH_URL must match APP_ORIGIN")

    expect(() =>
      assertSecureProductionConfiguration({
        ...secureProductionEnvironment,
        APP_ORIGIN: "http://arcticrss.com",
        AUTH_URL: "http://arcticrss.com",
      })
    ).toThrow("APP_ORIGIN must use HTTPS")
  })

  it("rejects a required but incomplete Turnstile configuration", () => {
    expect(() =>
      assertSecureProductionConfiguration({
        ...secureProductionEnvironment,
        TURNSTILE_REQUIRED: "true",
      })
    ).toThrow("TURNSTILE_REQUIRED requires TURNSTILE_SECRET_KEY")
  })

  it("rejects placeholders and known insecure defaults for required secrets", () => {
    expect(() =>
      assertSecureProductionConfiguration({
        ...secureProductionEnvironment,
        POSTGRES_PASSWORD: "postgres",
      })
    ).toThrow("POSTGRES_PASSWORD must not use a placeholder or known insecure default")

    expect(() =>
      assertSecureProductionConfiguration({
        ...secureProductionEnvironment,
        AUTH_SECRET: "CHANGE_ME_GENERATE_A_32_BYTE_SECRET",
      })
    ).toThrow("AUTH_SECRET must not use a placeholder or known insecure default")

    expect(() =>
      assertSecureProductionConfiguration({
        ...secureProductionEnvironment,
        REDIS_URL: "redis://:CHANGE_ME_REDIS_PASSWORD@redis:6379",
      })
    ).toThrow("REDIS_URL must not use a placeholder or known insecure default")
  })

  it("requires password-protected runtime services and compatible database URLs", () => {
    expect(() =>
      assertSecureProductionConfiguration({
        ...secureProductionEnvironment,
        REDIS_URL: "redis://redis:6379",
      })
    ).toThrow("REDIS_URL must include a password")

    expect(() =>
      assertSecureProductionConfiguration({
        ...secureProductionEnvironment,
        MIGRATE_DATABASE_URL:
          "postgresql://arctic_migrate:migration-password@postgres:5432/other_database?schema=public",
      })
    ).toThrow("DATABASE_URL and MIGRATE_DATABASE_URL must target the same database and schema")

    expect(() =>
      assertSecureProductionConfiguration({
        ...secureProductionEnvironment,
        REDIS_PASSWORD: "a-different-redis-password",
      })
    ).toThrow("REDIS_URL password must match REDIS_PASSWORD")
  })

  it("validates each workload-specific Redis URL when configured", () => {
    expect(() =>
      assertSecureProductionConfiguration({
        ...secureProductionEnvironment,
        DURABLE_REDIS_URL: "redis://:redis-container-password@redis:6379",
        EPHEMERAL_REDIS_URL:
          "redis://:different-ephemeral-password@redis-ephemeral:6379",
      })
    ).toThrow("EPHEMERAL_REDIS_URL password must match REDIS_PASSWORD")

    expect(() =>
      assertSecureProductionConfiguration({
        ...secureProductionEnvironment,
        DURABLE_REDIS_URL: "redis://:redis-container-password@redis:6379",
        EPHEMERAL_REDIS_URL:
          "redis://:redis-container-password@redis-ephemeral:6379",
      })
    ).not.toThrow()
  })

  it("allows a non-production test configuration", () => {
    expect(() =>
      assertSecureProductionConfiguration({
        NODE_ENV: "test",
        REQUIRE_EMAIL_VERIFICATION: "false",
      })
    ).not.toThrow()
  })
})

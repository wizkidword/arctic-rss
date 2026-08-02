import { describe, expect, it } from "vitest"

import {
  assertSecureProductionConfiguration,
  UnsafeProductionConfigurationError,
} from "./production-security"

const webProductionEnvironment = {
  APP_ORIGIN: "https://arcticrss.com",
  AUTH_SECRET: "production-auth-secret-that-is-at-least-32-bytes",
  AUTH_URL: "https://arcticrss.com",
  DATABASE_URL:
    "postgresql://arctic_runtime:runtime-password@postgres:5432/arctic_rss?schema=public",
  DURABLE_REDIS_URL: "redis://:durable-redis-password@redis:6379",
  EPHEMERAL_REDIS_URL:
    "redis://:ephemeral-redis-password@redis-ephemeral:6379",
  NODE_ENV: "production",
  REQUIRE_EMAIL_VERIFICATION: "true",
} as const

describe("production security configuration", () => {
  it("accepts the web environment without migration or infrastructure secrets", () => {
    expect(() =>
      assertSecureProductionConfiguration(webProductionEnvironment, "web")
    ).not.toThrow()
  })

  it("rejects disabled email verification and a retired admin allowlist for web", () => {
    expect(() =>
      assertSecureProductionConfiguration(
        { ...webProductionEnvironment, REQUIRE_EMAIL_VERIFICATION: "false" },
        "web"
      )
    ).toThrow(UnsafeProductionConfigurationError)

    expect(() =>
      assertSecureProductionConfiguration(
        { ...webProductionEnvironment, ADMIN_EMAILS: "owner@example.com" },
        "web"
      )
    ).toThrow(UnsafeProductionConfigurationError)
  })

  it("requires a canonical HTTPS origin and matching Auth.js URL for web", () => {
    expect(() =>
      assertSecureProductionConfiguration(
        { ...webProductionEnvironment, AUTH_URL: "https://attacker.example" },
        "web"
      )
    ).toThrow("AUTH_URL must match APP_ORIGIN")

    expect(() =>
      assertSecureProductionConfiguration(
        {
          ...webProductionEnvironment,
          APP_ORIGIN: "http://arcticrss.com",
          AUTH_URL: "http://arcticrss.com",
        },
        "web"
      )
    ).toThrow("APP_ORIGIN must use HTTPS")
  })

  it("rejects migration, database-container, and tunnel secrets in web", () => {
    for (const variable of [
      "CLOUDFLARE_TUNNEL_TOKEN",
      "MIGRATE_DATABASE_URL",
      "POSTGRES_PASSWORD",
      "REDIS_PASSWORD",
    ]) {
      expect(() =>
        assertSecureProductionConfiguration(
          { ...webProductionEnvironment, [variable]: "unexpected-secret" },
          "web"
        )
      ).toThrow(`${variable} must not be present for the web service.`)
    }
  })

  it("rejects placeholders and incomplete Turnstile configuration for web", () => {
    expect(() =>
      assertSecureProductionConfiguration(
        { ...webProductionEnvironment, AUTH_SECRET: "CHANGE_ME_AUTH_SECRET" },
        "web"
      )
    ).toThrow("AUTH_SECRET must not use a placeholder or known insecure default")

    expect(() =>
      assertSecureProductionConfiguration(
        { ...webProductionEnvironment, TURNSTILE_REQUIRED: "true" },
        "web"
      )
    ).toThrow("TURNSTILE_REQUIRED requires TURNSTILE_SECRET_KEY")
  })

  it("limits an ingestion worker to its database and durable queue configuration", () => {
    const environment = {
      DATABASE_URL: webProductionEnvironment.DATABASE_URL,
      DURABLE_REDIS_URL: webProductionEnvironment.DURABLE_REDIS_URL,
      NODE_ENV: "production",
    }

    expect(() =>
      assertSecureProductionConfiguration(environment, "worker-ingestion")
    ).not.toThrow()

    expect(() =>
      assertSecureProductionConfiguration(
        { ...environment, AUTH_GOOGLE_SECRET: "unexpected-secret" },
        "worker-ingestion"
      )
    ).toThrow("AUTH_GOOGLE_SECRET must not be present for the worker-ingestion service.")
  })

  it("requires ephemeral Redis only for worker roles that publish chat events", () => {
    const environment = {
      DATABASE_URL: webProductionEnvironment.DATABASE_URL,
      DURABLE_REDIS_URL: webProductionEnvironment.DURABLE_REDIS_URL,
      NODE_ENV: "production",
    }

    expect(() =>
      assertSecureProductionConfiguration(environment, "worker-chat-events")
    ).toThrow("EPHEMERAL_REDIS_URL or REDIS_URL must be configured")

    expect(() =>
      assertSecureProductionConfiguration(
        {
          ...environment,
          EPHEMERAL_REDIS_URL: webProductionEnvironment.EPHEMERAL_REDIS_URL,
        },
        "worker-chat-events"
      )
    ).not.toThrow()
  })

  it("isolates chat gateway credentials from web, mail, AI, and tunnel secrets", () => {
    const environment = {
      APP_ORIGIN: "https://arcticrss.com",
      ARCTIC_IRC_TOKEN_SECRET: "chat-token-secret-that-is-at-least-32-bytes",
      DATABASE_URL: webProductionEnvironment.DATABASE_URL,
      EPHEMERAL_REDIS_URL: webProductionEnvironment.EPHEMERAL_REDIS_URL,
      NODE_ENV: "production",
    }

    expect(() =>
      assertSecureProductionConfiguration(environment, "chat-gateway")
    ).not.toThrow()

    expect(() =>
      assertSecureProductionConfiguration(
        { ...environment, OPENAI_API_KEY: "unexpected-secret" },
        "chat-gateway"
      )
    ).toThrow("OPENAI_API_KEY must not be present for the chat-gateway service.")
  })

  it("rejects unknown roles and permits non-production test environments", () => {
    expect(() =>
      assertSecureProductionConfiguration(webProductionEnvironment, "unknown-role")
    ).toThrow("ARCTIC_RSS_SERVICE_ROLE must be one of")

    expect(() =>
      assertSecureProductionConfiguration(
        { NODE_ENV: "test", REQUIRE_EMAIL_VERIFICATION: "false" },
        "unknown-role"
      )
    ).not.toThrow()
  })

  it("uses web validation by default even when a role environment variable is misconfigured", () => {
    expect(() =>
      assertSecureProductionConfiguration({
        ...webProductionEnvironment,
        ARCTIC_RSS_SERVICE_ROLE: "worker-ingestion",
        MIGRATE_DATABASE_URL: "postgresql://unexpected-migration-url",
      })
    ).toThrow("MIGRATE_DATABASE_URL must not be present for the web service.")
  })
})

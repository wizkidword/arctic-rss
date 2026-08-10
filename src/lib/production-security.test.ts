import { describe, expect, it } from "vitest"

import {
  assertSecureProductionConfiguration,
  PRODUCTION_SERVICE_ROLES,
  UnsafeProductionConfigurationError,
} from "./production-security"
import {
  ALL_MANAGED_ENVIRONMENT_VARIABLES,
  getRuntimeAllowedServiceRoleEnvironment,
} from "./service-role-environment"

const webProductionEnvironment = {
  ARCTIC_RSS_TOPOLOGY: "all-in-one",
  APP_ORIGIN: "https://arcticrss.com",
  AUTH_SECRET: "production-auth-secret-that-is-at-least-32-bytes",
  AUTH_URL: "https://arcticrss.com",
  DATABASE_URL:
    "postgresql://arctic_runtime:runtime-password@postgres:5432/arctic_rss?schema=public",
  ...databasePoolEnvironment("web"),
  DURABLE_REDIS_URL: "redis://arctic_durable:durable-redis-password@redis:6379",
  EPHEMERAL_REDIS_URL:
    "redis://arctic_ephemeral:ephemeral-redis-password@redis-ephemeral:6379",
  NODE_ENV: "production",
  REQUIRE_EMAIL_VERIFICATION: "true",
} as const

describe("production security configuration", () => {
  it("accepts the web environment without migration or infrastructure secrets", () => {
    expect(() =>
      assertSecureProductionConfiguration(webProductionEnvironment, "web")
    ).not.toThrow()
  })

  it("requires the manifest-selected topology for production web", () => {
    const environment = {
      ...webProductionEnvironment,
      ARCTIC_RSS_TOPOLOGY: undefined,
    }

    expect(() =>
      assertSecureProductionConfiguration(environment, "web")
    ).toThrow("ARCTIC_RSS_TOPOLOGY must be configured in production.")
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
      "DURABLE_REDIS_PASSWORD",
      "EPHEMERAL_REDIS_PASSWORD",
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

  it("requires distinct workload-specific Redis endpoints for production web", () => {
    expect(() =>
      assertSecureProductionConfiguration(
        { ...webProductionEnvironment, DURABLE_REDIS_URL: "" },
        "web"
      )
    ).toThrow("DURABLE_REDIS_URL must be configured in production.")

    expect(() =>
      assertSecureProductionConfiguration(
        { ...webProductionEnvironment, EPHEMERAL_REDIS_URL: "" },
        "web"
      )
    ).toThrow("EPHEMERAL_REDIS_URL must be configured in production.")

    expect(() =>
      assertSecureProductionConfiguration(
        {
          ...webProductionEnvironment,
          DURABLE_REDIS_URL: "redis://arctic_durable:durable-redis-password@REDIS:6379/0",
          EPHEMERAL_REDIS_URL: "redis://arctic_ephemeral:ephemeral-redis-password@redis/",
        },
        "web"
      )
    ).toThrow("must not target the same Redis endpoint")

    expect(() =>
      assertSecureProductionConfiguration(
        {
          ...webProductionEnvironment,
          DURABLE_REDIS_URL: "redis://arctic_durable:durable-redis-password@redis:6379/0",
          EPHEMERAL_REDIS_URL: "rediss://arctic_ephemeral:ephemeral-redis-password@redis:6379/0",
        },
        "web"
      )
    ).not.toThrow()

    expect(() =>
      assertSecureProductionConfiguration(
        {
          ...webProductionEnvironment,
          DURABLE_REDIS_URL: "redis://arctic_durable:durable-redis-password@redis:6379/0",
          EPHEMERAL_REDIS_URL: "redis://arctic_ephemeral:ephemeral-redis-password@redis:6379/1",
        },
        "web"
      )
    ).not.toThrow()
  })

  it("requires distinct ACL usernames and passwords for direct workload URLs", () => {
    expect(() =>
      assertSecureProductionConfiguration(
        {
          ...webProductionEnvironment,
          EPHEMERAL_REDIS_URL:
            "redis://arctic_durable:ephemeral-redis-password@redis-ephemeral:6379/0",
        },
        "web"
      )
    ).toThrow("must use distinct Redis ACL usernames")

    expect(() =>
      assertSecureProductionConfiguration(
        {
          ...webProductionEnvironment,
          EPHEMERAL_REDIS_URL:
            "redis://arctic_ephemeral:durable-redis-password@redis-ephemeral:6379/0",
        },
        "web"
      )
    ).toThrow("must use distinct Redis passwords")

    expect(() =>
      assertSecureProductionConfiguration(
        {
          ...webProductionEnvironment,
          DURABLE_REDIS_URL: "redis://:durable-redis-password@redis:6379/0",
        },
        "web"
      )
    ).toThrow("DURABLE_REDIS_URL must include a username and password")
  })

  it("permits legacy Redis only with the explicit temporary migration flag", () => {
    const legacyEnvironment = {
      ...webProductionEnvironment,
      DURABLE_REDIS_URL: "",
      EPHEMERAL_REDIS_URL: "",
      REDIS_URL: "redis://:legacy-redis-password@redis:6379/0",
    }

    expect(() =>
      assertSecureProductionConfiguration(legacyEnvironment, "web")
    ).toThrow("REDIS_URL requires ARCTIC_RSS_ALLOW_LEGACY_REDIS_URL_FOR_MIGRATION=true")

    expect(() =>
      assertSecureProductionConfiguration(
        {
          ...legacyEnvironment,
          ARCTIC_RSS_ALLOW_LEGACY_REDIS_URL_FOR_MIGRATION: "true",
        },
        "web"
      )
    ).not.toThrow()
  })

  it("limits an ingestion worker to its database and durable queue configuration", () => {
    const environment = {
      DATABASE_URL: webProductionEnvironment.DATABASE_URL,
      ...databasePoolEnvironment("worker-ingestion"),
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
      ...databasePoolEnvironment("worker-chat-events"),
      DURABLE_REDIS_URL: webProductionEnvironment.DURABLE_REDIS_URL,
      NODE_ENV: "production",
    }

    expect(() =>
      assertSecureProductionConfiguration(environment, "worker-chat-events")
    ).toThrow("EPHEMERAL_REDIS_URL must be configured in production")

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

  it("requires an explicit topology and both Redis workloads for the health worker", () => {
    const environment = {
      DATABASE_URL: webProductionEnvironment.DATABASE_URL,
      ...databasePoolEnvironment("worker-health"),
      DURABLE_REDIS_URL: webProductionEnvironment.DURABLE_REDIS_URL,
      EPHEMERAL_REDIS_URL: webProductionEnvironment.EPHEMERAL_REDIS_URL,
      NODE_ENV: "production",
    }

    expect(() =>
      assertSecureProductionConfiguration(environment, "worker-health")
    ).toThrow("ARCTIC_RSS_TOPOLOGY must be configured in production.")

    expect(() =>
      assertSecureProductionConfiguration(
        { ...environment, ARCTIC_RSS_TOPOLOGY: "split" },
        "worker-health"
      )
    ).not.toThrow()

    expect(() =>
      assertSecureProductionConfiguration(
        {
          ...environment,
          ARCTIC_RSS_TOPOLOGY: "split",
          EPHEMERAL_REDIS_URL: environment.DURABLE_REDIS_URL,
        },
        "worker-health"
      )
    ).toThrow("must not target the same Redis endpoint")
  })

  it("rejects a shared Redis endpoint from the all-in-one worker", () => {
    const environment = {
      DATABASE_URL: webProductionEnvironment.DATABASE_URL,
      ...databasePoolEnvironment("worker-all"),
      DURABLE_REDIS_URL: "redis://arctic_durable:durable-redis-password@redis:6379/0",
      EPHEMERAL_REDIS_URL: "redis://arctic_ephemeral:ephemeral-redis-password@redis/",
      NODE_ENV: "production",
    }

    expect(() =>
      assertSecureProductionConfiguration(environment, "worker-all")
    ).toThrow("must not target the same Redis endpoint")
  })

  it("isolates chat gateway credentials from web, mail, AI, and tunnel secrets", () => {
    const environment = {
      APP_ORIGIN: "https://arcticrss.com",
      ARCTIC_IRC_TOKEN_SECRET: "chat-token-secret-that-is-at-least-32-bytes",
      CHAT_DATABASE_URL: "postgresql://arctic_chat:chat-runtime-password@postgres:5432/arctic_rss?schema=public",
      ...databasePoolEnvironment("chat-gateway"),
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

    expect(() =>
      assertSecureProductionConfiguration(
        { ...environment, DATABASE_URL: webProductionEnvironment.DATABASE_URL },
        "chat-gateway"
      )
    ).toThrow("DATABASE_URL must not be present for the chat-gateway service.")
  })

  it.each(PRODUCTION_SERVICE_ROLES)(
    "fails closed when a managed infrastructure secret is injected into %s",
    (role) => {
      expect(() =>
        assertSecureProductionConfiguration(
          { ...validProductionEnvironmentForRole(role), TUNNEL_TOKEN: "injected" },
          role
        )
      ).toThrow(`TUNNEL_TOKEN must not be present for the ${role} service.`)
    }
  )

  it.each(PRODUCTION_SERVICE_ROLES)(
    "rejects every managed variable and compatibility alias not assigned to %s",
    (role) => {
      const allowed = new Set(getRuntimeAllowedServiceRoleEnvironment(role))

      for (const variable of ALL_MANAGED_ENVIRONMENT_VARIABLES) {
        if (allowed.has(variable)) {
          continue
        }

        expect(() =>
          assertSecureProductionConfiguration(
            { ...validProductionEnvironmentForRole(role), [variable]: "injected" },
            role
          )
        ).toThrow(`${variable} must not be present for the ${role} service.`)
      }
    }
  )

  it("does not reject ordinary process variables while rejecting registered aliases", () => {
    expect(() =>
      assertSecureProductionConfiguration(
        {
          ...webProductionEnvironment,
          HOME: "/home/nextjs",
          NODE_VERSION: "24.17.0",
          PATH: "/usr/local/bin:/usr/bin",
        },
        "web"
      )
    ).not.toThrow()

    expect(() =>
      assertSecureProductionConfiguration(
        { ...webProductionEnvironment, CLOUDFLARE_TUNNEL_TOKEN: "injected" },
        "web"
      )
    ).toThrow("CLOUDFLARE_TUNNEL_TOKEN must not be present for the web service.")
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

  it("requires distinct Redis ACL credentials for the dual-workload chat-events worker", () => {
    const environment = validProductionEnvironmentForRole("worker-chat-events")
    const durableRedisUrl = webProductionEnvironment.DURABLE_REDIS_URL

    expect(() =>
      assertSecureProductionConfiguration(
        {
          ...environment,
          EPHEMERAL_REDIS_URL: durableRedisUrl,
        },
        "worker-chat-events"
      )
    ).toThrow("must not target the same Redis endpoint")
  })

  it.each(["web", "worker-all", "worker-chat-events", "worker-health"] as const)(
    "requires distinct Redis endpoints, usernames, and passwords for %s",
    (role) => {
      const environment = validProductionEnvironmentForRole(role)
      const durableRedisUrl = webProductionEnvironment.DURABLE_REDIS_URL

      expect(() =>
        assertSecureProductionConfiguration(
          { ...environment, EPHEMERAL_REDIS_URL: durableRedisUrl },
          role
        )
      ).toThrow("must not target the same Redis endpoint")

      expect(() =>
        assertSecureProductionConfiguration(
          {
            ...environment,
            EPHEMERAL_REDIS_URL:
              "redis://arctic_durable:ephemeral-redis-password@redis-ephemeral:6379/0",
          },
          role
        )
      ).toThrow("must use distinct Redis ACL usernames")

      expect(() =>
        assertSecureProductionConfiguration(
          {
            ...environment,
            EPHEMERAL_REDIS_URL:
              "redis://arctic_ephemeral:durable-redis-password@redis-ephemeral:6379/0",
          },
          role
        )
      ).toThrow("must use distinct Redis passwords")
    }
  )
})

function validProductionEnvironmentForRole(
  role: (typeof PRODUCTION_SERVICE_ROLES)[number]
) {
  if (role === "web") {
    return webProductionEnvironment
  }

  if (role === "chat-gateway") {
    return {
      APP_ORIGIN: "https://arcticrss.com",
      ARCTIC_IRC_TOKEN_SECRET: "chat-token-secret-that-is-at-least-32-bytes",
      CHAT_DATABASE_URL: "postgresql://arctic_chat:chat-runtime-password@postgres:5432/arctic_rss?schema=public",
      ...databasePoolEnvironment("chat-gateway"),
      EPHEMERAL_REDIS_URL: webProductionEnvironment.EPHEMERAL_REDIS_URL,
      NODE_ENV: "production",
    }
  }

  return {
    DATABASE_URL: webProductionEnvironment.DATABASE_URL,
    ...databasePoolEnvironment(role),
    DURABLE_REDIS_URL: webProductionEnvironment.DURABLE_REDIS_URL,
    ...(role === "worker-chat-events" || role === "worker-health"
      ? { EPHEMERAL_REDIS_URL: webProductionEnvironment.EPHEMERAL_REDIS_URL }
      : {}),
    ...(role === "worker-health" ? { ARCTIC_RSS_TOPOLOGY: "all-in-one" } : {}),
    NODE_ENV: "production",
  }
}

function databasePoolEnvironment(role: (typeof PRODUCTION_SERVICE_ROLES)[number]) {
  const settings = {
    "chat-gateway": ["arctic-rss-chat-gateway", "4"],
    web: ["arctic-rss-web", "6"],
    "worker-ai-mail": ["arctic-rss-worker-ai-mail", "3"],
    "worker-all": ["arctic-rss-worker-all", "6"],
    "worker-chat-events": ["arctic-rss-worker-chat-events", "2"],
    "worker-health": ["arctic-rss-worker-health", "2"],
    "worker-imports": ["arctic-rss-worker-imports", "2"],
    "worker-ingestion": ["arctic-rss-worker-ingestion", "4"],
    "worker-maintenance": ["arctic-rss-worker-maintenance", "2"],
  } as const
  const [applicationName, poolMax] = settings[role]

  return {
    DB_APPLICATION_NAME: applicationName,
    DB_CONNECTION_TIMEOUT_MS: "3000",
    DB_IDLE_TIMEOUT_MS: "10000",
    DB_POOL_MAX: poolMax,
    DB_STATEMENT_TIMEOUT_MS: "15000",
  }
}

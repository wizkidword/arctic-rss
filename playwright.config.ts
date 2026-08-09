import { defineConfig } from "playwright/test"

import { installFixtureNetworkHooks } from "./scripts/e2e/feed-fixture-network.cjs"

const usesProductionServer = process.env.E2E_PRODUCTION === "1"
const usesAuthenticatedFixtures =
  process.env.ARCTIC_RSS_E2E_AUTHENTICATED === "1"
const e2ePort = Number.parseInt(
  process.env.E2E_PORT ?? (usesAuthenticatedFixtures ? "3300" : "3000"),
  10
)
const e2eDatabaseUrl =
  process.env.E2E_DATABASE_URL ??
  "postgresql://csp_e2e:csp-e2e-database-password@localhost:55432/arctic_rss?schema=public"
const e2eDurableRedisUrl =
  process.env.E2E_DURABLE_REDIS_URL ??
  "redis://csp_e2e_durable:csp-e2e-durable-redis-password@localhost:56379"
const e2eEphemeralRedisUrl =
  process.env.E2E_EPHEMERAL_REDIS_URL ??
  "redis://csp_e2e_ephemeral:csp-e2e-ephemeral-redis-password@localhost:56380"
const productionServerEnvironment = {
  ARCTIC_RSS_TOPOLOGY: "all-in-one",
  ARCTIC_RSS_SERVICE_ROLE: "web",
  APP_ORIGIN: `https://localhost:${e2ePort}`,
  AUTH_SECRET: "csp-e2e-auth-secret-with-at-least-thirty-two-bytes",
  AUTH_URL: `https://localhost:${e2ePort}`,
  ARCTIC_IRC_ENABLED: "true",
  ARCTIC_IRC_TOKEN_SECRET: "csp-e2e-chat-token-secret-with-at-least-thirty-two-bytes",
  DATABASE_URL: e2eDatabaseUrl,
  DB_APPLICATION_NAME: "arctic-rss-web",
  DB_CONNECTION_TIMEOUT_MS: "3000",
  DB_IDLE_TIMEOUT_MS: "10000",
  DB_POOL_MAX: "6",
  DB_STATEMENT_TIMEOUT_MS: "15000",
  DURABLE_REDIS_URL: e2eDurableRedisUrl,
  EPHEMERAL_REDIS_URL: e2eEphemeralRedisUrl,
  REQUIRE_EMAIL_VERIFICATION: "true",
  PORT: String(e2ePort),
}

const authenticatedFixtureEnvironment: Record<string, string> = usesAuthenticatedFixtures
  ? {
      ARCTIC_RSS_E2E_FIXTURES: "1",
      ARCTIC_RSS_E2E_FEED_ORIGIN:
        process.env.ARCTIC_RSS_E2E_FEED_ORIGIN ?? "http://127.0.0.1:4311",
      ARCTIC_RSS_E2E_FEED_HOST:
        process.env.ARCTIC_RSS_E2E_FEED_HOST ??
        "feeds.e2e.arcticrss.test",
    }
  : {}

const fixtureControlEnvironment: Record<string, string> = usesAuthenticatedFixtures
  ? {
      ...authenticatedFixtureEnvironment,
      DATABASE_URL: e2eDatabaseUrl,
    }
  : {}

const runtimeEnvironment: Record<string, string> = {
  ...productionServerEnvironment,
  ...authenticatedFixtureEnvironment,
}
const productionServerCommand =
  process.env.ARCTIC_RSS_E2E_PRODUCTION_SERVER_COMMAND ??
  "npm run test:e2e:production:server"

if (usesAuthenticatedFixtures) {
  for (const [key, value] of Object.entries(fixtureControlEnvironment)) {
    process.env[key] ??= value
  }

  installFixtureNetworkHooks()
}

export default defineConfig({
  fullyParallel: true,
  reporter: process.env.CI ? "github" : "list",
  retries: process.env.CI ? 1 : 0,
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${e2ePort}`,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  globalSetup: "./e2e/global-setup.ts",
  webServer: {
    command: usesProductionServer
      ? productionServerCommand
      : `npm run dev -- --hostname 127.0.0.1 --port ${e2ePort}`,
    env: usesProductionServer ? runtimeEnvironment : {},
    reuseExistingServer: !process.env.CI && !usesAuthenticatedFixtures,
    timeout: 120_000,
    url: `http://localhost:${e2ePort}`,
  },
});

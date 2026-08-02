import { defineConfig } from "playwright/test";

const usesProductionServer = process.env.E2E_PRODUCTION === "1";
const productionServerEnvironment = {
  ARCTIC_RSS_TOPOLOGY: "all-in-one",
  APP_ORIGIN: "https://localhost:3000",
  AUTH_SECRET: "csp-e2e-auth-secret-with-at-least-thirty-two-bytes",
  AUTH_URL: "https://localhost:3000",
  DATABASE_URL:
    "postgresql://csp_e2e:csp-e2e-database-password@localhost:5432/arctic_rss?schema=public",
  DURABLE_REDIS_URL: "redis://:csp-e2e-redis-password@localhost:6379",
  EPHEMERAL_REDIS_URL: "redis://:csp-e2e-redis-password@localhost:6380",
  REQUIRE_EMAIL_VERIFICATION: "true",
};

export default defineConfig({
  fullyParallel: true,
  reporter: process.env.CI ? "github" : "list",
  retries: process.env.CI ? 1 : 0,
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3000",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: usesProductionServer
      ? "npm run test:e2e:production:server"
      : "npm run dev -- --hostname 127.0.0.1 --port 3000",
    env: usesProductionServer ? productionServerEnvironment : {},
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: "http://localhost:3000",
  },
});

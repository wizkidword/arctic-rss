import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("Cloudflare Tunnel Compose configuration", () => {
  it("passes the tunnel token through Cloudflared's supported environment variable", async () => {
    const compose = await readFile("docker-compose.yml", "utf8");

    expect(compose).toContain("TUNNEL_TOKEN: ${CLOUDFLARE_TUNNEL_TOKEN}");
    expect(compose).toContain(
      'command: ["tunnel", "--no-autoupdate", "--metrics", "127.0.0.1:20241", "run"]',
    );
    expect(compose).not.toContain(
      'command: ["tunnel", "--no-autoupdate", "run", "--token"',
    );
  });

  it("runs migrations and the worker from the minimized production image", async () => {
    const compose = await readFile("docker-compose.yml", "utf8");

    expect(compose).toContain("target: migrate");
    expect(compose).toContain(
      'command: ["./node_modules/.bin/prisma", "migrate", "deploy"]',
    );
    expect(compose).toContain(
      'command: ["node", "worker.mjs"]',
    );
  });

  it("pins the reviewed PostgreSQL and Redis base images", async () => {
    const compose = await readFile("docker-compose.yml", "utf8");

    expect(compose).toContain("image: postgres:17.10-alpine3.23");
    expect(compose).toContain("image: redis:7.4.9-alpine3.21");
  });

  it("refuses to interpolate production data-service credentials from unsafe defaults", async () => {
    const compose = await readFile("docker-compose.yml", "utf8");

    expect(compose).toContain(
      "POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}",
    );
    expect(compose).toContain(
      "REDIS_PASSWORD: ${REDIS_PASSWORD:?REDIS_PASSWORD is required}",
    );
    expect(compose).toContain(
      "DATABASE_URL: ${MIGRATE_DATABASE_URL:?MIGRATE_DATABASE_URL is required}",
    );
    expect(compose).not.toContain("POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}");
  });

  it("keeps the chat gateway internal, opt-in, and readiness-checked", async () => {
    const compose = await readFile("docker-compose.yml", "utf8");
    const gateway = compose.split("  chat-gateway:")[1].split("  cloudflared:")[0];

    expect(gateway).toContain("target: chat-gateway");
    expect(gateway).toContain('profiles: ["chat"]');
    expect(gateway).not.toMatch(/^\s+ports:/m);
    expect(gateway).toContain("http://127.0.0.1:3001/ready");
    expect(gateway).not.toContain("http://127.0.0.1:3001/live");
    expect(gateway).toContain("restart: unless-stopped");
  });
});

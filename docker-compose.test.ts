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

  it("allows a release to select immutable application image tags", async () => {
    const compose = await readFile("docker-compose.yml", "utf8");

    expect(compose).toContain('image: ${MIGRATE_IMAGE:-arctic-rss-migrate}');
    expect(compose).toContain('image: ${WEB_IMAGE:-arctic-rss-web}');
    expect(compose).toContain('image: ${WORKER_IMAGE:-arctic-rss-worker}');
    expect(compose).toContain(
      'image: ${CHAT_GATEWAY_IMAGE:-arctic-rss-chat-gateway}',
    );
    expect(compose).toContain(
      'image: ${EDGE_PROXY_IMAGE:-arctic-rss-edge-proxy}',
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
    const gateway = compose.split("  chat-gateway:")[1].split("  edge-proxy:")[0];

    expect(gateway).toContain("target: chat-gateway");
    expect(gateway).toContain('profiles: ["chat"]');
    expect(gateway).not.toMatch(/^\s+ports:/m);
    expect(gateway).toContain("http://127.0.0.1:3001/ready");
    expect(gateway).not.toContain("http://127.0.0.1:3001/live");
    expect(gateway).toContain("restart: unless-stopped");
  });

  it("routes only Socket.IO through the internal chat proxy", async () => {
    const [compose, config] = await Promise.all([
      readFile("docker-compose.yml", "utf8"),
      readFile("ops/nginx/chat-proxy.conf", "utf8"),
    ]);
    const proxy = compose.split("  edge-proxy:")[1].split("  cloudflared:")[0];

    expect(proxy).toContain('profiles: ["chat"]');
    expect(proxy).toContain("user: nginx");
    expect(proxy).toContain("127.0.0.1:${EDGE_PROXY_HOST_PORT:-8080}:8080");
    expect(proxy).not.toContain('"0.0.0.0:');
    expect(proxy).toContain("target: edge-proxy");
    expect(proxy).toContain("chat-gateway:");
    expect(config).toContain("location = /socket.io");
    expect(config).toContain("location ^~ /socket.io/");
    expect(config).toContain("proxy_pass http://chat-gateway:3001;");
    expect(config).toContain("proxy_pass http://web:3000;");
    expect(config).toContain("proxy_set_header CF-Connecting-IP $http_cf_connecting_ip;");
    expect(config).toContain("proxy_set_header Upgrade $http_upgrade;");
  });
});

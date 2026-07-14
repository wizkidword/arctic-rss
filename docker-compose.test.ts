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

  it("runs migrations and the worker from local project executables", async () => {
    const compose = await readFile("docker-compose.yml", "utf8");

    expect(compose).toContain("target: migrate");
    expect(compose).toContain(
      'command: ["./node_modules/.bin/prisma", "migrate", "deploy"]',
    );
    expect(compose).toContain(
      'command: ["./node_modules/.bin/tsx", "worker/index.ts"]',
    );
  });

  it("keeps the chat gateway internal and opt-in", async () => {
    const compose = await readFile("docker-compose.yml", "utf8");
    const gateway = compose.split("  chat-gateway:")[1].split("  cloudflared:")[0];

    expect(gateway).toContain("target: chat-gateway");
    expect(gateway).toContain('profiles: ["chat"]');
    expect(gateway).not.toMatch(/^\s+ports:/m);
    expect(gateway).toContain("http://127.0.0.1:3001/live");
  });
});

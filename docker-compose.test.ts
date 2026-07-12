import { readFile } from "node:fs/promises"

import { describe, expect, it } from "vitest"

describe("Cloudflare Tunnel Compose configuration", () => {
  it("passes the tunnel token through Cloudflared's supported environment variable", async () => {
    const compose = await readFile("docker-compose.yml", "utf8")

    expect(compose).toContain("TUNNEL_TOKEN: ${CLOUDFLARE_TUNNEL_TOKEN}")
    expect(compose).toContain(
      'command: ["tunnel", "--no-autoupdate", "run"]'
    )
    expect(compose).not.toContain(
      'command: ["tunnel", "--no-autoupdate", "run", "--token"'
    )
  })
})

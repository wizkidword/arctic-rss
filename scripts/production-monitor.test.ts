import { readFile } from "node:fs/promises"

import { describe, expect, it } from "vitest"

describe("production monitor", () => {
  it("checks readiness for an enabled chat gateway without exposing its port", async () => {
    const script = await readFile("scripts/production-monitor.sh", "utf8")

    expect(script).toContain("app-chat-gateway-1")
    expect(script).toContain("http://127.0.0.1:3001/ready")
    expect(script).toContain('failures+=("chat_gateway_ready")')
  })
})

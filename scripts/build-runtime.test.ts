import { readFile } from "node:fs/promises"

import { describe, expect, it } from "vitest"

describe("runtime bundle build", () => {
  it("compiles the worker and chat gateway into Node 24 ESM bundles", async () => {
    const script = await readFile("scripts/build-runtime.mjs", "utf8")

    expect(script).toContain('entryPoints: ["worker/index.ts"]')
    expect(script).toContain('entryPoints: ["services/chat-gateway/index.ts"]')
    expect(script).toContain('entryPoints: ["scripts/bootstrap-admin.ts"]')
    expect(script).toContain('entryPoints: ["scripts/repair-chat-read-markers.ts"]')
    expect(script).toContain('format: "esm"')
    expect(script).toContain('packages: "external"')
    expect(script).toContain('target: "node24"')
  })
})

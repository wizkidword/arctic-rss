import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

import { build } from "esbuild"
import { describe, expect, it } from "vitest"

describe("runtime bundle build", () => {
  it("compiles the worker and chat gateway into Node 24 ESM bundles", async () => {
    const script = await readFile("scripts/build-runtime.mjs", "utf8")

    expect(script).toContain('entryPoints: ["worker/index.ts"]')
    expect(script).toContain('entryPoints: ["services/chat-gateway/index.ts"]')
    expect(script).toContain('entryPoints: ["scripts/bootstrap-admin.ts"]')
    expect(script).toContain('entryPoints: ["scripts/repair-chat-read-markers.ts"]')
    expect(script).toContain('entryPoints: ["scripts/check-migration-risk.ts"]')
    expect(script).toContain('format: "esm"')
    expect(script).toContain('packages: "external"')
    expect(script).toContain('target: "node24"')
  })

  it("emits Node-compatible Next subpath imports for the chat gateway", async () => {
    const result = await build({
      bundle: true,
      entryPoints: ["services/chat-gateway/index.ts"],
      format: "esm",
      minifySyntax: true,
      minifyWhitespace: true,
      packages: "external",
      platform: "node",
      sourcemap: false,
      target: "node24",
      tsconfig: resolve("tsconfig.json"),
      write: false,
    })
    const output = result.outputFiles[0]?.text

    expect(output).toBeDefined()
    expect(output).not.toContain('from"next/headers"')
    expect(output).toContain('from"next/headers.js"')
  })
})

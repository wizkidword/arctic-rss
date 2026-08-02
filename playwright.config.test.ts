import { readFile } from "node:fs/promises"

import { describe, expect, it } from "vitest"

describe("production browser-smoke configuration", () => {
  it("does not inject migration or container secrets into the web server", async () => {
    const config = await readFile("playwright.config.ts", "utf8")

    expect(config).toContain("const productionServerEnvironment")
    expect(config).not.toContain("MIGRATE_DATABASE_URL:")
    expect(config).not.toContain("POSTGRES_PASSWORD:")
    expect(config).not.toContain("REDIS_PASSWORD:")
  })
})

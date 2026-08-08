import { readFile } from "node:fs/promises"

import { describe, expect, it } from "vitest"

describe("feed server-action workload placement", () => {
  it("authorizes and queues refreshes without importing or calling the ingestion worker", async () => {
    const source = await readFile("src/app/app/actions/feeds.ts", "utf8")

    expect(source).not.toMatch(/from ["']@\/lib\/feed-refresh["']/)
    expect(source).not.toMatch(/\brefreshFeed\s*\(/)
    expect(source).toContain("enqueueFeedRefresh")
  })
})

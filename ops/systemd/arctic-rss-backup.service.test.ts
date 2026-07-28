import { readFile } from "node:fs/promises"

import { describe, expect, it } from "vitest"

describe("Arctic RSS backup service", () => {
  it("routes failed backup runs to the failure-only alert unit", async () => {
    const unit = await readFile(new URL("./arctic-rss-backup.service", import.meta.url), "utf8")

    expect(unit).toContain("OnFailure=arctic-rss-backup-alert@%n.service")
  })
})

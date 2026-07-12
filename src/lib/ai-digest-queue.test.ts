import { describe, expect, it } from "vitest"

import { aiDigestJobId } from "./ai-digest-queue"

describe("AI digest queue", () => {
  it("creates BullMQ-compatible stable job IDs", () => {
    expect(aiDigestJobId("digest/1")).toBe("digest-digest-1")
    expect(aiDigestJobId("digest:2")).toBe("digest-digest-2")
  })
})

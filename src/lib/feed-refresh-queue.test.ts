import { describe, expect, it } from "vitest"

import { feedRefreshJobId } from "./feed-refresh-queue"

describe("feed refresh queue", () => {
  it("uses BullMQ-compatible job ids", () => {
    expect(feedRefreshJobId("feed_123:abc")).toBe("feed-feed_123-abc")
  })
})

import { describe, expect, it, vi } from "vitest"

import { CHAT_BLOCK_EVENT_CHANNEL, parseChatBlockEvent, publishChatBlockEvent } from "./block-events"

describe("chat block events", () => {
  it("publishes and parses versioned immutable-user block updates", async () => {
    const publisher = { publish: vi.fn().mockResolvedValue(1) }
    const event = { action: "blocked" as const, blockedUserId: "user-0002", blockerUserId: "user-0001" }

    await publishChatBlockEvent(event, { publisher })

    expect(publisher.publish).toHaveBeenCalledWith(CHAT_BLOCK_EVENT_CHANNEL, JSON.stringify(event))
    expect(parseChatBlockEvent(JSON.stringify(event))).toEqual(event)
    expect(parseChatBlockEvent(JSON.stringify({ ...event, action: "other" }))).toBeNull()
  })
})

import { describe, expect, it, vi } from "vitest"

import { clearChatPresence, markChatPresence } from "./presence"

describe("chat presence", () => {
  it("tracks each room connection with a bounded Redis TTL", async () => {
    const store = { del: vi.fn(), set: vi.fn().mockResolvedValue("OK") }
    const input = {
      connectionId: "socket-1",
      roomId: "room-1",
      userId: "user-1",
    }

    await markChatPresence(input, store)
    await clearChatPresence(input, store)

    expect(store.set).toHaveBeenCalledWith(
      "arctic-rss:chat:presence:v1:room-1:user-1:socket-1",
      "1",
      "EX",
      75
    )
    expect(store.del).toHaveBeenCalledWith(
      "arctic-rss:chat:presence:v1:room-1:user-1:socket-1"
    )
  })
})

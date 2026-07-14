import { describe, expect, it } from "vitest"

import {
  getSubscriptionInterestIds,
  rankChatDirectoryRooms,
} from "./room-directory"

describe("chat room directory", () => {
  it("derives interest matches from directory feed URLs without returning the URLs", () => {
    const interestIds = getSubscriptionInterestIds({
      directory: {
        categories: [{ countryCode: null, description: "", iconKey: "ai", id: "ai", label: "AI", sortOrder: 0 }],
        feeds: [{ categoryId: "ai", id: "example-ai", label: "Example AI", sortOrder: 0, source: "example", url: "https://example.test/ai.xml" }],
      },
      feedUrls: ["https://example.test/ai.xml", "https://private.example.test/not-in-directory.xml"],
    })

    expect([...interestIds]).toEqual(["ai"])
  })

  it("ranks matched public rooms first and supports public search", () => {
    const rooms = [
      { description: "Science news", id: "science", interestIds: ["science"], isOfficial: true, name: "Science", slug: "science", topicLine: null },
      { description: "AI news", id: "ai", interestIds: ["ai", "tech"], isOfficial: true, name: "AI", slug: "ai", topicLine: "Models" },
    ]

    expect(rankChatDirectoryRooms({ interestIds: new Set(["ai"]), rooms }).map((room) => room.slug)).toEqual(["ai", "science"])
    expect(rankChatDirectoryRooms({ rooms, search: "model" }).map((room) => room.slug)).toEqual(["ai"])
  })
})

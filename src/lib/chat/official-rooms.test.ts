import { describe, expect, it, vi } from "vitest"

import type { ChatRoomBootstrapStore } from "./official-rooms"
import { bootstrapOfficialChatRooms } from "./official-rooms"

describe("official chat-room bootstrap", () => {
  it("creates the official room set idempotently", async () => {
    const roomUpsert = vi
      .fn()
      .mockImplementation(({ where }: { where: { slug: string } }) =>
        Promise.resolve({ id: `room-${where.slug}`, slug: where.slug })
      )
    const interestUpsert = vi.fn().mockResolvedValue({})
    const store = {
      chatRoom: { upsert: roomUpsert },
      chatRoomInterest: { upsert: interestUpsert },
    } as unknown as ChatRoomBootstrapStore
    const loadInterests = vi.fn().mockResolvedValue([
      { id: "ai", label: "AI" },
      { id: "business", label: "Business" },
      { id: "culture", label: "Culture" },
      { id: "cybersecurity", label: "Cybersecurity" },
      { id: "economics", label: "Economics" },
      { id: "entertainment", label: "Entertainment" },
      { id: "gaming", label: "Gaming" },
      { id: "general", label: "General" },
      { id: "programming", label: "Programming" },
      { id: "science", label: "Science" },
      { id: "sports", label: "Sports" },
      { id: "tech", label: "Tech" },
      { id: "writing", label: "Writing" },
    ])

    const firstRun = await bootstrapOfficialChatRooms({ loadInterests, store })
    const secondRun = await bootstrapOfficialChatRooms({ loadInterests, store })

    expect(firstRun).toHaveLength(10)
    expect(secondRun).toHaveLength(10)
    expect(roomUpsert).toHaveBeenCalledTimes(20)
    expect(interestUpsert).toHaveBeenCalledTimes(28)
    expect(roomUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: "lounge" } })
    )
  })

  it("rejects an official room that is not linked to canonical Discover interests", async () => {
    const store = {
      chatRoom: { upsert: vi.fn() },
      chatRoomInterest: { upsert: vi.fn() },
    } as unknown as ChatRoomBootstrapStore

    await expect(
      bootstrapOfficialChatRooms({
        loadInterests: async () => [{ id: "ai", label: "AI" }],
        rooms: [
          {
            description: "Test room",
            interestIds: ["not-a-real-interest"],
            name: "Test",
            slug: "test-room",
            topicLine: "Test",
          },
        ],
        store,
      })
    ).rejects.toThrow("unknown Discover interests")
  })
})

import { describe, expect, it, vi } from "vitest"

import type { PrismaClient } from "@/generated/prisma/client"
import type { DiscoverDirectory } from "@/lib/discover-directory"

import { listChatRoomRecommendationsForArticle } from "./article-recommendations"

describe("article chat room recommendations", () => {
  it("matches the article's subscribed feed to public room interests", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      feed: { feedUrl: "https://example.com/ai.xml" },
    })
    const getRooms = vi.fn().mockResolvedValue([
      {
        description: "Everything about AI",
        id: "room-ai",
        interestIds: ["technology"],
        isOfficial: false,
        name: "AI",
        slug: "ai",
        topicLine: null,
      },
      {
        description: "A general room",
        id: "room-general",
        interestIds: [],
        isOfficial: true,
        name: "General",
        slug: "general",
        topicLine: null,
      },
    ])
    const getDirectory = vi.fn().mockResolvedValue({
      categories: [{ id: "technology", label: "Technology" }],
      feeds: [{ categoryId: "technology", url: "https://example.com/ai.xml" }],
    } as unknown as DiscoverDirectory)

    await expect(
      listChatRoomRecommendationsForArticle({
        articleId: "article-1234",
        getDirectory,
        getRooms,
        store: { article: { findFirst } } as unknown as Pick<PrismaClient, "article">,
        userId: "user-1",
      })
    ).resolves.toMatchObject([
      { id: "room-ai", matchedInterestIds: ["technology"], score: 1 },
      { id: "room-general", matchedInterestIds: [], score: 0 },
    ])
    expect(findFirst).toHaveBeenCalledWith({
      select: { feed: { select: { feedUrl: true } } },
      where: {
        id: "article-1234",
        feed: { subscriptions: { some: { userId: "user-1" } } },
      },
    })
  })

  it("does not list rooms when the article is not in the user's subscriptions", async () => {
    const getDirectory = vi.fn()
    const getRooms = vi.fn()

    await expect(
      listChatRoomRecommendationsForArticle({
        articleId: "article-1234",
        getDirectory,
        getRooms,
        store: {
          article: { findFirst: vi.fn().mockResolvedValue(null) },
        } as unknown as Pick<PrismaClient, "article">,
        userId: "user-1",
      })
    ).resolves.toEqual([])
    expect(getDirectory).not.toHaveBeenCalled()
    expect(getRooms).not.toHaveBeenCalled()
  })
})

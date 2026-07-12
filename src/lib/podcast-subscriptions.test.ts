import { beforeEach, describe, expect, it, vi } from "vitest"
import { Prisma } from "../generated/prisma/client"

const {
  assertUserCanAddSource,
  parsePodcastFeed,
  podcastSubscriptionCreate,
  podcastSubscriptionDeleteMany,
  podcastSubscriptionFindFirst,
  podcastSubscriptionFindMany,
  podcastUpsert,
  reactCache,
  refreshPodcastWithClient,
  safeFetchText,
  podcastParseError,
  sourceLimitError,
} = vi.hoisted(() => {
  class MockSourceLimitError extends Error {
    constructor(message: string) {
      super(message)
      this.name = "SourceLimitError"
    }
  }

  class MockPodcastParseError extends Error {
    constructor(message: string) {
      super(message)
      this.name = "PodcastParseError"
    }
  }

  return {
    assertUserCanAddSource: vi.fn(),
    podcastParseError: MockPodcastParseError,
    parsePodcastFeed: vi.fn(),
    podcastSubscriptionCreate: vi.fn(),
    podcastSubscriptionDeleteMany: vi.fn(),
    podcastSubscriptionFindFirst: vi.fn(),
    podcastSubscriptionFindMany: vi.fn(),
    podcastUpsert: vi.fn(),
    reactCache: vi.fn((loader) => loader),
    refreshPodcastWithClient: vi.fn(),
    safeFetchText: vi.fn(),
    sourceLimitError: MockSourceLimitError,
  }
})

vi.mock("react", () => ({
  cache: reactCache,
}))

vi.mock("./db", () => ({
  getPrisma: () => ({
    podcast: {
      upsert: podcastUpsert,
    },
    podcastSubscription: {
      create: podcastSubscriptionCreate,
      deleteMany: podcastSubscriptionDeleteMany,
      findFirst: podcastSubscriptionFindFirst,
      findMany: podcastSubscriptionFindMany,
    },
  }),
}))

vi.mock("./podcast-parser", () => ({
  parsePodcastFeed,
  PodcastParseError: podcastParseError,
}))

vi.mock("./podcast-refresh", () => ({
  refreshPodcastWithClient,
}))

vi.mock("./source-limits", () => ({
  assertUserCanAddSource,
  SourceLimitError: sourceLimitError,
}))

vi.mock("./url-safety", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./url-safety")>()

  return {
    ...actual,
    safeFetchText,
  }
})

import {
  getUserPodcastSubscription,
  listUserPodcastSubscriptions,
  PodcastSubscriptionError,
  subscribeToPodcast,
  unsubscribeFromPodcast,
} from "./podcast-subscriptions"
import { PODCAST_FEED_MAX_BYTES } from "./podcast-fetch"
import { FeedFetchError } from "./url-safety"

describe("podcast subscriptions", () => {
  const fetchedResponse = {
    contentType: "application/rss+xml",
    text: "<rss></rss>",
    url: new URL("https://example.com/podcast.xml"),
  }
  const parsedPodcast = {
    artworkUrl: "https://example.com/artwork.jpg",
    author: "Example Audio",
    description: "A podcast about examples.",
    episodes: [
      {
        audioUrl: "https://example.com/episode.mp3",
        externalId: "episode-1",
        title: "Episode 1",
      },
    ],
    feedUrl: "https://example.com/podcast.xml",
    language: "en",
    siteUrl: "https://example.com",
    title: "Example Podcast",
  }

  beforeEach(() => {
    assertUserCanAddSource.mockReset()
    parsePodcastFeed.mockReset()
    podcastSubscriptionCreate.mockReset()
    podcastSubscriptionDeleteMany.mockReset()
    podcastSubscriptionFindFirst.mockReset()
    podcastSubscriptionFindMany.mockReset()
    podcastUpsert.mockReset()
    refreshPodcastWithClient.mockReset()
    safeFetchText.mockReset()

    assertUserCanAddSource.mockResolvedValue({
      currentSourceCount: 0,
      limit: 200,
    })
    safeFetchText.mockResolvedValue(fetchedResponse)
    parsePodcastFeed.mockReturnValue(parsedPodcast)
    podcastSubscriptionFindFirst.mockResolvedValue(null)
    podcastUpsert.mockResolvedValue({
      id: "podcast-1",
      title: "Example Podcast",
    })
    podcastSubscriptionCreate.mockResolvedValue({
      id: "subscription-1",
      podcast: {
        id: "podcast-1",
        title: "Example Podcast",
      },
      podcastId: "podcast-1",
      userId: "user-1",
    })
    refreshPodcastWithClient.mockResolvedValue({
      episodeCount: 1,
      podcastId: "podcast-1",
    })
  })

  it("creates the podcast subscription loader through React cache", () => {
    expect(reactCache).toHaveBeenCalledTimes(1)
    expect(reactCache).toHaveBeenCalledWith(expect.any(Function))
    expect(reactCache.mock.calls[0]?.[0].name).toBe(
      "listUserPodcastSubscriptions"
    )
  })

  it("subscribes to a valid podcast and imports the already-fetched feed", async () => {
    const subscription = await subscribeToPodcast({
      url: "https://example.com/podcast.xml",
      userId: "user-1",
    })

    expect(assertUserCanAddSource).toHaveBeenCalledWith({
      userId: "user-1",
    })
    expect(safeFetchText).toHaveBeenCalledWith(
      new URL("https://example.com/podcast.xml"),
      {
        maxBytes: PODCAST_FEED_MAX_BYTES,
      }
    )
    expect(parsePodcastFeed).toHaveBeenCalledWith(
      "<rss></rss>",
      "https://example.com/podcast.xml"
    )
    expect(podcastSubscriptionFindFirst).toHaveBeenCalledWith({
      select: {
        podcast: {
          select: {
            title: true,
          },
        },
      },
      where: {
        podcast: {
          feedUrl: "https://example.com/podcast.xml",
        },
        userId: "user-1",
      },
    })
    expect(podcastUpsert).toHaveBeenCalledWith({
      create: expect.objectContaining({
        artworkUrl: "https://example.com/artwork.jpg",
        author: "Example Audio",
        description: "A podcast about examples.",
        feedUrl: "https://example.com/podcast.xml",
        language: "en",
        siteUrl: "https://example.com",
        title: "Example Podcast",
      }),
      update: expect.objectContaining({
        artworkUrl: "https://example.com/artwork.jpg",
        author: "Example Audio",
        description: "A podcast about examples.",
        language: "en",
        siteUrl: "https://example.com",
        title: "Example Podcast",
      }),
      where: {
        feedUrl: "https://example.com/podcast.xml",
      },
    })
    expect(podcastUpsert.mock.calls[0]?.[0].update).not.toHaveProperty(
      "feedUrl"
    )
    expect(podcastSubscriptionCreate).toHaveBeenCalledWith({
      data: {
        podcastId: "podcast-1",
        userId: "user-1",
      },
      include: {
        podcast: true,
      },
    })
    expect(refreshPodcastWithClient).toHaveBeenCalledWith({
      fetchText: expect.any(Function),
      podcastId: "podcast-1",
    })
    const refreshFetchText =
      refreshPodcastWithClient.mock.calls[0]?.[0].fetchText

    await expect(
      refreshFetchText(new URL("https://example.com/podcast.xml"))
    ).resolves.toBe(fetchedResponse)
    expect(subscription).toMatchObject({
      id: "subscription-1",
      initialEpisodeCount: 1,
      podcastId: "podcast-1",
      sourceCountBeforeSubscribe: 0,
    })
  })

  it("rejects duplicate subscriptions before upserting a podcast", async () => {
    podcastSubscriptionFindFirst.mockResolvedValue({
      podcast: {
        title: "Example Podcast",
      },
    })

    await expect(
      subscribeToPodcast({
        url: "https://example.com/podcast.xml",
        userId: "user-1",
      })
    ).rejects.toEqual(
      new PodcastSubscriptionError(
        "You are already subscribed to Example Podcast."
      )
    )

    expect(podcastUpsert).not.toHaveBeenCalled()
    expect(podcastSubscriptionCreate).not.toHaveBeenCalled()
  })

  it("translates Prisma P2002 duplicates during subscription creation", async () => {
    podcastSubscriptionCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        clientVersion: "test",
        code: "P2002",
      })
    )

    await expect(
      subscribeToPodcast({
        url: "https://example.com/podcast.xml",
        userId: "user-1",
      })
    ).rejects.toEqual(
      new PodcastSubscriptionError(
        "You are already subscribed to Example Podcast."
      )
    )
  })

  it("translates shared source limit errors", async () => {
    assertUserCanAddSource.mockRejectedValue(
      new sourceLimitError("Free accounts can subscribe to up to 200 sources.")
    )

    await expect(
      subscribeToPodcast({
        url: "https://example.com/podcast.xml",
        userId: "user-1",
      })
    ).rejects.toEqual(
      new PodcastSubscriptionError(
        "Free accounts can subscribe to up to 200 sources."
      )
    )

    expect(safeFetchText).not.toHaveBeenCalled()
    expect(podcastUpsert).not.toHaveBeenCalled()
  })

  it("translates unsafe URL errors before checking limits or fetching", async () => {
    await expect(
      subscribeToPodcast({
        url: "ftp://example.com/podcast.xml",
        userId: "user-1",
      })
    ).rejects.toEqual(
      new PodcastSubscriptionError("Only HTTP and HTTPS URLs are supported.")
    )

    expect(assertUserCanAddSource).not.toHaveBeenCalled()
    expect(safeFetchText).not.toHaveBeenCalled()
  })

  it("translates podcast fetch errors", async () => {
    safeFetchText.mockRejectedValue(
      new FeedFetchError("The URL returned HTTP 404.")
    )

    await expect(
      subscribeToPodcast({
        url: "https://example.com/podcast.xml",
        userId: "user-1",
      })
    ).rejects.toEqual(
      new PodcastSubscriptionError("The URL returned HTTP 404.")
    )

    expect(parsePodcastFeed).not.toHaveBeenCalled()
    expect(podcastUpsert).not.toHaveBeenCalled()
  })

  it("translates podcast parser errors", async () => {
    parsePodcastFeed.mockImplementation(() => {
      throw new podcastParseError(
        "No audio episodes were found in that podcast feed."
      )
    })

    await expect(
      subscribeToPodcast({
        url: "https://example.com/podcast.xml",
        userId: "user-1",
      })
    ).rejects.toEqual(
      new PodcastSubscriptionError(
        "No audio episodes were found in that podcast feed."
      )
    )

    expect(podcastUpsert).not.toHaveBeenCalled()
  })

  it("unsubscribes only the current user's podcast subscription", async () => {
    podcastSubscriptionFindFirst.mockResolvedValue({
      id: "subscription-1",
    })
    podcastSubscriptionDeleteMany.mockResolvedValue({ count: 1 })

    await expect(
      unsubscribeFromPodcast({
        subscriptionId: "subscription-1",
        userId: "user-1",
      })
    ).resolves.toEqual({
      subscriptionId: "subscription-1",
    })

    expect(podcastSubscriptionFindFirst).toHaveBeenCalledWith({
      select: {
        id: true,
      },
      where: {
        id: "subscription-1",
        userId: "user-1",
      },
    })
    expect(podcastSubscriptionDeleteMany).toHaveBeenCalledWith({
      where: {
        id: "subscription-1",
        userId: "user-1",
      },
    })
  })

  it("rejects missing or foreign podcast subscriptions without deleting", async () => {
    podcastSubscriptionFindFirst.mockResolvedValue(null)

    await expect(
      unsubscribeFromPodcast({
        subscriptionId: "subscription-1",
        userId: "user-1",
      })
    ).rejects.toEqual(
      new PodcastSubscriptionError("Podcast subscription was not found.")
    )

    expect(podcastSubscriptionDeleteMany).not.toHaveBeenCalled()
  })

  it("rejects podcast subscriptions that disappear before deletion", async () => {
    podcastSubscriptionFindFirst.mockResolvedValue({
      id: "subscription-1",
    })
    podcastSubscriptionDeleteMany.mockResolvedValue({ count: 0 })

    await expect(
      unsubscribeFromPodcast({
        subscriptionId: "subscription-1",
        userId: "user-1",
      })
    ).rejects.toEqual(
      new PodcastSubscriptionError("Podcast subscription was not found.")
    )
  })

  it("lists podcast subscriptions ordered by sort and subscribed date", async () => {
    const subscribedAt = new Date("2026-06-29T12:00:00.000Z")
    podcastSubscriptionFindMany.mockResolvedValue([
      {
        customTitle: null,
        createdAt: subscribedAt,
        id: "subscription-1",
        isMuted: false,
        isPaused: false,
        podcast: {
          artworkUrl: "https://example.com/artwork.jpg",
          feedUrl: "https://example.com/podcast.xml",
          id: "podcast-1",
          lastError: null,
          siteUrl: "https://example.com",
          title: "Example Podcast",
        },
        podcastId: "podcast-1",
        sortOrder: 10,
        subscribedAt,
        updatedAt: subscribedAt,
        userId: "user-1",
      },
    ])

    await expect(listUserPodcastSubscriptions("user-1")).resolves.toEqual([
      {
        customTitle: null,
        createdAt: subscribedAt,
        id: "subscription-1",
        isMuted: false,
        isPaused: false,
        podcast: {
          artworkUrl: "https://example.com/artwork.jpg",
          feedUrl: "https://example.com/podcast.xml",
          id: "podcast-1",
          lastError: null,
          siteUrl: "https://example.com",
          title: "Example Podcast",
        },
        podcastId: "podcast-1",
        sortOrder: 10,
        subscribedAt,
        updatedAt: subscribedAt,
        userId: "user-1",
      },
    ])

    expect(podcastSubscriptionFindMany).toHaveBeenCalledWith({
      include: {
        podcast: true,
      },
      orderBy: [{ sortOrder: "asc" }, { subscribedAt: "desc" }],
      where: { userId: "user-1" },
    })
  })

  it("gets a user's podcast subscription by podcast id", async () => {
    podcastSubscriptionFindFirst.mockResolvedValue({
      id: "subscription-1",
      podcastId: "podcast-1",
    })

    await expect(
      getUserPodcastSubscription({
        podcastId: "podcast-1",
        userId: "user-1",
      })
    ).resolves.toEqual({
      id: "subscription-1",
      podcastId: "podcast-1",
    })

    expect(podcastSubscriptionFindFirst).toHaveBeenCalledWith({
      include: {
        podcast: true,
      },
      where: {
        podcastId: "podcast-1",
        userId: "user-1",
      },
    })
  })
})

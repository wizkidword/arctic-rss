import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  podcastFindFirst: vi.fn(),
  podcastEpisodeFindMany: vi.fn(),
  podcastEpisodeGroupBy: vi.fn(),
  podcastSubscriptionFindMany: vi.fn(),
}))

vi.mock("./db", () => ({
  getPrisma: () => ({
    podcast: {
      findFirst: mocks.podcastFindFirst,
    },
    podcastEpisode: {
      findMany: mocks.podcastEpisodeFindMany,
      groupBy: mocks.podcastEpisodeGroupBy,
    },
    podcastSubscription: {
      findMany: mocks.podcastSubscriptionFindMany,
    },
  }),
}))

import {
  getPodcastHomeForUser,
  getPodcastShowForUser,
  listCollectionPodcastEpisodesForUser,
} from "./podcasts"

describe("getPodcastHomeForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.podcastSubscriptionFindMany.mockResolvedValue([
      {
        customTitle: null,
        id: "subscription-1",
        podcast: {
          artworkUrl: "https://example.com/art.jpg",
          episodes: [
            {
              title: "Episode 1",
            },
          ],
          id: "podcast-1",
          lastError: null,
          title: "Example Podcast",
        },
        podcastId: "podcast-1",
      },
    ])
    mocks.podcastEpisodeFindMany.mockResolvedValue([
      {
        audioType: "audio/mpeg",
        audioUrl: "https://cdn.example.com/ep.mp3",
        description: "Episode description",
        durationSeconds: 1800,
        id: "episode-1",
        imageUrl: null,
        podcast: {
          artworkUrl: "https://example.com/art.jpg",
          id: "podcast-1",
          title: "Example Podcast",
        },
        podcastId: "podcast-1",
        publishedAt: new Date("2026-06-29T12:00:00.000Z"),
        states: [
          {
            isPlayed: false,
            isStarred: false,
            playbackPositionSeconds: 120,
          },
        ],
        title: "Episode 1",
        url: "https://example.com/episode-1",
      },
    ])
    mocks.podcastEpisodeGroupBy.mockResolvedValue([
      {
        _count: {
          _all: 1,
        },
        podcastId: "podcast-1",
      },
    ])
  })

  it("loads podcast subscriptions, latest episodes, and per-user state", async () => {
    await expect(getPodcastHomeForUser("user-1")).resolves.toEqual({
      episodes: [
        expect.objectContaining({
          audioType: "audio/mpeg",
          audioUrl: "https://cdn.example.com/ep.mp3",
          episodeId: "episode-1",
          imageUrl: "https://example.com/art.jpg",
          isPlayed: false,
          isStarred: false,
          playbackPositionSeconds: 120,
          podcastId: "podcast-1",
          podcastTitle: "Example Podcast",
          title: "Episode 1",
        }),
      ],
      nextEpisodeCursor: null,
      subscriptions: [
        expect.objectContaining({
          artworkUrl: "https://example.com/art.jpg",
          id: "podcast-1",
          latestEpisodeTitle: "Episode 1",
          subscriptionId: "subscription-1",
          title: "Example Podcast",
          unplayedCount: 1,
        }),
      ],
    })

    expect(mocks.podcastSubscriptionFindMany).toHaveBeenCalledWith({
      include: {
        podcast: {
          include: {
            episodes: {
              orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
              take: 1,
            },
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { subscribedAt: "desc" }],
      where: { userId: "user-1" },
    })
    expect(mocks.podcastEpisodeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          podcast: true,
          states: {
            take: 1,
            where: { userId: "user-1" },
          },
        },
        take: 51,
      })
    )
    expect(mocks.podcastEpisodeGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ["podcastId"],
        _count: { _all: true },
      })
    )
  })

  it("defaults episode state and subscription counts when user state is missing", async () => {
    mocks.podcastEpisodeFindMany.mockResolvedValue([
      {
        audioType: null,
        audioUrl: "https://cdn.example.com/ep.mp3",
        description: null,
        durationSeconds: null,
        id: "episode-1",
        imageUrl: "https://example.com/episode.jpg",
        podcast: {
          artworkUrl: "https://example.com/art.jpg",
          id: "podcast-1",
          title: "Example Podcast",
        },
        podcastId: "podcast-1",
        publishedAt: null,
        states: [],
        title: "Episode 1",
        url: null,
      },
    ])
    mocks.podcastEpisodeGroupBy.mockResolvedValue([])

    await expect(getPodcastHomeForUser("user-1")).resolves.toMatchObject({
      episodes: [
        {
          audioType: null,
          audioUrl: "https://cdn.example.com/ep.mp3",
          description: null,
          durationSeconds: null,
          episodeId: "episode-1",
          imageUrl: "https://example.com/episode.jpg",
          isPlayed: false,
          isStarred: false,
          playbackPositionSeconds: 0,
          podcastId: "podcast-1",
          podcastTitle: "Example Podcast",
          publishedAt: null,
          title: "Episode 1",
          url: null,
        },
      ],
      subscriptions: [
        expect.objectContaining({
          unplayedCount: 0,
        }),
      ],
    })
  })
})

describe("getPodcastShowForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.podcastFindFirst.mockResolvedValue({
      artworkUrl: "https://example.com/art.jpg",
      description: "Example description",
      episodes: [
        {
          audioType: "audio/mpeg",
          audioUrl: "https://cdn.example.com/ep.mp3",
          description: "Episode description",
          durationSeconds: 1800,
          id: "episode-1",
          imageUrl: null,
          podcastId: "podcast-1",
          publishedAt: new Date("2026-06-29T12:00:00.000Z"),
          states: [
            {
              isPlayed: false,
              isStarred: false,
              playbackPositionSeconds: 120,
            },
          ],
          title: "Episode 1",
          url: "https://example.com/episode-1",
        },
      ],
      id: "podcast-1",
      lastError: null,
      siteUrl: "https://example.com",
      title: "Example Podcast",
    })
  })

  it("returns podcast metadata and episodes when the user is subscribed", async () => {
    await expect(
      getPodcastShowForUser({
        podcastId: "podcast-1",
        userId: "user-1",
      })
    ).resolves.toEqual(
      expect.objectContaining({
        episodes: [
          expect.objectContaining({
            episodeId: "episode-1",
            isPlayed: false,
            playbackPositionSeconds: 120,
            podcastTitle: "Example Podcast",
            title: "Episode 1",
          }),
        ],
        podcast: expect.objectContaining({
          artworkUrl: "https://example.com/art.jpg",
          id: "podcast-1",
          title: "Example Podcast",
          url: "https://example.com",
        }),
      })
    )

    expect(mocks.podcastFindFirst).toHaveBeenCalledWith({
      include: {
        episodes: {
          include: {
            states: {
              take: 1,
              where: { userId: "user-1" },
            },
          },
          orderBy: [
            { publishedAt: { nulls: "last", sort: "desc" } },
            { createdAt: "desc" },
            { id: "desc" },
          ],
          take: 51,
          where: undefined,
        },
      },
      where: {
        id: "podcast-1",
        subscriptions: {
          some: {
            userId: "user-1",
          },
        },
      },
    })
  })

  it("returns null when the podcast is missing or not subscribed", async () => {
    mocks.podcastFindFirst.mockResolvedValue(null)

    await expect(
      getPodcastShowForUser({
        podcastId: "podcast-2",
        userId: "user-1",
      })
    ).resolves.toBeNull()
  })
})

describe("listCollectionPodcastEpisodesForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.podcastEpisodeFindMany.mockResolvedValue([
      {
        audioType: "audio/mpeg",
        audioUrl: "https://cdn.example.com/ep.mp3",
        description: "Episode description",
        durationSeconds: 1800,
        id: "episode-1",
        imageUrl: null,
        podcast: {
          artworkUrl: "https://example.com/art.jpg",
          id: "podcast-1",
          title: "Example Podcast",
        },
        podcastId: "podcast-1",
        publishedAt: new Date("2026-06-29T12:00:00.000Z"),
        states: [
          {
            isPlayed: true,
            isStarred: true,
            playbackPositionSeconds: 240,
          },
        ],
        title: "Episode 1",
        url: "https://example.com/episode-1",
      },
    ])
  })

  it("loads saved podcast episodes in a user-owned collection", async () => {
    await expect(
      listCollectionPodcastEpisodesForUser({
        collectionId: "collection-1",
        userId: "user-1",
      })
    ).resolves.toEqual([
      expect.objectContaining({
        episodeId: "episode-1",
        imageUrl: "https://example.com/art.jpg",
        isPlayed: true,
        isStarred: true,
        playbackPositionSeconds: 240,
        podcastTitle: "Example Podcast",
        title: "Episode 1",
      }),
    ])

    expect(mocks.podcastEpisodeFindMany).toHaveBeenCalledWith({
      include: {
        podcast: true,
        states: {
          take: 1,
          where: { userId: "user-1" },
        },
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: 50,
      where: {
        collectionItems: {
          some: {
            collection: {
              userId: "user-1",
            },
            collectionId: "collection-1",
          },
        },
      },
    })
  })
})

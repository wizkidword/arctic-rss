import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  podcastEpisodeFindFirst: vi.fn(),
  podcastEpisodeStateFindUnique: vi.fn(),
  podcastEpisodeStateUpsert: vi.fn(),
}))

vi.mock("./db", () => ({
  getPrisma: () => ({
    podcastEpisode: {
      findFirst: mocks.podcastEpisodeFindFirst,
    },
    podcastEpisodeState: {
      findUnique: mocks.podcastEpisodeStateFindUnique,
      upsert: mocks.podcastEpisodeStateUpsert,
    },
  }),
}))

import {
  markPodcastEpisodePlayed,
  PodcastEpisodeStateError,
  savePodcastPlaybackProgress,
  togglePodcastEpisodeStar,
} from "./podcast-episode-state"

describe("podcast episode state", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.podcastEpisodeFindFirst.mockResolvedValue({ id: "episode-1" })
    mocks.podcastEpisodeStateFindUnique.mockResolvedValue(null)
    mocks.podcastEpisodeStateUpsert.mockResolvedValue({ id: "state-1" })
  })

  it("saves playback progress for an accessible podcast episode", async () => {
    await savePodcastPlaybackProgress({
      episodeId: "episode-1",
      playbackPositionSeconds: 90.7,
      userId: "user-1",
    })

    expect(mocks.podcastEpisodeFindFirst).toHaveBeenCalledWith({
      select: { id: true },
      where: {
        id: "episode-1",
        podcast: {
          subscriptions: {
            some: { userId: "user-1" },
          },
        },
      },
    })
    expect(mocks.podcastEpisodeStateUpsert).toHaveBeenCalledWith({
      create: {
        episodeId: "episode-1",
        playbackPositionSeconds: 90,
        userId: "user-1",
      },
      update: {
        playbackPositionSeconds: 90,
      },
      where: {
        userId_episodeId: {
          episodeId: "episode-1",
          userId: "user-1",
        },
      },
    })
  })

  it("marks an episode played or unplayed", async () => {
    await markPodcastEpisodePlayed({
      episodeId: "episode-1",
      isPlayed: true,
      userId: "user-1",
    })

    expect(mocks.podcastEpisodeStateUpsert).toHaveBeenCalledWith({
      create: {
        episodeId: "episode-1",
        isPlayed: true,
        userId: "user-1",
      },
      update: {
        isPlayed: true,
      },
      where: {
        userId_episodeId: {
          episodeId: "episode-1",
          userId: "user-1",
        },
      },
    })
  })

  it("toggles an episode star", async () => {
    mocks.podcastEpisodeStateFindUnique.mockResolvedValue({
      isStarred: true,
    })

    await togglePodcastEpisodeStar({
      episodeId: "episode-1",
      userId: "user-1",
    })

    expect(mocks.podcastEpisodeStateFindUnique).toHaveBeenCalledWith({
      where: {
        userId_episodeId: {
          episodeId: "episode-1",
          userId: "user-1",
        },
      },
    })
    expect(mocks.podcastEpisodeStateUpsert).toHaveBeenCalledWith({
      create: {
        episodeId: "episode-1",
        isStarred: true,
        userId: "user-1",
      },
      update: {
        isStarred: false,
      },
      where: {
        userId_episodeId: {
          episodeId: "episode-1",
          userId: "user-1",
        },
      },
    })
  })

  it("rejects state changes for missing or inaccessible episodes", async () => {
    mocks.podcastEpisodeFindFirst.mockResolvedValue(null)

    await expect(
      savePodcastPlaybackProgress({
        episodeId: "episode-1",
        playbackPositionSeconds: 30,
        userId: "user-1",
      })
    ).rejects.toEqual(
      new PodcastEpisodeStateError("Podcast episode was not found.")
    )

    expect(mocks.podcastEpisodeStateUpsert).not.toHaveBeenCalled()
  })
})

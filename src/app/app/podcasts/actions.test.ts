import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  class MockPodcastSubscriptionError extends Error {
    constructor(message: string) {
      super(message)
      this.name = "PodcastSubscriptionError"
    }
  }

  return {
    auth: vi.fn(),
    markPodcastEpisodePlayed: vi.fn(),
    MockPodcastSubscriptionError,
    redirect: vi.fn((path: string) => {
      throw new Error(`REDIRECT:${path}`)
    }),
    revalidatePath: vi.fn(),
    savePodcastPlaybackProgress: vi.fn(),
    subscribeToPodcast: vi.fn(),
    togglePodcastEpisodeStar: vi.fn(),
    unsubscribeFromPodcast: vi.fn(),
  }
})

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}))

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}))

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}))

vi.mock("@/lib/podcast-subscriptions", () => ({
  PodcastSubscriptionError: mocks.MockPodcastSubscriptionError,
  subscribeToPodcast: mocks.subscribeToPodcast,
  unsubscribeFromPodcast: mocks.unsubscribeFromPodcast,
}))

vi.mock("@/lib/podcast-episode-state", () => ({
  markPodcastEpisodePlayed: mocks.markPodcastEpisodePlayed,
  savePodcastPlaybackProgress: mocks.savePodcastPlaybackProgress,
  togglePodcastEpisodeStar: mocks.togglePodcastEpisodeStar,
}))

import {
  markPodcastEpisodePlayedAction,
  savePodcastPlaybackProgressAction,
  subscribeToPodcastAction,
  togglePodcastEpisodeStarAction,
  unsubscribePodcastAction,
} from "./actions"

describe("podcast actions", () => {
  beforeEach(() => {
    mocks.auth.mockReset()
    mocks.markPodcastEpisodePlayed.mockReset()
    mocks.redirect.mockClear()
    mocks.revalidatePath.mockReset()
    mocks.savePodcastPlaybackProgress.mockReset()
    mocks.subscribeToPodcast.mockReset()
    mocks.togglePodcastEpisodeStar.mockReset()
    mocks.unsubscribeFromPodcast.mockReset()
  })

  it("returns an error state when subscribing without authentication", async () => {
    mocks.auth.mockResolvedValue(null)
    const formData = new FormData()
    formData.set("url", "https://example.com/podcast.xml")

    await expect(subscribeToPodcastAction(formData)).resolves.toEqual({
      message: "You need to sign in before subscribing to podcasts.",
      status: "error",
    })
    expect(mocks.subscribeToPodcast).not.toHaveBeenCalled()
  })

  it("requires a podcast RSS URL before subscribing", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    const formData = new FormData()
    formData.set("url", "   ")

    await expect(subscribeToPodcastAction(formData)).resolves.toEqual({
      message: "Podcast RSS URL is required.",
      status: "error",
    })
    expect(mocks.subscribeToPodcast).not.toHaveBeenCalled()
  })

  it("returns a success message with the imported episode count", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.subscribeToPodcast.mockResolvedValue({
      initialEpisodeCount: 1,
      podcast: {
        title: "Example Podcast",
      },
    })
    const formData = new FormData()
    formData.set("url", "https://example.com/podcast.xml")

    await expect(subscribeToPodcastAction(formData)).resolves.toEqual({
      message: "Subscribed to Example Podcast. Imported 1 episode.",
      status: "success",
    })
    expect(mocks.subscribeToPodcast).toHaveBeenCalledWith({
      url: "https://example.com/podcast.xml",
      userId: "user-1",
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app")
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app", "layout")
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/podcasts")
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/app/podcasts/discover"
    )
  })

  it("returns analytics metadata when a podcast is the reader's first source", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.subscribeToPodcast.mockResolvedValue({
      initialEpisodeCount: 1,
      podcast: {
        title: "Example Podcast",
      },
      sourceCountBeforeSubscribe: 0,
    })
    const formData = new FormData()
    formData.set("url", "https://example.com/podcast.xml")

    await expect(subscribeToPodcastAction(formData)).resolves.toEqual({
      analytics: {
        firstSourceSubscribed: true,
        sourceType: "podcast",
      },
      message: "Subscribed to Example Podcast. Imported 1 episode.",
      status: "success",
    })
  })

  it("returns a refresh-soon message when the initial episode count is unavailable", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.subscribeToPodcast.mockResolvedValue({
      initialEpisodeCount: undefined,
      podcast: {
        title: "Example Podcast",
      },
    })
    const formData = new FormData()
    formData.set("url", "https://example.com/podcast.xml")

    await expect(subscribeToPodcastAction(formData)).resolves.toEqual({
      message: "Subscribed to Example Podcast. Episodes will refresh soon.",
      status: "success",
    })
  })

  it("returns podcast subscription errors as action state", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.subscribeToPodcast.mockRejectedValue(
      new mocks.MockPodcastSubscriptionError(
        "You are already subscribed to Example Podcast."
      )
    )
    const formData = new FormData()
    formData.set("url", "https://example.com/podcast.xml")

    await expect(subscribeToPodcastAction(formData)).resolves.toEqual({
      message: "You are already subscribed to Example Podcast.",
      status: "error",
    })
  })

  it("returns a generic error when subscribing fails unexpectedly", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.subscribeToPodcast.mockRejectedValue(new Error("Database unavailable"))
    const formData = new FormData()
    formData.set("url", "https://example.com/podcast.xml")

    await expect(subscribeToPodcastAction(formData)).resolves.toEqual({
      message: "We could not subscribe to that podcast right now.",
      status: "error",
    })
  })

  it("does not turn a successful subscription into an error when revalidation fails", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.subscribeToPodcast.mockResolvedValue({
      initialEpisodeCount: 2,
      podcast: {
        title: "Example Podcast",
      },
    })
    mocks.revalidatePath.mockImplementation((path: string) => {
      if (path === "/app") {
        throw new Error("Cache unavailable")
      }
    })
    const formData = new FormData()
    formData.set("url", "https://example.com/podcast.xml")

    await expect(subscribeToPodcastAction(formData)).resolves.toEqual({
      message: "Subscribed to Example Podcast. Imported 2 episodes.",
      status: "success",
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app")
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app", "layout")
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/podcasts")
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/app/podcasts/discover"
    )
  })

  it("unsubscribes the selected podcast and redirects to podcasts", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.unsubscribeFromPodcast.mockResolvedValue({
      subscriptionId: "subscription-1",
    })
    const formData = new FormData()
    formData.set("subscriptionId", "subscription-1")

    await expect(unsubscribePodcastAction(formData)).rejects.toThrow(
      "REDIRECT:/app/podcasts"
    )

    expect(mocks.unsubscribeFromPodcast).toHaveBeenCalledWith({
      subscriptionId: "subscription-1",
      userId: "user-1",
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app")
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app", "layout")
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/podcasts")
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/app/podcasts/discover"
    )
    expect(mocks.redirect).toHaveBeenCalledWith("/app/podcasts")
  })

  it("returns an error state when unsubscribe is unauthenticated or missing an id", async () => {
    mocks.auth.mockResolvedValueOnce(null)
    const unauthenticatedFormData = new FormData()
    unauthenticatedFormData.set("subscriptionId", "subscription-1")

    await expect(
      unsubscribePodcastAction(unauthenticatedFormData)
    ).resolves.toEqual({
      message: "You need to sign in before unsubscribing from podcasts.",
      status: "error",
    })

    mocks.auth.mockResolvedValueOnce({
      user: {
        id: "user-1",
      },
    })
    const missingSubscriptionFormData = new FormData()

    await expect(
      unsubscribePodcastAction(missingSubscriptionFormData)
    ).resolves.toEqual({
      message: "Choose a podcast subscription to unsubscribe from.",
      status: "error",
    })
    expect(mocks.unsubscribeFromPodcast).not.toHaveBeenCalled()
  })

  it("saves podcast playback progress", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    const formData = new FormData()
    formData.set("episodeId", "episode-1")
    formData.set("playbackPositionSeconds", "90")

    await expect(savePodcastPlaybackProgressAction(formData)).resolves.toEqual({
      message: "Progress saved.",
      status: "success",
    })
    expect(mocks.savePodcastPlaybackProgress).toHaveBeenCalledWith({
      episodeId: "episode-1",
      playbackPositionSeconds: 90,
      userId: "user-1",
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/podcasts")
  })

  it("marks podcast episodes played and toggles stars", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    const playedFormData = new FormData()
    playedFormData.set("episodeId", "episode-1")
    playedFormData.set("isPlayed", "true")

    await expect(markPodcastEpisodePlayedAction(playedFormData)).resolves.toEqual(
      {
        message: "Episode updated.",
        status: "success",
      }
    )
    expect(mocks.markPodcastEpisodePlayed).toHaveBeenCalledWith({
      episodeId: "episode-1",
      isPlayed: true,
      userId: "user-1",
    })

    const starFormData = new FormData()
    starFormData.set("episodeId", "episode-1")

    await expect(togglePodcastEpisodeStarAction(starFormData)).resolves.toEqual({
      message: "Episode updated.",
      status: "success",
    })
    expect(mocks.togglePodcastEpisodeStar).toHaveBeenCalledWith({
      episodeId: "episode-1",
      userId: "user-1",
    })
  })

  it("returns podcast episode state action errors safely", async () => {
    mocks.auth.mockResolvedValueOnce(null)
    const unauthenticatedFormData = new FormData()
    unauthenticatedFormData.set("episodeId", "episode-1")

    await expect(
      savePodcastPlaybackProgressAction(unauthenticatedFormData)
    ).resolves.toEqual({
      message: "You need to sign in before updating podcast episodes.",
      status: "error",
    })

    mocks.auth.mockResolvedValueOnce({
      user: {
        id: "user-1",
      },
    })
    mocks.markPodcastEpisodePlayed.mockRejectedValue(new Error("Missing episode"))
    const playedFormData = new FormData()
    playedFormData.set("episodeId", "episode-1")

    await expect(markPodcastEpisodePlayedAction(playedFormData)).resolves.toEqual({
      message: "Missing episode",
      status: "error",
    })
  })
})

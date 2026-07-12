/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  savePodcastPlaybackProgressAction: vi.fn(),
}))

vi.mock("@/app/app/podcasts/actions", () => ({
  savePodcastPlaybackProgressAction:
    mocks.savePodcastPlaybackProgressAction,
}))

import { PodcastPlayer } from "./podcast-player"

const episode = {
  audioUrl: "https://cdn.example.com/episode.mp3",
  episodeId: "episode-1",
  playbackPositionSeconds: 42,
  podcastTitle: "Example Podcast",
  title: "Episode 1",
  url: "https://example.com/episode-1",
}

describe("PodcastPlayer", () => {
  beforeEach(() => {
    mocks.savePodcastPlaybackProgressAction.mockResolvedValue({
      message: "Progress saved.",
      status: "success",
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("restores saved playback position when playback starts", () => {
    render(<PodcastPlayer episode={episode} />)

    const audio = screen.getByLabelText(
      "Player for Episode 1"
    ) as HTMLAudioElement
    fireEvent.play(audio)

    expect(audio.currentTime).toBe(42)
  })

  it("saves progress every 15 seconds while playing", () => {
    render(<PodcastPlayer episode={episode} />)

    const audio = screen.getByLabelText(
      "Player for Episode 1"
    ) as HTMLAudioElement
    fireEvent.play(audio)
    audio.currentTime = 56
    fireEvent.timeUpdate(audio)

    expect(mocks.savePodcastPlaybackProgressAction).not.toHaveBeenCalled()

    audio.currentTime = 57
    fireEvent.timeUpdate(audio)

    expect(lastSubmittedFormData().get("episodeId")).toBe("episode-1")
    expect(lastSubmittedFormData().get("playbackPositionSeconds")).toBe("57")
  })

  it("saves progress on pause and seek", () => {
    render(<PodcastPlayer episode={episode} />)

    const audio = screen.getByLabelText(
      "Player for Episode 1"
    ) as HTMLAudioElement
    audio.currentTime = 60
    fireEvent.pause(audio)

    expect(lastSubmittedFormData().get("playbackPositionSeconds")).toBe("60")

    audio.currentTime = 75
    fireEvent.seeked(audio)

    expect(lastSubmittedFormData().get("playbackPositionSeconds")).toBe("75")
  })

  it("renders nothing without an episode", () => {
    const { container } = render(<PodcastPlayer episode={null} />)

    expect(container.textContent).toBe("")
  })
})

function lastSubmittedFormData() {
  const formData = mocks.savePodcastPlaybackProgressAction.mock.lastCall?.[0]

  if (!(formData instanceof FormData)) {
    throw new Error("Expected a FormData submission")
  }

  return formData
}

import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("./podcast-episode-actions", () => ({
  PodcastEpisodeActions: () => (
    <div>
      <button type="button">Share episode</button>
      <button type="button">Star episode</button>
      <button type="button">Save episode to collection</button>
      <button type="button">Mark episode played</button>
    </div>
  ),
}))

import { PodcastEpisodeList } from "./podcast-episode-list"

describe("PodcastEpisodeList", () => {
  it("renders episode details and actions", () => {
    const markup = renderToStaticMarkup(
      <PodcastEpisodeList
        dateTimePreferences={{
          dateFormat: "MM_DD_YYYY",
          timeFormat: "HOUR_24",
          timeZone: "UTC",
        }}
        episodes={[
          {
            audioType: "audio/mpeg",
            audioUrl: "https://cdn.example.com/ep.mp3",
            description: "Episode description",
            durationSeconds: 1800,
            episodeId: "episode-1",
            imageUrl: "https://example.com/episode.jpg",
            isPlayed: false,
            isStarred: false,
            playbackPositionSeconds: 0,
            podcastId: "podcast-1",
            podcastTitle: "Example Podcast",
            publishedAt: new Date("2026-01-01T00:00:00.000Z"),
            title: "Episode 1",
            url: "https://example.com/episode-1",
          },
        ]}
      />
    )

    expect(markup).toContain("Episode 1")
    expect(markup).toContain("Example Podcast")
    expect(markup).toContain("Aired 01/01/2026, 00:00")
    expect(markup).toContain("Stream Episode 1")
    expect(markup).toContain("Star episode")
    expect(markup).toContain("Save episode to collection")
    expect(markup).toContain("Mark episode played")
    expect(markup).toContain("Share episode")
    expect(markup).toContain("Open original episode")
  })

  it("renders an empty state", () => {
    const markup = renderToStaticMarkup(<PodcastEpisodeList episodes={[]} />)

    expect(markup).toContain("No Episodes")
    expect(markup).toContain("Subscribe to a podcast")
  })
})

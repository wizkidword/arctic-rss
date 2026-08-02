import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { PodcastTranscript } from "./podcast-transcript"

describe("PodcastTranscript", () => {
  it("identifies a publisher transcript and keeps its source visible", () => {
    const markup = renderToStaticMarkup(
      <PodcastTranscript
        audioElementId="podcast-audio-episode-1"
        episodeId="episode-1"
        transcript={{
          language: "en",
          rel: null,
          type: "text/vtt",
          url: "https://publisher.example.com/episode.vtt",
        }}
      />
    )

    expect(markup).toContain("Publisher transcript")
    expect(markup).toContain("View transcript")
    expect(markup).toContain("Open at publisher")
  })
})

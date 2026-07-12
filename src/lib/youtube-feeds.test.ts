import { describe, expect, it } from "vitest"

import {
  extractYouTubeChannelIdFromHtml,
  extractYouTubeVideoId,
  youtubeFeedUrlForInput,
} from "./youtube-feeds"

describe("YouTube feed helpers", () => {
  it("builds a YouTube RSS feed URL from a channel page URL", () => {
    expect(
      youtubeFeedUrlForInput(
        new URL("https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw")
      )
    ).toBe(
      "https://www.youtube.com/feeds/videos.xml?channel_id=UC_x5XG1OV2P6uZZ5FSM9Ttw"
    )
  })

  it("extracts channel ids from YouTube channel page HTML", () => {
    expect(
      extractYouTubeChannelIdFromHtml(
        `<script nonce="abc">var ytInitialData = {"metadata":{"channelMetadataRenderer":{"externalId":"UC_x5XG1OV2P6uZZ5FSM9Ttw"}}};</script>`
      )
    ).toBe("UC_x5XG1OV2P6uZZ5FSM9Ttw")
  })

  it("extracts video ids from watch and short URLs", () => {
    expect(
      extractYouTubeVideoId(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=feed"
      )
    ).toBe("dQw4w9WgXcQ")
    expect(extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ"
    )
    expect(
      extractYouTubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")
    ).toBe("dQw4w9WgXcQ")
  })
})

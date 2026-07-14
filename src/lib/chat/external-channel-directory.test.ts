import { describe, expect, it } from "vitest"

import { listExternalIrcChannelRecommendations } from "./external-channel-directory"

describe("external IRC channel directory", () => {
  it("returns the curated public starter channels without opening a connection", () => {
    expect(listExternalIrcChannelRecommendations().map((channel) => channel.channel)).toEqual([
      "#libera",
      "#oftc",
      "#debian",
    ])
  })

  it("filters only the static public recommendations", () => {
    const channels = listExternalIrcChannelRecommendations("debian")

    expect(channels).toHaveLength(1)
    expect(channels[0]).toMatchObject({
      channel: "#debian",
      network: "OFTC",
      openUrl: "https://webchat.oftc.net/",
    })
  })
})

import { describe, expect, it } from "vitest"

import { getChatFeatureFlags, parseChatFeatureFlag } from "./feature-flags"

describe("chat feature flags", () => {
  it("fails closed when flags are absent or malformed", () => {
    expect(getChatFeatureFlags({})).toEqual({
      betaAllowlistEnabled: false,
      botEnabled: false,
      directMessagesEnabled: false,
      enabled: false,
      externalEnabled: false,
      externalLiberaEnabled: false,
      externalOftcEnabled: false,
      guestPreviewEnabled: false,
      roomCreationEnabled: false,
    })
    expect(parseChatFeatureFlag("yes")).toBe(false)
    expect(parseChatFeatureFlag("1")).toBe(false)
  })

  it("only enables an explicit true value", () => {
    expect(parseChatFeatureFlag(" TRUE ")).toBe(true)
    expect(
      getChatFeatureFlags({
        ARCTIC_IRC_ENABLED: "true",
        ARCTIC_IRC_EXTERNAL_ENABLED: "true",
        ARCTIC_IRC_EXTERNAL_OFTC_ENABLED: "true",
      })
    ).toMatchObject({ enabled: true, externalEnabled: true, externalOftcEnabled: true })
  })

  it("keeps every subfeature off until native chat itself is enabled", () => {
    expect(
      getChatFeatureFlags({
        ARCTIC_IRC_EXTERNAL_ENABLED: "true",
        ARCTIC_IRC_ROOM_CREATION_ENABLED: "true",
      })
    ).toMatchObject({
      enabled: false,
      externalEnabled: false,
      externalLiberaEnabled: false,
      externalOftcEnabled: false,
      roomCreationEnabled: false,
    })
  })
})

import { describe, expect, it } from "vitest"

import { defaultUserSettings } from "./settings"

describe("default user settings", () => {
  it("starts new accounts with classic reader defaults and AI opt-in disabled", () => {
    expect(defaultUserSettings()).toMatchObject({
      defaultView: "CLASSIC",
      theme: "SYSTEM",
      fontSize: "MEDIUM",
      markReadOnOpen: true,
      openLinksInNewTab: true,
      aiAutoSummariesEnabled: false,
      dailyDigestEnabled: false,
    })
  })
})

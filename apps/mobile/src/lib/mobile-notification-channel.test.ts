import { describe, expect, it } from "vitest"

import {
  mobileNotificationChannelLabel,
  nextMobileNotificationChannel,
} from "./mobile-notification-channel"

describe("mobile notification channel boundary", () => {
  it("never offers unavailable mobile push as a selectable channel", () => {
    expect(nextMobileNotificationChannel("IN_APP")).toBe("EMAIL")
    expect(nextMobileNotificationChannel("EMAIL")).toBe("DISABLED")
    expect(nextMobileNotificationChannel("DISABLED")).toBe("IN_APP")
    expect(nextMobileNotificationChannel("MOBILE_PUSH")).toBe("IN_APP")
  })

  it("marks retained server-side push preferences as unavailable", () => {
    expect(mobileNotificationChannelLabel("MOBILE_PUSH")).toBe("Mobile push (unavailable)")
  })
})

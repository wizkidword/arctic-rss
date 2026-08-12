import { describe, expect, it } from "vitest"

import { isNativeMobileAuthorizationEnabled } from "./mobile-auth-configuration"

describe("native mobile authorization configuration", () => {
  it("fails closed unless explicitly enabled", () => {
    expect(isNativeMobileAuthorizationEnabled({})).toBe(false)
    expect(isNativeMobileAuthorizationEnabled({ MOBILE_NATIVE_AUTHORIZATION_ENABLED: "false" })).toBe(false)
    expect(isNativeMobileAuthorizationEnabled({ MOBILE_NATIVE_AUTHORIZATION_ENABLED: "TRUE" })).toBe(false)
    expect(isNativeMobileAuthorizationEnabled({ MOBILE_NATIVE_AUTHORIZATION_ENABLED: "true" })).toBe(true)
  })
})

import { describe, expect, it } from "vitest"

import {
  MOBILE_STORE_SCHEMA_VERSION,
  mobileStoreUpgrade,
  requiresMobileStoreInitialization,
} from "./mobile-store-schema"

describe("mobile store schema", () => {
  it("initializes and upgrades supported alpha schemas exactly once", () => {
    expect(requiresMobileStoreInitialization(0)).toBe(true)
    expect(mobileStoreUpgrade(0)).toBe("initialize")
    expect(mobileStoreUpgrade(1)).toBe("upgrade-v1")
    expect(requiresMobileStoreInitialization(MOBILE_STORE_SCHEMA_VERSION)).toBe(false)
  })

  it("fails closed for unsupported schema versions", () => {
    expect(() => requiresMobileStoreInitialization(-1)).toThrow(/unsupported schema/i)
    expect(() => requiresMobileStoreInitialization(MOBILE_STORE_SCHEMA_VERSION + 1)).toThrow(/unsupported schema/i)
  })
})

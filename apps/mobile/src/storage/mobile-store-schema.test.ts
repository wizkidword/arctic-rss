import { describe, expect, it } from "vitest"

import { MOBILE_STORE_SCHEMA_VERSION, requiresMobileStoreInitialization } from "./mobile-store-schema"

describe("mobile store schema", () => {
  it("initializes the only supported schema exactly once", () => {
    expect(requiresMobileStoreInitialization(0)).toBe(true)
    expect(requiresMobileStoreInitialization(MOBILE_STORE_SCHEMA_VERSION)).toBe(false)
  })

  it("fails closed for unsupported schema versions", () => {
    expect(() => requiresMobileStoreInitialization(-1)).toThrow(/unsupported schema/i)
    expect(() => requiresMobileStoreInitialization(MOBILE_STORE_SCHEMA_VERSION + 1)).toThrow(/unsupported schema/i)
  })
})

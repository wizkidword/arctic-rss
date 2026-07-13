import { describe, expect, it } from "vitest"

import {
  assertSecureProductionConfiguration,
  UnsafeProductionConfigurationError,
} from "./production-security"

describe("production security configuration", () => {
  it("rejects disabled email verification in production", () => {
    expect(() =>
      assertSecureProductionConfiguration({
        NODE_ENV: "production",
        REQUIRE_EMAIL_VERIFICATION: "false",
      })
    ).toThrow(UnsafeProductionConfigurationError)
  })

  it("rejects the retired admin email allowlist in production", () => {
    expect(() =>
      assertSecureProductionConfiguration({
        ADMIN_EMAILS: "owner@example.com",
        NODE_ENV: "production",
        REQUIRE_EMAIL_VERIFICATION: "true",
      })
    ).toThrow(UnsafeProductionConfigurationError)
  })

  it("accepts the secure production configuration", () => {
    expect(() =>
      assertSecureProductionConfiguration({
        NODE_ENV: "production",
        REQUIRE_EMAIL_VERIFICATION: "true",
      })
    ).not.toThrow()
  })

  it("allows a non-production test configuration", () => {
    expect(() =>
      assertSecureProductionConfiguration({
        NODE_ENV: "test",
        REQUIRE_EMAIL_VERIFICATION: "false",
      })
    ).not.toThrow()
  })
})

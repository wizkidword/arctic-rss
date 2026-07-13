import { describe, expect, it } from "vitest"

import {
  assertSecureProductionConfiguration,
  UnsafeProductionConfigurationError,
} from "./production-security"

describe("production security configuration", () => {
  const secureProductionEnvironment = {
    APP_ORIGIN: "https://arcticrss.com",
    AUTH_URL: "https://arcticrss.com",
    NODE_ENV: "production",
    REQUIRE_EMAIL_VERIFICATION: "true",
  } as const

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
      assertSecureProductionConfiguration(secureProductionEnvironment)
    ).not.toThrow()
  })

  it("requires a canonical HTTPS origin and matching Auth.js URL in production", () => {
    expect(() =>
      assertSecureProductionConfiguration({
        AUTH_URL: "https://arcticrss.com",
        NODE_ENV: "production",
        REQUIRE_EMAIL_VERIFICATION: "true",
      })
    ).toThrow(UnsafeProductionConfigurationError)

    expect(() =>
      assertSecureProductionConfiguration({
        ...secureProductionEnvironment,
        AUTH_URL: "https://attacker.example",
      })
    ).toThrow("AUTH_URL must match APP_ORIGIN")

    expect(() =>
      assertSecureProductionConfiguration({
        ...secureProductionEnvironment,
        APP_ORIGIN: "http://arcticrss.com",
        AUTH_URL: "http://arcticrss.com",
      })
    ).toThrow("APP_ORIGIN must use HTTPS")
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

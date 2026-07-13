import { describe, expect, it } from "vitest"

import {
  AppOriginConfigurationError,
  assertProductionAppOrigin,
  buildAppUrl,
  getAllowedAppHosts,
  getAppOrigin,
  isAllowedAppHost,
  normalizeRequestHost,
} from "./app-origin"

describe("app origin configuration", () => {
  it("uses one normalized canonical origin for absolute application URLs", () => {
    const environment = { APP_ORIGIN: "https://arcticrss.com/" }

    expect(getAppOrigin(environment).origin).toBe("https://arcticrss.com")
    expect(buildAppUrl("/login?next=%2Fapp", environment).toString()).toBe(
      "https://arcticrss.com/login?next=%2Fapp"
    )
  })

  it("rejects origins with credentials, paths, queries, and non-HTTP schemes", () => {
    for (const APP_ORIGIN of [
      "ftp://arcticrss.com",
      "https://user:password@arcticrss.com",
      "https://arcticrss.com/app",
      "https://arcticrss.com?next=/app",
    ]) {
      expect(() => getAppOrigin({ APP_ORIGIN })).toThrow(
        AppOriginConfigurationError
      )
    }
  })

  it("requires an HTTPS canonical origin in production", () => {
    expect(() =>
      assertProductionAppOrigin({ NODE_ENV: "production" })
    ).toThrow("APP_ORIGIN must be configured")

    expect(() =>
      assertProductionAppOrigin({
        APP_ORIGIN: "http://arcticrss.com",
        NODE_ENV: "production",
      })
    ).toThrow("APP_ORIGIN must use HTTPS")
  })

  it("allows only the canonical host and explicit normalized aliases", () => {
    const environment = {
      APP_ALLOWED_HOSTS: "www.arcticrss.com,xn--bcher-kva.example",
      APP_ORIGIN: "https://arcticrss.com",
    }

    expect(getAllowedAppHosts(environment)).toEqual(
      new Set([
        "arcticrss.com",
        "www.arcticrss.com",
        "xn--bcher-kva.example",
      ])
    )
    expect(isAllowedAppHost("ARCTICRSS.COM", environment)).toBe(true)
    expect(isAllowedAppHost("www.arcticrss.com", environment)).toBe(true)
    expect(isAllowedAppHost("arcticrss.com:444", environment)).toBe(false)
    expect(isAllowedAppHost("b\u00fccher.example", environment)).toBe(true)
    expect(normalizeRequestHost("arcticrss.com, attacker.example")).toBeNull()
  })

  it("never permits a protocol-relative path to replace the canonical origin", () => {
    expect(() => buildAppUrl("//attacker.example")).toThrow(
      AppOriginConfigurationError
    )
  })
})

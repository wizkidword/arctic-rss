import { describe, expect, it } from "vitest"

import {
  MobileAuthError,
  parseBrowserDeviceAuthorizationRequest,
  parseDeviceAuthorizationExchangeRequest,
} from "./mobile-auth"

describe("registered native authorization client", () => {
  it("accepts only the exact registered client and claimed HTTPS redirect in production", () => {
    expect(parseBrowserDeviceAuthorizationRequest(browserQuery(), { NODE_ENV: "production" })).toMatchObject({
      clientId: "android:com.arcticrss.reader",
      redirectUri: "https://arcticrss.com/mobile/auth/callback",
    })
    expect(parseDeviceAuthorizationExchangeRequest(exchangeRequest(), { NODE_ENV: "production" })).toMatchObject({
      clientId: "android:com.arcticrss.reader",
      redirectUri: "https://arcticrss.com/mobile/auth/callback",
    })
  })

  it("rejects a substituted client or custom-scheme redirect in production", () => {
    const substituted = browserQuery()
    substituted.set("client_id", "android:example.attacker")
    expect(() => parseBrowserDeviceAuthorizationRequest(substituted, { NODE_ENV: "production" }))
      .toThrow(MobileAuthError)

    const customScheme = browserQuery()
    customScheme.set("redirect_uri", "arcticrss://auth/callback")
    expect(() => parseBrowserDeviceAuthorizationRequest(customScheme, { NODE_ENV: "production" }))
      .toThrow(MobileAuthError)
  })

  it("permits the custom scheme only outside production for local development", () => {
    const development = browserQuery()
    development.set("redirect_uri", "arcticrss://auth/callback")

    expect(parseBrowserDeviceAuthorizationRequest(development, { NODE_ENV: "development" }).redirectUri)
      .toBe("arcticrss://auth/callback")
  })
})

function browserQuery() {
  return new URLSearchParams({
    app_version: "0.1.0-test",
    client_id: "android:com.arcticrss.reader",
    code_challenge: "a".repeat(43),
    code_challenge_method: "S256",
    device_name: "Test Android",
    nonce: "nonce-for-mobile-auth-test",
    platform: "android",
    redirect_uri: "https://arcticrss.com/mobile/auth/callback",
    state: "state-for-mobile-auth-test",
  })
}

function exchangeRequest() {
  return {
    clientId: "android:com.arcticrss.reader",
    code: "a".repeat(43),
    codeVerifier: "b".repeat(43),
    nonce: "nonce-for-mobile-auth-test",
    redirectUri: "https://arcticrss.com/mobile/auth/callback",
  }
}

import * as Crypto from "expo-crypto"
import * as WebBrowser from "expo-web-browser"

import { createPkceAuthorization, type MobileApiClient } from "@arctic-rss/mobile-client"

import { MOBILE_APP_VERSION, MOBILE_AUTH_REDIRECT_URI } from "@/config"

export class BrowserLoginError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "BrowserLoginError"
  }
}

export async function beginBrowserMobileLogin({
  api,
  origin,
}: {
  api: MobileApiClient
  origin: string
}) {
  const authorization = await createPkceAuthorization({
    randomBytes: (size) => Crypto.getRandomBytes(size),
    sha256: async (value) => new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, new TextEncoder().encode(value))),
  })
  const authorizationUrl = new URL("/api/mobile/authorize", origin)
  authorizationUrl.searchParams.set("app_version", MOBILE_APP_VERSION)
  authorizationUrl.searchParams.set("code_challenge", authorization.codeChallenge)
  authorizationUrl.searchParams.set("code_challenge_method", "S256")
  authorizationUrl.searchParams.set("device_name", "Arctic RSS Android")
  authorizationUrl.searchParams.set("nonce", authorization.nonce)
  authorizationUrl.searchParams.set("platform", "android")
  authorizationUrl.searchParams.set("redirect_uri", MOBILE_AUTH_REDIRECT_URI)
  authorizationUrl.searchParams.set("state", authorization.state)

  const result = await WebBrowser.openAuthSessionAsync(
    authorizationUrl.toString(),
    MOBILE_AUTH_REDIRECT_URI
  )
  if (result.type !== "success") {
    throw new BrowserLoginError("Sign in was cancelled before Arctic RSS could authorize this device.")
  }

  const callback = new URL(result.url)
  if (callback.protocol !== "arcticrss:" || callback.host !== "auth" || callback.pathname !== "/callback") {
    throw new BrowserLoginError("Arctic RSS returned an unexpected sign-in callback.")
  }
  const code = callback.searchParams.get("code")
  if (!code || callback.searchParams.get("state") !== authorization.state) {
    throw new BrowserLoginError("Arctic RSS could not verify the sign-in response.")
  }

  return (
    await api.exchangeAuthorizationCode({
      code,
      codeVerifier: authorization.codeVerifier,
      nonce: authorization.nonce,
      redirectUri: MOBILE_AUTH_REDIRECT_URI,
    })
  ).data
}

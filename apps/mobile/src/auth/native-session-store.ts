import * as SecureStore from "expo-secure-store"

import type { MobileTokenStore, StoredMobileTokens } from "@arctic-rss/mobile-client"

const ACCESS_TOKEN_KEY = "arcticrss.mobile.access-token.v1"
const ACCESS_EXPIRY_KEY = "arcticrss.mobile.access-expiry.v1"
const REFRESH_TOKEN_KEY = "arcticrss.mobile.refresh-token.v1"

export const nativeSessionStore: MobileTokenStore = {
  async clear() {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(ACCESS_EXPIRY_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    ])
  },

  async read() {
    const [accessToken, accessTokenExpiresAt, refreshToken] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.getItemAsync(ACCESS_EXPIRY_KEY),
      SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
    ])
    const expiry = Number(accessTokenExpiresAt)
    if (!accessToken || !refreshToken || !Number.isFinite(expiry) || expiry <= 0) {
      await nativeSessionStore.clear()
      return null
    }
    return {
      accessToken,
      accessTokenExpiresAt: expiry,
      accessTokenExpiresIn: Math.max(1, Math.floor((expiry - Date.now()) / 1_000)),
      refreshToken,
    } satisfies StoredMobileTokens
  },

  async write(tokens) {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken)
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken)
    await SecureStore.setItemAsync(ACCESS_EXPIRY_KEY, String(tokens.accessTokenExpiresAt))
  },
}

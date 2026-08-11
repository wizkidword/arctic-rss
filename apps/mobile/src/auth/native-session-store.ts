import * as SecureStore from "expo-secure-store"

import {
  MOBILE_TOKEN_BUNDLE_SCHEMA_VERSION,
  type MobileTokenStore,
  type StoredMobileTokens,
} from "@arctic-rss/mobile-client"

const TOKEN_BUNDLE_KEY = "arcticrss.mobile.token-bundle.v2"
const LEGACY_ACCESS_TOKEN_KEY = "arcticrss.mobile.access-token.v1"
const LEGACY_ACCESS_EXPIRY_KEY = "arcticrss.mobile.access-expiry.v1"
const LEGACY_REFRESH_TOKEN_KEY = "arcticrss.mobile.refresh-token.v1"
const TOKEN_BUNDLE_KEYS = new Set([
  "accessToken",
  "accessTokenExpiresAt",
  "accessTokenExpiresIn",
  "mobileDeviceId",
  "refreshToken",
  "schemaVersion",
  "userId",
])

type SecureStoreAdapter = Pick<
  typeof SecureStore,
  "deleteItemAsync" | "getItemAsync" | "setItemAsync"
>

export function createNativeSessionStore(
  secureStore: SecureStoreAdapter
): MobileTokenStore {
  const clearLegacy = () => Promise.all([
    secureStore.deleteItemAsync(LEGACY_ACCESS_TOKEN_KEY),
    secureStore.deleteItemAsync(LEGACY_ACCESS_EXPIRY_KEY),
    secureStore.deleteItemAsync(LEGACY_REFRESH_TOKEN_KEY),
  ])

  return {
    async clear() {
      await Promise.all([secureStore.deleteItemAsync(TOKEN_BUNDLE_KEY), clearLegacy()])
    },

    async read() {
      const serialized = await secureStore.getItemAsync(TOKEN_BUNDLE_KEY)
      if (serialized !== null) {
        const parsed = parseTokenBundle(serialized)
        if (parsed) {
          return parsed
        }
        await Promise.all([secureStore.deleteItemAsync(TOKEN_BUNDLE_KEY), clearLegacy()])
        return null
      }

      const [accessToken, accessTokenExpiresAt, refreshToken] = await Promise.all([
        secureStore.getItemAsync(LEGACY_ACCESS_TOKEN_KEY),
        secureStore.getItemAsync(LEGACY_ACCESS_EXPIRY_KEY),
        secureStore.getItemAsync(LEGACY_REFRESH_TOKEN_KEY),
      ])
      if (accessToken === null && accessTokenExpiresAt === null && refreshToken === null) {
        return null
      }
      // Alpha v1 never carried the authenticated owner/device identity needed
      // to authorize SQLite. Clearing it is safer than hydrating unowned cache.
      void accessTokenExpiresAt
      void accessToken
      void refreshToken
      await clearLegacy()
      return null
    },

    async write(tokens) {
      if (!isTokenBundle(tokens)) {
        throw new Error("The mobile token bundle is invalid.")
      }
      // SecureStore replaces this single string atomically. The old bundle is
      // left untouched if the replacement write rejects.
      await secureStore.setItemAsync(TOKEN_BUNDLE_KEY, JSON.stringify(tokens))
      try {
        await clearLegacy()
      } catch {
        // The v2 bundle is already durable. Legacy-key cleanup can retry on a
        // later launch without rolling back or invalidating the new session.
      }
    },
  }
}

export const nativeSessionStore = createNativeSessionStore(SecureStore)

function parseTokenBundle(serialized: string): StoredMobileTokens | null {
  try {
    const parsed: unknown = JSON.parse(serialized)
    return isTokenBundle(parsed) ? parsed : null
  } catch {
    return null
  }
}

function isTokenBundle(value: unknown): value is StoredMobileTokens {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false
  }
  const bundle = value as Record<string, unknown>
  if (
    Object.keys(bundle).length !== TOKEN_BUNDLE_KEYS.size ||
    Object.keys(bundle).some((key) => !TOKEN_BUNDLE_KEYS.has(key))
  ) {
    return false
  }
  return (
    bundle.schemaVersion === MOBILE_TOKEN_BUNDLE_SCHEMA_VERSION &&
    typeof bundle.accessToken === "string" && bundle.accessToken.length > 0 && bundle.accessToken.length <= 2_000 &&
    typeof bundle.refreshToken === "string" && bundle.refreshToken.length > 0 && bundle.refreshToken.length <= 512 &&
    typeof bundle.mobileDeviceId === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(bundle.mobileDeviceId) &&
    typeof bundle.userId === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(bundle.userId) &&
    typeof bundle.accessTokenExpiresAt === "number" && Number.isSafeInteger(bundle.accessTokenExpiresAt) && bundle.accessTokenExpiresAt > 0 &&
    typeof bundle.accessTokenExpiresIn === "number" && Number.isSafeInteger(bundle.accessTokenExpiresIn) && bundle.accessTokenExpiresIn > 0 && bundle.accessTokenExpiresIn <= 3_600
  )
}

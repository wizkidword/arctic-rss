export const MOBILE_APP_VERSION = "0.1.0-alpha"
export const MOBILE_PUBLIC_CLIENT_ID = "android:com.arcticrss.reader"
export const MOBILE_PRODUCTION_AUTH_REDIRECT_URI = "https://arcticrss.com/mobile/auth/callback"
export const MOBILE_DEVELOPMENT_AUTH_REDIRECT_URI = "arcticrss://auth/callback"
// Custom-scheme callbacks are strictly for local development. Signed Android
// builds use the claimed HTTPS App Link and must pass server-side registration.
export const MOBILE_AUTH_REDIRECT_URI = __DEV__
  ? MOBILE_DEVELOPMENT_AUTH_REDIRECT_URI
  : MOBILE_PRODUCTION_AUTH_REDIRECT_URI
const configuredMobileServiceOrigin = process.env.EXPO_PUBLIC_ARCTIC_RSS_ORIGIN?.trim()

if (__DEV__ && !configuredMobileServiceOrigin) {
  throw new Error("EXPO_PUBLIC_ARCTIC_RSS_ORIGIN is required for an Arctic RSS development build.")
}

export const MOBILE_SERVICE_ORIGIN = configuredMobileServiceOrigin || "https://arcticrss.com"
export const MOBILE_WEB_LINKS = {
  accountDeletion: "/delete-account",
  deviceManagement: "/app/settings/devices",
  privacy: "/privacy",
} as const

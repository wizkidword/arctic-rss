export const MOBILE_APP_VERSION = "0.1.0-alpha"
export const MOBILE_AUTH_REDIRECT_URI = "arcticrss://auth/callback"
export const MOBILE_SERVICE_ORIGIN =
  process.env.EXPO_PUBLIC_ARCTIC_RSS_ORIGIN?.trim() || "https://arcticrss.com"
export const MOBILE_WEB_LINKS = {
  accountDeletion: "/delete-account",
  deviceManagement: "/app/settings/devices",
  privacy: "/privacy",
} as const

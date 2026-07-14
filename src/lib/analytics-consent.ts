export const ANALYTICS_CONSENT_STORAGE_KEY = "arcticrss.analytics-consent.v1"
export const ANALYTICS_CONSENT_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000

export type AnalyticsConsentChoice = "accepted" | "necessary"

type StoredAnalyticsConsent = {
  choice: AnalyticsConsentChoice
  updatedAt: string
}

function isStoredConsent(value: unknown): value is StoredAnalyticsConsent {
  return Boolean(
    value &&
      typeof value === "object" &&
      "choice" in value &&
      "updatedAt" in value &&
      ((value as StoredAnalyticsConsent).choice === "accepted" ||
        (value as StoredAnalyticsConsent).choice === "necessary") &&
      typeof (value as StoredAnalyticsConsent).updatedAt === "string"
  )
}

export function readAnalyticsConsent(
  storage: Pick<Storage, "getItem">,
  now = Date.now()
): AnalyticsConsentChoice | null {
  const rawValue = storage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)

  if (!rawValue) {
    return null
  }

  try {
    const parsed: unknown = JSON.parse(rawValue)

    if (!isStoredConsent(parsed)) {
      return null
    }

    const updatedAt = new Date(parsed.updatedAt).getTime()

    if (!Number.isFinite(updatedAt) || now - updatedAt > ANALYTICS_CONSENT_MAX_AGE_MS) {
      return null
    }

    return parsed.choice
  } catch {
    return null
  }
}

export function writeAnalyticsConsent(
  storage: Pick<Storage, "setItem">,
  choice: AnalyticsConsentChoice,
  now = new Date()
) {
  storage.setItem(
    ANALYTICS_CONSENT_STORAGE_KEY,
    JSON.stringify({ choice, updatedAt: now.toISOString() } satisfies StoredAnalyticsConsent)
  )
}

export function hasAnalyticsConsent() {
  return (
    typeof window !== "undefined" &&
    readAnalyticsConsent(window.localStorage) === "accepted"
  )
}

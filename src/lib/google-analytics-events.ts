export type AnalyticsEventName =
  | "create_account_click"
  | "demo_create_account_click"
  | "demo_start"
  | "first_source_subscribed"
  | "guest_browse_start"
  | "sign_up"
  | "sign_up_start"
  | "source_subscribe"

export type AnalyticsEventParams = Record<
  string,
  boolean | number | string | undefined
>

type GtagEvent = (
  command: "event",
  eventName: AnalyticsEventName,
  params: Record<string, boolean | number | string>
) => void

export function trackAnalyticsEvent(
  eventName: AnalyticsEventName,
  params: AnalyticsEventParams = {}
) {
  if (typeof window === "undefined" || !hasAnalyticsConsent()) {
    return
  }

  const gtag = (window as Window & { gtag?: GtagEvent }).gtag

  if (!gtag) {
    return
  }

  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined)
  ) as Record<string, boolean | number | string>

  gtag("event", eventName, cleanParams)
}

export function trackSourceSubscription({
  firstSourceSubscribed,
  sourceType,
  subscribeSurface,
}: {
  firstSourceSubscribed: boolean
  sourceType: "feed" | "podcast"
  subscribeSurface: "discover" | "manual" | "podcasts"
}) {
  trackAnalyticsEvent("source_subscribe", {
    source_type: sourceType,
    subscribe_surface: subscribeSurface,
  })

  if (firstSourceSubscribed) {
    trackAnalyticsEvent("first_source_subscribed", {
      source_type: sourceType,
    })
  }
}
import { hasAnalyticsConsent } from "./analytics-consent"

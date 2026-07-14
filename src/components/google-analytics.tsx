"use client"

import { useEffect, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"

import { hasAnalyticsConsent } from "@/lib/analytics-consent"

type GoogleAnalyticsProps = {
  measurementId: string
}

type GtagArguments =
  | ["js", Date]
  | ["config", string, Record<string, boolean | string>]

type Gtag = (...args: GtagArguments) => void

const GOOGLE_ANALYTICS_SCRIPT_ID = "arctic-rss-google-analytics"

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: Gtag
  }
}

function ensureGtag() {
  window.dataLayer = window.dataLayer ?? []
  window.gtag =
    window.gtag ??
    ((...args: GtagArguments) => {
      window.dataLayer?.push(args)
    })
}

function loadGoogleAnalyticsScript(measurementId: string) {
  if (document.getElementById(GOOGLE_ANALYTICS_SCRIPT_ID)) {
    return
  }

  const script = document.createElement("script")
  script.async = true
  script.id = GOOGLE_ANALYTICS_SCRIPT_ID
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
    measurementId
  )}`
  document.head.append(script)
}

function analyticsPagePath(pathname: string, searchParams: URLSearchParams) {
  const queryString = searchParams.toString()

  return queryString ? `${pathname}?${queryString}` : pathname
}

function pageViewConfig(pagePath: string) {
  return {
    allow_ad_personalization_signals: false,
    allow_google_signals: false,
    page_location: new URL(pagePath, window.location.origin).href,
    page_path: pagePath,
    page_title: document.title,
  }
}

export function GoogleAnalytics({ measurementId }: GoogleAnalyticsProps) {
  const normalizedMeasurementId = measurementId.trim()
  const initialPageViewTrackedRef = useRef(false)
  const lastTrackedPagePathRef = useRef<string | null>(null)
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!normalizedMeasurementId || !pathname || !hasAnalyticsConsent()) {
      return
    }

    ensureGtag()
    const gtag = window.gtag

    if (!gtag) {
      return
    }

    const pagePath = analyticsPagePath(pathname, searchParams)

    if (!initialPageViewTrackedRef.current) {
      initialPageViewTrackedRef.current = true
      gtag("js", new Date())
      loadGoogleAnalyticsScript(normalizedMeasurementId)
    }

    if (lastTrackedPagePathRef.current === pagePath) {
      return
    }

    lastTrackedPagePathRef.current = pagePath

    gtag(
      "config",
      normalizedMeasurementId,
      pageViewConfig(pagePath)
    )
  }, [normalizedMeasurementId, pathname, searchParams])

  if (!normalizedMeasurementId) {
    return null
  }

  return null
}

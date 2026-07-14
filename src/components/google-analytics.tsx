"use client"

import { useEffect, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"

import { hasAnalyticsConsent } from "@/lib/analytics-consent"

type GoogleAnalyticsProps = {
  measurementId: string
}

type GtagArguments =
  | ["config", string, Record<string, boolean | string>]

type Gtag = (...args: GtagArguments) => void

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

export function GoogleAnalytics({ measurementId }: GoogleAnalyticsProps) {
  const normalizedMeasurementId = measurementId.trim()
  const initialPageViewTrackedRef = useRef(false)
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!normalizedMeasurementId || !pathname || !hasAnalyticsConsent()) {
      return
    }

    if (!initialPageViewTrackedRef.current) {
      initialPageViewTrackedRef.current = true
      return
    }

    ensureGtag()
    const gtag = window.gtag

    if (!gtag) {
      return
    }

    const queryString = searchParams.toString()
    const pagePath = queryString ? `${pathname}?${queryString}` : pathname
    const pageLocation = new URL(pagePath, window.location.origin).href

    gtag("config", normalizedMeasurementId, {
      page_location: pageLocation,
      page_path: pagePath,
      page_title: document.title,
    })
  }, [normalizedMeasurementId, pathname, searchParams])

  if (!normalizedMeasurementId) {
    return null
  }

  return null
}

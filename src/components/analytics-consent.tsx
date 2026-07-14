"use client"

import { Suspense, useEffect, useState, useSyncExternalStore } from "react"

import { GoogleAnalytics } from "@/components/google-analytics"
import {
  readAnalyticsConsent,
  type AnalyticsConsentChoice,
  writeAnalyticsConsent,
} from "@/lib/analytics-consent"

type AnalyticsConsentProps = {
  measurementId: string
}

export function AnalyticsConsent({ measurementId }: AnalyticsConsentProps) {
  const normalizedMeasurementId = measurementId.trim()
  const choice = useSyncExternalStore(
    subscribeToAnalyticsConsent,
    getAnalyticsConsentSnapshot,
    getServerAnalyticsConsentSnapshot
  )
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    if (!normalizedMeasurementId || choice === null) {
      return
    }

    ;(window as unknown as Record<string, boolean>)[
      `ga-disable-${normalizedMeasurementId}`
    ] = choice !== "accepted"
  }, [choice, normalizedMeasurementId])

  function choose(nextChoice: AnalyticsConsentChoice) {
    writeAnalyticsConsent(window.localStorage, nextChoice)
    window.dispatchEvent(new Event("arctic-rss:analytics-consent"))
    setSettingsOpen(false)
  }

  if (!normalizedMeasurementId) {
    return null
  }

  const showChoices = choice === null || settingsOpen

  return (
    <>
      {choice === "accepted" ? (
        <Suspense fallback={null}>
          <GoogleAnalytics measurementId={normalizedMeasurementId} />
        </Suspense>
      ) : null}
      {showChoices ? (
        <aside
          aria-label="Analytics preference"
          className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-4 shadow-2xl"
        >
          <p className="text-sm font-semibold text-slate-950">Optional analytics</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Optional analytics are off unless you allow them. Necessary-only keeps essential
            functionality without optional analytics.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              className="rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white"
              onClick={() => choose("accepted")}
              type="button"
            >
              Allow optional analytics
            </button>
            <button
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800"
              onClick={() => choose("necessary")}
              type="button"
            >
              Necessary only
            </button>
          </div>
        </aside>
      ) : (
        <button
          aria-label="Change analytics preference"
          className="fixed bottom-3 right-3 z-40 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm"
          onClick={() => setSettingsOpen(true)}
          type="button"
        >
          Privacy choices
        </button>
      )}
    </>
  )
}

function subscribeToAnalyticsConsent(onStoreChange: () => void) {
  window.addEventListener("arctic-rss:analytics-consent", onStoreChange)
  window.addEventListener("storage", onStoreChange)

  return () => {
    window.removeEventListener("arctic-rss:analytics-consent", onStoreChange)
    window.removeEventListener("storage", onStoreChange)
  }
}

function getAnalyticsConsentSnapshot() {
  return readAnalyticsConsent(window.localStorage)
}

function getServerAnalyticsConsentSnapshot() {
  return null
}

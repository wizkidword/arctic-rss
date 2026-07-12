"use client"

import Link from "next/link"
import type { ComponentProps } from "react"

import {
  trackAnalyticsEvent,
  type AnalyticsEventName,
  type AnalyticsEventParams,
} from "@/lib/google-analytics-events"

type AnalyticsLinkProps = ComponentProps<typeof Link> & {
  analyticsEvent?: AnalyticsEventName
  analyticsParams?: AnalyticsEventParams
}

export function AnalyticsLink({
  analyticsEvent,
  analyticsParams,
  onClick,
  ...props
}: AnalyticsLinkProps) {
  const handleClick: ComponentProps<typeof Link>["onClick"] = (event) => {
    if (analyticsEvent) {
      trackAnalyticsEvent(analyticsEvent, analyticsParams)
    }

    onClick?.(event)
  }

  return <Link {...props} onClick={handleClick} />
}

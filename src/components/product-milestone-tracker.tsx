"use client"

import { useEffect } from "react"

import {
  PRODUCT_MILESTONE_COOKIE,
  type ProductMilestoneEvent,
} from "@/lib/product-milestone-events"
import { trackAnalyticsEvent } from "@/lib/google-analytics-events"

export function ProductMilestoneTracker({
  milestones,
}: {
  milestones: ProductMilestoneEvent[]
}) {
  const milestoneKey = milestones.join(",")

  useEffect(() => {
    if (!milestoneKey) {
      return
    }

    milestoneKey
      .split(",")
      .forEach((milestone) => trackAnalyticsEvent(milestone as ProductMilestoneEvent))
    document.cookie = `${PRODUCT_MILESTONE_COOKIE}=; Max-Age=0; Path=/app; SameSite=Lax`
  }, [milestoneKey])

  return null
}

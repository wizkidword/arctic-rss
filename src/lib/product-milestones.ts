import { cookies } from "next/headers"

import { getPrisma } from "./db"
import {
  parseProductMilestones,
  PRODUCT_MILESTONE_COOKIE,
  type ProductMilestoneEvent,
} from "./product-milestone-events"

export { parseProductMilestones, PRODUCT_MILESTONE_COOKIE }
export type { ProductMilestoneEvent }

export async function isFirstArticleOpenedForUser(userId: string) {
  const existing = await getPrisma().articleState.findFirst({
    select: { id: true },
    where: { isRead: true, userId },
  })

  return !existing
}

export async function isFirstArticleStarredForUser(userId: string) {
  const existing = await getPrisma().articleState.findFirst({
    select: { id: true },
    where: { isStarred: true, userId },
  })

  return !existing
}

export async function isFirstCollectionSaveForUser(userId: string) {
  const existing = await getPrisma().articleCollectionItem.findFirst({
    select: { id: true },
    where: { collection: { userId } },
  })

  return !existing
}

export async function isFirstSavedViewForUser(userId: string) {
  const existing = await getPrisma().savedSearch.findFirst({
    select: { id: true },
    where: { userId },
  })

  return !existing
}

export async function queueProductMilestone(event: ProductMilestoneEvent) {
  const store = await cookies()
  const current = parseProductMilestones(store.get(PRODUCT_MILESTONE_COOKIE)?.value)

  if (current.includes(event)) {
    return
  }

  store.set(PRODUCT_MILESTONE_COOKIE, [...current, event].join(","), {
    maxAge: 60,
    path: "/app",
    sameSite: "lax",
  })
}

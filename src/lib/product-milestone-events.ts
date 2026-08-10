export const PRODUCT_MILESTONE_COOKIE = "arcticrss_product_milestones"

export const productMilestoneEvents = [
  "first_article_opened",
  "first_article_starred",
  "first_collection_saved",
  "first_saved_view",
] as const

export type ProductMilestoneEvent = (typeof productMilestoneEvents)[number]

const productMilestoneEventSet = new Set<string>(productMilestoneEvents)

export function parseProductMilestones(value: string | undefined) {
  if (!value) {
    return []
  }

  return [...new Set(value.split(","))].filter(
    (event): event is ProductMilestoneEvent => productMilestoneEventSet.has(event)
  )
}

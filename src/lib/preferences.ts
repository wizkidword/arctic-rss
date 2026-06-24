export const VIEW_OPTIONS = ["CLASSIC", "CARD", "COMPACT", "RIVER"] as const

export type DefaultView = (typeof VIEW_OPTIONS)[number]

export const DEFAULT_VIEW: DefaultView = "CLASSIC"

export const viewOptionLabels: Record<DefaultView, string> = {
  CLASSIC: "Classic",
  CARD: "Card",
  COMPACT: "Compact",
  RIVER: "River",
}

export function isDefaultView(value: unknown): value is DefaultView {
  return typeof value === "string" && VIEW_OPTIONS.includes(value as DefaultView)
}

export function normalizeDefaultView(value: unknown): DefaultView {
  return isDefaultView(value) ? value : DEFAULT_VIEW
}

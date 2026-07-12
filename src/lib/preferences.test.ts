import { describe, expect, it } from "vitest"

import {
  DEFAULT_VIEW,
  VIEW_OPTIONS,
  normalizeDefaultView,
  viewOptionLabels,
} from "./preferences"

describe("reader view preferences", () => {
  it("keeps only supported reader views in the plan order", () => {
    expect(VIEW_OPTIONS).toEqual(["CLASSIC", "CARD", "COMPACT", "RIVER"])
    expect(viewOptionLabels).toEqual({
      CLASSIC: "Classic",
      CARD: "Card",
      COMPACT: "Compact",
      RIVER: "River",
    })
  })

  it("falls back to the classic reader for unknown stored values", () => {
    expect(DEFAULT_VIEW).toBe("CLASSIC")
    expect(normalizeDefaultView("MAGAZINE")).toBe("CLASSIC")
    expect(normalizeDefaultView(null)).toBe("CLASSIC")
  })
})

import { describe, expect, it } from "vitest"

import { parseProductMilestones } from "./product-milestone-events"

describe("parseProductMilestones", () => {
  it("keeps only known low-cardinality milestone names once", () => {
    expect(
      parseProductMilestones(
        "first_article_opened,unknown,first_article_opened,first_saved_view"
      )
    ).toEqual(["first_article_opened", "first_saved_view"])
  })
})

import { describe, expect, it } from "vitest"

import { mergeMobilePageItems } from "../lib/mobile-pagination"

describe("mobile pagination merge", () => {
  it("preserves first-seen stable ordering while suppressing duplicate IDs", () => {
    expect(
      mergeMobilePageItems(
        [{ id: "article-3" }, { id: "article-2" }],
        [{ id: "article-2" }, { id: "article-1" }],
        (item) => item.id
      )
    ).toEqual({
      isTruncated: false,
      items: [{ id: "article-3" }, { id: "article-2" }, { id: "article-1" }],
    })
  })

  it("bounds merged pages before they can grow without limit", () => {
    expect(
      mergeMobilePageItems(
        [{ id: "article-3" }, { id: "article-2" }],
        [{ id: "article-1" }],
        (item) => item.id,
        2
      )
    ).toEqual({
      isTruncated: true,
      items: [{ id: "article-3" }, { id: "article-2" }],
    })
  })
})

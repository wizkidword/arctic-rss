import { describe, expect, it } from "vitest"

import { safeMobileReturnPath } from "./safe-mobile-return-path"

describe("safeMobileReturnPath", () => {
  it("keeps recognized protected deep links", () => {
    expect(safeMobileReturnPath("/articles/article-1")).toBe("/articles/article-1")
    expect(safeMobileReturnPath("/collection-picker")).toBe("/collection-picker")
    expect(safeMobileReturnPath(["/settings", "/articles/ignored"])).toBe("/settings")
  })

  it("rejects public, malformed, and external return paths", () => {
    expect(safeMobileReturnPath(undefined)).toBeNull()
    expect(safeMobileReturnPath("/")).toBeNull()
    expect(safeMobileReturnPath("//example.com")).toBeNull()
    expect(safeMobileReturnPath("https://example.com")).toBeNull()
    expect(safeMobileReturnPath("/articles/article-1?collectionId=collection-1")).toBeNull()
  })
})

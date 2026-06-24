import { describe, expect, it } from "vitest"

import {
  articleDetailHref,
  articleSelectionHref,
  findAdjacentReaderArticleId,
  readerShortcutFromKey,
  shouldIgnoreReaderShortcutTarget,
} from "./reader-navigation"

const articles = [
  { id: "article-1" },
  { id: "article-2" },
  { id: "article-3" },
]

describe("reader navigation", () => {
  it("builds query-based selection URLs for reader list contexts", () => {
    expect(articleSelectionHref("/app/feed/subscription-1", "article/1")).toBe(
      "/app/feed/subscription-1?articleId=article%2F1"
    )
  })

  it("builds stable article detail URLs", () => {
    expect(articleDetailHref("article/1")).toBe("/app/article/article%2F1")
  })

  it("finds adjacent articles without wrapping at the boundaries", () => {
    expect(findAdjacentReaderArticleId(articles, "article-1", "next")).toBe(
      "article-2"
    )
    expect(findAdjacentReaderArticleId(articles, "article-1", "previous")).toBe(
      "article-1"
    )
    expect(findAdjacentReaderArticleId(articles, "article-3", "next")).toBe(
      "article-3"
    )
  })

  it("maps Google Reader-style shortcut keys and ignores modified keys", () => {
    expect(readerShortcutFromKey({ key: "j" })).toBe("next")
    expect(readerShortcutFromKey({ key: "K" })).toBe("previous")
    expect(readerShortcutFromKey({ key: "m" })).toBe("toggleRead")
    expect(readerShortcutFromKey({ key: "s" })).toBe("toggleStarred")
    expect(readerShortcutFromKey({ key: "v" })).toBe("openOriginal")
    expect(readerShortcutFromKey({ ctrlKey: true, key: "j" })).toBeNull()
    expect(readerShortcutFromKey({ key: "x" })).toBeNull()
  })

  it("ignores shortcuts only while typing into text-entry targets", () => {
    expect(shouldIgnoreReaderShortcutTarget({ tagName: "INPUT" })).toBe(true)
    expect(shouldIgnoreReaderShortcutTarget({ tagName: "TEXTAREA" })).toBe(true)
    expect(shouldIgnoreReaderShortcutTarget({ tagName: "SELECT" })).toBe(true)
    expect(shouldIgnoreReaderShortcutTarget({ isContentEditable: true })).toBe(
      true
    )
    expect(shouldIgnoreReaderShortcutTarget({ tagName: "BUTTON" })).toBe(false)
  })
})

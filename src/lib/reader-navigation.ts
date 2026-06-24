export type ReaderShortcut =
  | "next"
  | "openOriginal"
  | "previous"
  | "toggleRead"
  | "toggleStarred"

export type ReaderShortcutKeyEvent = {
  altKey?: boolean
  ctrlKey?: boolean
  key: string
  metaKey?: boolean
}

export type ReaderShortcutTarget = {
  isContentEditable?: boolean
  tagName?: string
} | null

export function articleSelectionHref(basePath: string, articleId: string) {
  return `${basePath}?articleId=${encodeURIComponent(articleId)}`
}

export function articleDetailHref(articleId: string) {
  return `/app/article/${encodeURIComponent(articleId)}`
}

export function findAdjacentReaderArticleId(
  articles: Array<{ id: string }>,
  selectedArticleId: string | undefined,
  direction: "next" | "previous"
) {
  if (!articles.length) {
    return null
  }

  const selectedIndex = Math.max(
    0,
    articles.findIndex((article) => article.id === selectedArticleId)
  )
  const targetIndex =
    direction === "next"
      ? Math.min(articles.length - 1, selectedIndex + 1)
      : Math.max(0, selectedIndex - 1)

  return articles[targetIndex]?.id ?? null
}

export function readerShortcutFromKey(
  event: ReaderShortcutKeyEvent
): ReaderShortcut | null {
  if (event.altKey || event.ctrlKey || event.metaKey) {
    return null
  }

  switch (event.key.toLowerCase()) {
    case "j":
      return "next"
    case "k":
      return "previous"
    case "m":
      return "toggleRead"
    case "s":
      return "toggleStarred"
    case "v":
      return "openOriginal"
    default:
      return null
  }
}

export function shouldIgnoreReaderShortcutTarget(
  target: ReaderShortcutTarget
) {
  if (!target) {
    return false
  }

  if (target.isContentEditable) {
    return true
  }

  return ["input", "select", "textarea"].includes(
    target.tagName?.toLowerCase() ?? ""
  )
}

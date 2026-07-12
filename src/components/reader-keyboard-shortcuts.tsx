"use client"

import { useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"

import {
  setArticleReadAction,
  setArticleStarredAction,
} from "@/app/app/actions"
import {
  articleSelectionHref,
  findAdjacentReaderArticleId,
  readerShortcutFromKey,
  shouldIgnoreReaderShortcutTarget,
} from "@/lib/reader-navigation"

type ShortcutArticle = {
  id: string
  isRead: boolean
  isStarred: boolean
  url: string
}

export function ReaderKeyboardShortcuts({
  articles,
  basePath,
  readOnlyActionReason,
  selectedArticleId,
}: {
  articles: ShortcutArticle[]
  basePath: string
  readOnlyActionReason?: string
  selectedArticleId?: string
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isTextEntryTarget(event.target)) {
        return
      }

      const shortcut = readerShortcutFromKey(event)

      if (!shortcut) {
        return
      }

      const selectedArticle =
        articles.find((article) => article.id === selectedArticleId) ??
        articles[0]

      if (!selectedArticle) {
        return
      }

      if (shortcut === "next" || shortcut === "previous") {
        const adjacentArticleId = findAdjacentReaderArticleId(
          articles,
          selectedArticle.id,
          shortcut
        )

        if (adjacentArticleId && adjacentArticleId !== selectedArticle.id) {
          event.preventDefault()
          router.push(articleSelectionHref(basePath, adjacentArticleId))
        }

        return
      }

      event.preventDefault()

      if (shortcut === "toggleRead") {
        if (readOnlyActionReason) {
          return
        }

        startTransition(() => {
          const formData = new FormData()
          formData.set("articleId", selectedArticle.id)
          formData.set("isRead", selectedArticle.isRead ? "false" : "true")
          void setArticleReadAction(formData)
        })
        return
      }

      if (shortcut === "toggleStarred") {
        if (readOnlyActionReason) {
          return
        }

        startTransition(() => {
          const formData = new FormData()
          formData.set("articleId", selectedArticle.id)
          formData.set(
            "isStarred",
            selectedArticle.isStarred ? "false" : "true"
          )
          void setArticleStarredAction(formData)
        })
        return
      }

      window.open(selectedArticle.url, "_blank", "noopener,noreferrer")
    }

    window.addEventListener("keydown", onKeyDown)

    return () => {
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [
    articles,
    basePath,
    readOnlyActionReason,
    router,
    selectedArticleId,
    startTransition,
  ])

  return null
}

function isTextEntryTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return (
    shouldIgnoreReaderShortcutTarget(target) ||
    Boolean(target.closest("[contenteditable='true']"))
  )
}

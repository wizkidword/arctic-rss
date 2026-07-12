"use client"

import { useEffect, useTransition } from "react"

import { markArticleReadOnOpen } from "@/app/app/actions"

export function ArticleReadTracker({
  articleId,
  isRead,
}: {
  articleId: string
  isRead: boolean
}) {
  const [, startTransition] = useTransition()

  useEffect(() => {
    if (isRead) {
      return
    }

    startTransition(() => {
      void markArticleReadOnOpen(articleId)
    })
  }, [articleId, isRead, startTransition])

  return null
}

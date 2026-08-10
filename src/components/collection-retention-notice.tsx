"use client"

import { useActionState } from "react"

import {
  followCollectionArticleSourceAction,
  removeArticleFromCollectionAction,
  type FollowCollectionArticleSourceActionState,
} from "@/app/app/actions"
import { Button } from "@/components/ui/button"

const initialState: FollowCollectionArticleSourceActionState = {
  message: "",
  status: "idle",
}

export function CollectionRetentionNotice({
  articleId,
  collectionId,
  feedTitle,
  savedAt,
  sourceIsFollowed,
}: {
  articleId: string
  collectionId?: string
  feedTitle: string
  savedAt: string
  sourceIsFollowed: boolean
}) {
  const [state, action, pending] = useActionState(
    followCollectionArticleSourceAction,
    initialState
  )

  return (
    <aside
      className={
        sourceIsFollowed
          ? "rounded-md border bg-muted/35 p-2 text-xs leading-5 text-foreground"
          : "rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs leading-5 text-foreground"
      }
    >
      <p>
        <span className="font-medium">
          {sourceIsFollowed ? "Saved to this collection." : "Saved copy."}
        </span>{" "}
        Saved from {feedTitle} on {savedAt}.{" "}
        {sourceIsFollowed
          ? "You still follow this source."
          : "You no longer follow this source, but this collection keeps the article available."}
      </p>
      {!sourceIsFollowed && collectionId ? (
        <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
          <input name="articleId" type="hidden" value={articleId} />
          <input name="collectionId" type="hidden" value={collectionId} />
          <Button disabled={pending} size="xs" type="submit" variant="outline">
            {pending ? "Following source…" : "Follow source again"}
          </Button>
          {state.status !== "idle" ? (
            <p
              aria-live="polite"
              className={
                state.status === "error" ? "text-destructive" : "text-muted-foreground"
              }
            >
              {state.message}
            </p>
          ) : null}
        </form>
      ) : null}
      {collectionId ? (
        <form action={removeArticleFromCollectionAction} className="mt-2 flex flex-wrap items-center gap-2">
          <input name="articleId" type="hidden" value={articleId} />
          <input name="collectionId" type="hidden" value={collectionId} />
          <Button size="xs" type="submit" variant="ghost">
            Remove from collection
          </Button>
          <p className="text-muted-foreground">
            {sourceIsFollowed
              ? "Removing this saved copy does not affect your source subscription."
              : "If this is your last saved collection copy, removing it will remove access unless you follow the source again."}
          </p>
        </form>
      ) : null}
    </aside>
  )
}

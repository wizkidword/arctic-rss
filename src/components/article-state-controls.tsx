import { CheckIcon, CircleIcon, StarIcon } from "lucide-react"

import {
  markAllReadAction,
  setArticleReadAction,
  setArticleStarredAction,
} from "@/app/app/actions"
import { Button } from "@/components/ui/button"
import { type ArticleReadScope, type ReaderArticle } from "@/lib/articles"
import { cn } from "@/lib/utils"

export function ArticleStateControls({
  article,
  readOnlyReason,
  size = "sm",
}: {
  article: ReaderArticle
  readOnlyReason?: string
  size?: "xs" | "sm"
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <form action={setArticleReadAction}>
        <input name="articleId" type="hidden" value={article.id} />
        <input
          name="isRead"
          type="hidden"
          value={article.isRead ? "false" : "true"}
        />
        <Button
          disabled={Boolean(readOnlyReason)}
          size={size}
          title={readOnlyReason}
          type="submit"
          variant="outline"
        >
          {article.isRead ? (
            <CircleIcon data-icon="inline-start" />
          ) : (
            <CheckIcon data-icon="inline-start" />
          )}
          {article.isRead ? "Unread" : "Read"}
        </Button>
      </form>
      <form action={setArticleStarredAction}>
        <input name="articleId" type="hidden" value={article.id} />
        <input
          name="isStarred"
          type="hidden"
          value={article.isStarred ? "false" : "true"}
        />
        <Button
          disabled={Boolean(readOnlyReason)}
          size={size}
          title={readOnlyReason}
          type="submit"
          variant="outline"
        >
          <StarIcon
            className={cn(article.isStarred && "fill-current")}
            data-icon="inline-start"
          />
          {article.isStarred ? "Unstar" : "Star"}
        </Button>
      </form>
    </div>
  )
}

export function MarkAllReadButton({
  disabled = false,
  readOnlyReason,
  scope,
}: {
  disabled?: boolean
  readOnlyReason?: string
  scope: ArticleReadScope
}) {
  return (
    <form action={markAllReadAction}>
      <input name="scope" type="hidden" value={scope.type} />
      {scope.type === "feed" && (
        <input name="feedId" type="hidden" value={scope.feedId} />
      )}
      {scope.type === "folder" && (
        <input name="folderId" type="hidden" value={scope.folderId} />
      )}
      <Button
        disabled={disabled || Boolean(readOnlyReason)}
        title={readOnlyReason}
        type="submit"
        variant="outline"
      >
        <CheckIcon data-icon="inline-start" />
        Mark all read
      </Button>
    </form>
  )
}

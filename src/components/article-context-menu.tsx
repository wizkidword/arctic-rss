"use client"

import {
  type ComponentProps,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useActionState,
  useCallback,
  useEffect,
  useId,
  useState,
  useTransition,
} from "react"
import { createPortal } from "react-dom"
import {
  ArchiveXIcon,
  CheckCheckIcon,
  CheckIcon,
  CircleIcon,
  FolderPlusIcon,
  Share2Icon,
  SparklesIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react"

import {
  addArticleToCollectionAction,
  type AddArticleToCollectionActionState,
  deleteArticleAction,
  generateArticleSummaryAction,
  type GenerateArticleSummaryActionState,
  markAllReadAction,
  removeArticleFromCollectionAction,
  setArticleReadAction,
  setArticleStarredAction,
} from "@/app/app/actions"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { type ArticleCollectionPickerItem } from "@/lib/article-collections"
import { cn } from "@/lib/utils"

export type ArticleContextMenuArticle = {
  feedId: string
  id: string
  isRead: boolean
  isStarred: boolean
  title: string
  url: string
}

export type ActiveArticleCollection = {
  id: string
  name: string
}

type MenuPosition = {
  x: number
  y: number
}

const menuItemClass =
  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0"

const MENU_WIDTH = 224
const MENU_ESTIMATED_HEIGHT = 344
const MENU_VIEWPORT_GAP = 8
const NEW_COLLECTION_VALUE = "new-collection"
const collectionInitialState: AddArticleToCollectionActionState = {
  message: "",
  status: "idle",
}
const summaryInitialState: GenerateArticleSummaryActionState = {
  message: "",
  status: "idle",
}
const EMPTY_COLLECTIONS: ArticleCollectionPickerItem[] = []

export function ArticleContextMenu({
  article,
  as = "div",
  children,
  className,
  collections = EMPTY_COLLECTIONS,
  currentCollection,
  inlineActions = false,
  readOnlyReason,
}: {
  article: ArticleContextMenuArticle
  as?: "article" | "div"
  children: ReactNode
  className?: string
  collections?: ArticleCollectionPickerItem[]
  currentCollection?: ActiveArticleCollection
  inlineActions?: boolean
  readOnlyReason?: string
}) {
  const menuId = useId()
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null)
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false)
  const [collectionOpenSession, setCollectionOpenSession] = useState(0)
  const [, startTransition] = useTransition()
  const menuOpen = menuPosition !== null
  const Wrapper = as
  const closeCollectionDialog = useCallback(
    () => setCollectionDialogOpen(false),
    []
  )

  useEffect(() => {
    if (!menuOpen) {
      return
    }

    function closeMenu() {
      setMenuPosition(null)
    }

    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu()
      }
    }

    window.addEventListener("resize", closeMenu)
    window.addEventListener("scroll", closeMenu, true)
    document.addEventListener("pointerdown", closeMenu)
    document.addEventListener("keydown", closeOnEscape)

    return () => {
      window.removeEventListener("resize", closeMenu)
      window.removeEventListener("scroll", closeMenu, true)
      document.removeEventListener("pointerdown", closeMenu)
      document.removeEventListener("keydown", closeOnEscape)
    }
  }, [menuOpen])

  function openMenuAt(x: number, y: number) {
    setMenuPosition(clampMenuToViewport(x, y))
  }

  function onContextMenu(event: MouseEvent<HTMLElement>) {
    event.preventDefault()
    openMenuAt(event.clientX, event.clientY)
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) {
      return
    }

    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    openMenuAt(rect.left + 16, rect.bottom + 4)
  }

  function toggleRead() {
    if (readOnlyReason) {
      return
    }

    setMenuPosition(null)
    startTransition(() => {
      const formData = new FormData()
      formData.set("articleId", article.id)
      formData.set("isRead", article.isRead ? "false" : "true")
      void setArticleReadAction(formData)
    })
  }

  function toggleStarred() {
    if (readOnlyReason) {
      return
    }

    setMenuPosition(null)
    startTransition(() => {
      const formData = new FormData()
      formData.set("articleId", article.id)
      formData.set("isStarred", article.isStarred ? "false" : "true")
      void setArticleStarredAction(formData)
    })
  }

  function markFeedRead() {
    if (readOnlyReason) {
      return
    }

    setMenuPosition(null)
    startTransition(() => {
      const formData = new FormData()
      formData.set("scope", "feed")
      formData.set("feedId", article.feedId)
      void markAllReadAction(formData)
    })
  }

  function markAllRead() {
    if (readOnlyReason) {
      return
    }

    setMenuPosition(null)
    startTransition(() => {
      const formData = new FormData()
      formData.set("scope", "all")
      void markAllReadAction(formData)
    })
  }

  function openCollectionDialog() {
    if (readOnlyReason) {
      return
    }

    setMenuPosition(null)
    setCollectionOpenSession((session) => session + 1)
    setCollectionDialogOpen(true)
  }

  function removeFromCurrentCollection() {
    if (readOnlyReason) {
      return
    }

    if (!currentCollection) {
      return
    }

    setMenuPosition(null)
    startTransition(() => {
      const formData = new FormData()
      formData.set("articleId", article.id)
      formData.set("collectionId", currentCollection.id)
      void removeArticleFromCollectionAction(formData)
    })
  }

  function deleteArticle() {
    if (readOnlyReason) {
      return
    }

    setMenuPosition(null)
    startTransition(() => {
      const formData = new FormData()
      formData.set("articleId", article.id)
      void deleteArticleAction(formData)
    })
  }

  async function shareArticle() {
    setMenuPosition(null)

    try {
      if ("share" in navigator && typeof navigator.share === "function") {
        await navigator.share({
          title: article.title,
          url: article.url,
        })
        return
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(article.url)
      }
    } catch {
      // Native share and clipboard can be blocked by browser permissions.
    }
  }

  return (
    <>
      <Wrapper
        aria-controls={menuOpen ? menuId : undefined}
        aria-haspopup="menu"
        className={cn("group/article-actions relative", className)}
        onContextMenu={onContextMenu}
        onKeyDown={onKeyDown}
        tabIndex={0}
      >
        {children}
        {inlineActions && (
          <ArticleActionToolbar
            article={article}
            collections={collections}
            currentCollection={currentCollection}
            readOnlyReason={readOnlyReason}
            variant="hover"
          />
        )}
      </Wrapper>
      {typeof document !== "undefined" && menuOpen
        ? createPortal(
            <div
              aria-label={`${article.title} post actions`}
              className="fixed z-50 w-56 rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg outline-none"
              id={menuId}
              onContextMenu={(event) => event.preventDefault()}
              onPointerDown={(event) => event.stopPropagation()}
              role="menu"
              style={menuStyle(menuPosition)}
            >
              <button
                className={menuItemClass}
                disabled={Boolean(readOnlyReason)}
                onClick={toggleRead}
                role="menuitem"
                title={readOnlyReason}
                type="button"
              >
                {article.isRead ? <CircleIcon /> : <CheckIcon />}
                {article.isRead ? "Mark as unread" : "Mark as read"}
              </button>
              <button
                className={menuItemClass}
                disabled={Boolean(readOnlyReason)}
                onClick={toggleStarred}
                role="menuitem"
                title={readOnlyReason}
                type="button"
              >
                <StarIcon className={cn(article.isStarred && "fill-current")} />
                {article.isStarred ? "Unstar post" : "Star post"}
              </button>
              <button
                className={menuItemClass}
                disabled={Boolean(readOnlyReason)}
                onClick={openCollectionDialog}
                role="menuitem"
                title={readOnlyReason}
                type="button"
              >
                <FolderPlusIcon />
                Save to collection
              </button>
              <button
                className={cn(menuItemClass, "text-destructive")}
                disabled={Boolean(readOnlyReason)}
                onClick={deleteArticle}
                role="menuitem"
                title={readOnlyReason}
                type="button"
              >
                <ArchiveXIcon />
                Delete article
              </button>
              {currentCollection && (
                <button
                  className={cn(menuItemClass, "text-destructive")}
                  disabled={Boolean(readOnlyReason)}
                  onClick={removeFromCurrentCollection}
                  role="menuitem"
                  title={readOnlyReason}
                  type="button"
                >
                  <Trash2Icon />
                  Remove from {currentCollection.name}
                </button>
              )}
              <button
                className={menuItemClass}
                onClick={() => {
                  void shareArticle()
                }}
                role="menuitem"
                type="button"
              >
                <Share2Icon />
                Share
              </button>
              <div className="-mx-1 my-1 h-px bg-border" role="separator" />
              <button
                className={menuItemClass}
                disabled={Boolean(readOnlyReason)}
                onClick={markFeedRead}
                role="menuitem"
                title={readOnlyReason}
                type="button"
              >
                <CheckCheckIcon />
                Mark feed as read
              </button>
              <button
                className={menuItemClass}
                disabled={Boolean(readOnlyReason)}
                onClick={markAllRead}
                role="menuitem"
                title={readOnlyReason}
                type="button"
              >
                <CheckCheckIcon />
                Mark all as read
              </button>
            </div>,
            document.body
          )
        : null}
      <AlertDialog
        open={collectionDialogOpen}
        onOpenChange={setCollectionDialogOpen}
      >
        <AlertDialogContent>
          <ArticleCollectionActionForm
            key={`${article.id}:${collectionOpenSession}`}
            articleId={article.id}
            collections={collections}
            onSuccess={closeCollectionDialog}
          />
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function ArticleActionToolbar({
  article,
  collections = EMPTY_COLLECTIONS,
  currentCollection,
  readOnlyReason,
  variant = "persistent",
}: {
  article: ArticleContextMenuArticle
  collections?: ArticleCollectionPickerItem[]
  currentCollection?: ActiveArticleCollection
  readOnlyReason?: string
  variant?: "hover" | "persistent"
}) {
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false)
  const [collectionOpenSession, setCollectionOpenSession] = useState(0)
  const [, startTransition] = useTransition()
  const isHoverToolbar = variant === "hover"
  const closeCollectionDialog = useCallback(
    () => setCollectionDialogOpen(false),
    []
  )

  function toggleRead() {
    if (readOnlyReason) {
      return
    }

    startTransition(() => {
      const formData = new FormData()
      formData.set("articleId", article.id)
      formData.set("isRead", article.isRead ? "false" : "true")
      void setArticleReadAction(formData)
    })
  }

  function toggleStarred() {
    if (readOnlyReason) {
      return
    }

    startTransition(() => {
      const formData = new FormData()
      formData.set("articleId", article.id)
      formData.set("isStarred", article.isStarred ? "false" : "true")
      void setArticleStarredAction(formData)
    })
  }

  function summarizeArticle() {
    if (readOnlyReason) {
      return
    }

    startTransition(() => {
      const formData = new FormData()
      formData.set("articleId", article.id)
      void generateArticleSummaryAction(summaryInitialState, formData)
    })
  }

  function openCollectionDialog() {
    if (readOnlyReason) {
      return
    }

    setCollectionOpenSession((session) => session + 1)
    setCollectionDialogOpen(true)
  }

  function removeFromCurrentCollection() {
    if (readOnlyReason) {
      return
    }

    if (!currentCollection) {
      return
    }

    startTransition(() => {
      const formData = new FormData()
      formData.set("articleId", article.id)
      formData.set("collectionId", currentCollection.id)
      void removeArticleFromCollectionAction(formData)
    })
  }

  function deleteArticle() {
    if (readOnlyReason) {
      return
    }

    startTransition(() => {
      const formData = new FormData()
      formData.set("articleId", article.id)
      void deleteArticleAction(formData)
    })
  }

  async function shareArticle() {
    try {
      if ("share" in navigator && typeof navigator.share === "function") {
        await navigator.share({
          title: article.title,
          url: article.url,
        })
        return
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(article.url)
      }
    } catch {
      // Native share and clipboard can be blocked by browser permissions.
    }
  }

  return (
    <>
      <div
        aria-label={`${article.title}${isHoverToolbar ? " quick" : ""} actions`}
        className={cn(
          "z-10 flex items-center gap-1 rounded-md border bg-background/95 p-1 shadow-sm",
          isHoverToolbar
            ? "pointer-events-none absolute top-2 right-2 opacity-0 transition-opacity group-hover/article-actions:pointer-events-auto group-hover/article-actions:opacity-100"
            : "shrink-0"
        )}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        role="toolbar"
      >
        <QuickActionButton
          label="Share post"
          onClick={() => {
            void shareArticle()
          }}
        >
          <Share2Icon />
        </QuickActionButton>
        <QuickActionButton
          label="Summarize with AI"
          disabled={Boolean(readOnlyReason)}
          onClick={summarizeArticle}
          title={readOnlyReason}
        >
          <SparklesIcon />
        </QuickActionButton>
        <QuickActionButton
          label="Save to collection"
          disabled={Boolean(readOnlyReason)}
          onClick={openCollectionDialog}
          title={readOnlyReason}
        >
          <FolderPlusIcon />
        </QuickActionButton>
        <QuickActionButton
          label="Delete article"
          disabled={Boolean(readOnlyReason)}
          onClick={deleteArticle}
          title={readOnlyReason}
        >
          <ArchiveXIcon />
        </QuickActionButton>
        {currentCollection && (
          <QuickActionButton
            label={`Remove from ${currentCollection.name}`}
            disabled={Boolean(readOnlyReason)}
            onClick={removeFromCurrentCollection}
            title={readOnlyReason}
          >
            <Trash2Icon />
          </QuickActionButton>
        )}
        <QuickActionButton
          label={article.isStarred ? "Unstar post" : "Star post"}
          disabled={Boolean(readOnlyReason)}
          onClick={toggleStarred}
          title={readOnlyReason}
        >
          <StarIcon className={cn(article.isStarred && "fill-current")} />
        </QuickActionButton>
        <QuickActionButton
          label={article.isRead ? "Mark as unread" : "Mark as read"}
          disabled={Boolean(readOnlyReason)}
          onClick={toggleRead}
          title={readOnlyReason}
        >
          {article.isRead ? <CircleIcon /> : <CheckIcon />}
        </QuickActionButton>
      </div>
      <AlertDialog
        open={collectionDialogOpen}
        onOpenChange={setCollectionDialogOpen}
      >
        <AlertDialogContent>
          <ArticleCollectionActionForm
            key={`${article.id}:${collectionOpenSession}`}
            articleId={article.id}
            collections={collections}
            onSuccess={closeCollectionDialog}
          />
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function QuickActionButton({
  children,
  disabled = false,
  label,
  onClick,
  title,
}: {
  children: ReactNode
  disabled?: boolean
  label: string
  onClick: () => void
  title?: string
}) {
  return (
    <button
      aria-label={label}
      className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4"
      disabled={disabled}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        if (disabled) {
          return
        }
        onClick()
      }}
      title={title ?? label}
      type="button"
    >
      {children}
    </button>
  )
}

function ArticleCollectionActionForm({
  articleId,
  collections,
  onSuccess,
}: {
  articleId: string
  collections: ArticleCollectionPickerItem[]
  onSuccess: () => void
}) {
  const [state, action, pending] = useActionState(
    addArticleToCollectionAction,
    collectionInitialState
  )

  useEffect(() => {
    if (state.status === "success") {
      onSuccess()
    }
  }, [onSuccess, state.status])

  return (
    <ArticleCollectionDialogContent
      action={action}
      articleId={articleId}
      collections={collections}
      pending={pending}
      state={state}
    />
  )
}

function ArticleCollectionDialogContent({
  action,
  articleId,
  collections,
  pending,
  state,
}: {
  action: ComponentProps<"form">["action"]
  articleId: string
  collections: ArticleCollectionPickerItem[]
  pending: boolean
  state: AddArticleToCollectionActionState
}) {
  const [collectionSelection, setCollectionSelection] = useState(
    collections[0]?.id ?? NEW_COLLECTION_VALUE
  )
  const collectionSelectId = `article-collection-${articleId}`
  const collectionNameId = `article-collection-name-${articleId}`
  const isCreatingCollection = collectionSelection === NEW_COLLECTION_VALUE

  return (
    <form action={action} className="grid gap-4">
      <input name="articleId" type="hidden" value={articleId} />
      <input
        name="collectionId"
        type="hidden"
        value={isCreatingCollection ? "" : collectionSelection}
      />
      <AlertDialogHeader>
        <AlertDialogTitle>Save to collection</AlertDialogTitle>
        <AlertDialogDescription>
          Keep this post in a collection for later reading.
        </AlertDialogDescription>
      </AlertDialogHeader>

      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor={collectionSelectId}>
          Collection
        </label>
        <div className="relative">
          <FolderPlusIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <select
            className="h-8 w-full rounded-lg border border-input bg-background pr-2.5 pl-8 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
            disabled={pending}
            id={collectionSelectId}
            onChange={(event) =>
              setCollectionSelection(event.currentTarget.value)
            }
            value={collectionSelection}
          >
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.name} ({collection.articleCount})
              </option>
            ))}
            <option value={NEW_COLLECTION_VALUE}>
              Create new collection...
            </option>
          </select>
        </div>
      </div>

      {isCreatingCollection && (
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor={collectionNameId}>
            New collection name
          </label>
          <input
            autoComplete="off"
            className="h-8 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
            disabled={pending}
            id={collectionNameId}
            maxLength={80}
            name="collectionName"
            placeholder="Read later"
            required
            type="text"
          />
        </div>
      )}

      <p className="min-h-5 text-sm text-destructive">
        {state.status === "error" ? state.message : ""}
      </p>

      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending} type="button">
          Cancel
        </AlertDialogCancel>
        <Button disabled={pending} type="submit">
          <FolderPlusIcon data-icon="inline-start" />
          {pending ? "Saving" : "Save"}
        </Button>
      </AlertDialogFooter>
    </form>
  )
}

function clampMenuToViewport(x: number, y: number) {
  if (typeof window === "undefined") {
    return { x, y }
  }

  return {
    x: Math.max(
      MENU_VIEWPORT_GAP,
      Math.min(x, window.innerWidth - MENU_WIDTH - MENU_VIEWPORT_GAP)
    ),
    y: Math.max(
      MENU_VIEWPORT_GAP,
      Math.min(y, window.innerHeight - MENU_ESTIMATED_HEIGHT - MENU_VIEWPORT_GAP)
    ),
  }
}

function menuStyle(position: MenuPosition): CSSProperties {
  return {
    left: position.x,
    top: position.y,
  }
}

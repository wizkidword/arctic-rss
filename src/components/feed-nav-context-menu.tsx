"use client"

import {
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  useActionState,
  useEffect,
  useId,
  useState,
  useTransition,
} from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import {
  AlertCircleIcon,
  CheckCheckIcon,
  ExternalLinkIcon,
  GlobeIcon,
  RefreshCwIcon,
  RssIcon,
  Trash2Icon,
} from "lucide-react"

import {
  markAllReadAction,
  refreshFeedAction,
  type RefreshFeedActionState,
  type UnsubscribeFeedActionState,
  unsubscribeFeedAction,
} from "@/app/app/actions"
import {
  AlertDialog,
  AlertDialogContent,
} from "@/components/ui/alert-dialog"
import { FeedUnsubscribeDialogContent } from "@/components/feed-unsubscribe-button"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type FeedNavContextMenuSubscription = {
  feedId: string
  id: string
  lastError: string | null
  siteUrl: string | null
  title: string
  unreadCount: number
}

type MenuPosition = {
  x: number
  y: number
}

const refreshInitialState: RefreshFeedActionState = {
  message: "",
  status: "idle",
}

const unsubscribeInitialState: UnsubscribeFeedActionState = {
  message: "",
  status: "idle",
}

const menuItemClass =
  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0"

const MENU_WIDTH = 224
const MENU_ESTIMATED_HEIGHT = 300
const MENU_VIEWPORT_GAP = 8

export function FeedNavContextMenu({
  className,
  subscription,
}: {
  className?: string
  subscription: FeedNavContextMenuSubscription
}) {
  const feedHref = `/app/feed/${subscription.id}`
  const menuId = useId()
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null)
  const [unsubscribeOpen, setUnsubscribeOpen] = useState(false)
  const [showFeedError, setShowFeedError] = useState(false)
  const [, startTransition] = useTransition()
  const [unsubscribeState, unsubscribeAction, unsubscribePending] =
    useActionState(unsubscribeFeedAction, unsubscribeInitialState)

  const menuOpen = menuPosition !== null

  useEffect(() => {
    if (!menuOpen) {
      return
    }

    function closeMenu() {
      setMenuPosition(null)
      setShowFeedError(false)
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
    setShowFeedError(false)
  }

  function onContextMenu(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault()
    openMenuAt(event.clientX, event.clientY)
  }

  function onKeyDown(event: KeyboardEvent<HTMLAnchorElement>) {
    if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) {
      return
    }

    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    openMenuAt(rect.left + 16, rect.bottom + 4)
  }

  function runMarkFeedRead() {
    setMenuPosition(null)
    startTransition(() => {
      const formData = new FormData()
      formData.set("scope", "feed")
      formData.set("feedId", subscription.feedId)
      void markAllReadAction(formData)
    })
  }

  function runMarkAllRead() {
    setMenuPosition(null)
    startTransition(() => {
      const formData = new FormData()
      formData.set("scope", "all")
      void markAllReadAction(formData)
    })
  }

  function runRefreshFeed() {
    setMenuPosition(null)
    startTransition(() => {
      const formData = new FormData()
      formData.set("subscriptionId", subscription.id)
      void refreshFeedAction(refreshInitialState, formData)
    })
  }

  function openUnsubscribeDialog() {
    setMenuPosition(null)
    setUnsubscribeOpen(true)
  }

  const link = (
    <Link
      aria-controls={menuOpen ? menuId : undefined}
      aria-haspopup="menu"
      className={cn(
        buttonVariants({ variant: "ghost" }),
        "h-8 justify-start gap-2 px-2 text-muted-foreground",
        className
      )}
      href={feedHref}
      onContextMenu={onContextMenu}
      onKeyDown={onKeyDown}
    >
      <RssIcon data-icon="inline-start" />
      <span className="min-w-0 flex-1 truncate text-left">
        {subscription.title}
      </span>
      {subscription.unreadCount > 0 && (
        <span className="text-xs tabular-nums">{subscription.unreadCount}</span>
      )}
      {subscription.lastError && (
        <span
          aria-label="Feed needs attention"
          className="size-1.5 rounded-full bg-destructive"
        />
      )}
    </Link>
  )

  return (
    <>
      {link}
      {typeof document !== "undefined" && menuOpen
        ? createPortal(
            <div
              aria-label={`${subscription.title} feed actions`}
              className="fixed z-50 w-56 rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg outline-none"
              id={menuId}
              onContextMenu={(event) => event.preventDefault()}
              onPointerDown={(event) => event.stopPropagation()}
              role="menu"
              style={menuStyle(menuPosition)}
            >
              <button
                className={menuItemClass}
                onClick={runMarkFeedRead}
                role="menuitem"
                type="button"
              >
                <CheckCheckIcon />
                Mark feed as read
              </button>
              <button
                className={menuItemClass}
                onClick={runRefreshFeed}
                role="menuitem"
                type="button"
              >
                <RefreshCwIcon />
                Reload feed
              </button>
              <div className="-mx-1 my-1 h-px bg-border" role="separator" />
              <Link
                className={menuItemClass}
                href={feedHref}
                onClick={() => setMenuPosition(null)}
                role="menuitem"
              >
                <RssIcon />
                Go to feed
              </Link>
              {subscription.siteUrl ? (
                <a
                  className={menuItemClass}
                  href={subscription.siteUrl}
                  onClick={() => setMenuPosition(null)}
                  rel="noreferrer"
                  role="menuitem"
                  target="_blank"
                >
                  <ExternalLinkIcon />
                  Open original site
                </a>
              ) : (
                <button
                  className={menuItemClass}
                  disabled
                  role="menuitem"
                  type="button"
                >
                  <GlobeIcon />
                  Open original site
                </button>
              )}
              <div className="-mx-1 my-1 h-px bg-border" role="separator" />
              <button
                className={menuItemClass}
                onClick={runMarkAllRead}
                role="menuitem"
                type="button"
              >
                <CheckCheckIcon />
                Mark all as read
              </button>
              {subscription.lastError ? (
                <>
                  <button
                    className={cn(menuItemClass, "text-destructive")}
                    onClick={() => setShowFeedError((value) => !value)}
                    role="menuitem"
                    type="button"
                  >
                    <AlertCircleIcon />
                    Check error
                  </button>
                  {showFeedError && (
                    <p className="px-2 pb-1 text-xs leading-5 text-destructive">
                      {subscription.lastError}
                    </p>
                  )}
                </>
              ) : null}
              <div className="-mx-1 my-1 h-px bg-border" role="separator" />
              <button
                className={cn(menuItemClass, "text-destructive")}
                onClick={openUnsubscribeDialog}
                role="menuitem"
                type="button"
              >
                <Trash2Icon />
                Delete feed
              </button>
            </div>,
            document.body
          )
        : null}
      <AlertDialog open={unsubscribeOpen} onOpenChange={setUnsubscribeOpen}>
        <AlertDialogContent>
          <FeedUnsubscribeDialogContent
            action={unsubscribeAction}
            feedTitle={subscription.title}
            pending={unsubscribePending}
            state={unsubscribeState}
            subscriptionId={subscription.id}
          />
        </AlertDialogContent>
      </AlertDialog>
    </>
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

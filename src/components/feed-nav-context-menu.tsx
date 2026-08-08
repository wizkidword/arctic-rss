"use client"

import {
  type CSSProperties,
  useActionState,
  useCallback,
  useEffect,
  useId,
  useMemo,
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
  PauseIcon,
  PlayIcon,
  RefreshCwIcon,
  RssIcon,
  Trash2Icon,
} from "lucide-react"

import {
  markAllReadAction,
  refreshFeedAction,
  type RefreshFeedActionState,
  setFeedPausedAction,
  type SetFeedPausedActionState,
  type UnsubscribeFeedActionState,
  unsubscribeFeedAction,
} from "@/app/app/actions"
import {
  AlertDialog,
  AlertDialogContent,
} from "@/components/ui/alert-dialog"
import { FeedUnsubscribeDialogContent } from "@/components/feed-unsubscribe-button"
import { cn } from "@/lib/utils"

export type FeedNavContextMenuSubscription = {
  feedId: string
  id: string
  isPaused: boolean
  lastError: string | null
  lastSuccessfulFetchAt: Date | null
  siteUrl: string | null
  title: string
  unreadCount: number
}

type MenuPosition = {
  x: number
  y: number
}

type FeedMenuSelection = {
  subscription: FeedNavContextMenuSubscription
  trigger: HTMLAnchorElement
}

const refreshInitialState: RefreshFeedActionState = {
  message: "",
  status: "idle",
}

const unsubscribeInitialState: UnsubscribeFeedActionState = {
  message: "",
  status: "idle",
}

const setFeedPausedInitialState: SetFeedPausedActionState = {
  message: "",
  status: "idle",
}

const menuItemClass =
  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0"

const MENU_WIDTH = 224
const MENU_ESTIMATED_HEIGHT = 300
const MENU_VIEWPORT_GAP = 8

/**
 * Owns one context-menu and confirmation state for every desktop and mobile
 * feed link. Feed links themselves remain lightweight server-rendered markup.
 */
export function FeedNavMenuController({
  subscriptions,
}: {
  subscriptions: FeedNavContextMenuSubscription[]
}) {
  const subscriptionsById = useMemo(
    () => new Map(subscriptions.map((subscription) => [subscription.id, subscription])),
    [subscriptions]
  )
  const [selection, setSelection] = useState<FeedMenuSelection | null>(null)
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null)

  const dismiss = useCallback(({ restoreFocus = false }: { restoreFocus?: boolean } = {}) => {
    const trigger = selection?.trigger

    setMenuPosition(null)
    setSelection(null)

    if (restoreFocus && trigger?.isConnected) {
      requestAnimationFrame(() => trigger.focus())
    }
  }, [selection])

  const hideMenu = useCallback(() => {
    setMenuPosition(null)
  }, [])

  const openMenu = useCallback((trigger: HTMLAnchorElement, x: number, y: number) => {
    const subscriptionId = trigger.dataset.feedNavSubscriptionId
    const subscription = subscriptionId
      ? subscriptionsById.get(subscriptionId)
      : undefined

    if (!subscription) {
      return
    }

    setSelection({ subscription, trigger })
    setMenuPosition(clampMenuToViewport(x, y))
  }, [subscriptionsById])

  useEffect(() => {
    function onContextMenu(event: globalThis.MouseEvent) {
      const trigger = feedNavTrigger(event.target)

      if (!trigger) {
        return
      }

      event.preventDefault()
      openMenu(trigger, event.clientX, event.clientY)
    }

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) {
        return
      }

      const trigger = feedNavTrigger(event.target)

      if (!trigger) {
        return
      }

      event.preventDefault()
      const rect = trigger.getBoundingClientRect()
      openMenu(trigger, rect.left + 16, rect.bottom + 4)
    }

    document.addEventListener("contextmenu", onContextMenu)
    document.addEventListener("keydown", onKeyDown)

    return () => {
      document.removeEventListener("contextmenu", onContextMenu)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [openMenu])

  useEffect(() => {
    if (!menuPosition) {
      return
    }

    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        dismiss({ restoreFocus: true })
      }
    }

    const closeMenu = () => dismiss()

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
  }, [dismiss, menuPosition])

  if (!selection) {
    return null
  }

  return (
    <FeedNavActionMenu
      key={selection.subscription.id}
      onHideMenu={hideMenu}
      menuPosition={menuPosition}
      onDismiss={dismiss}
      subscription={selection.subscription}
    />
  )
}

function FeedNavActionMenu({
  menuPosition,
  onDismiss,
  onHideMenu,
  subscription,
}: {
  menuPosition: MenuPosition | null
  onDismiss: (options?: { restoreFocus?: boolean }) => void
  onHideMenu: () => void
  subscription: FeedNavContextMenuSubscription
}) {
  const feedHref = `/app/feed/${subscription.id}`
  const menuId = useId()
  const [unsubscribeOpen, setUnsubscribeOpen] = useState(false)
  const [showFeedError, setShowFeedError] = useState(false)
  const [, startTransition] = useTransition()
  const [unsubscribeState, unsubscribeAction, unsubscribePending] =
    useActionState(unsubscribeFeedAction, unsubscribeInitialState)

  function runMarkFeedRead() {
    onDismiss({ restoreFocus: true })
    startTransition(() => {
      const formData = new FormData()
      formData.set("scope", "feed")
      formData.set("feedId", subscription.feedId)
      void markAllReadAction(formData)
    })
  }

  function runMarkAllRead() {
    onDismiss({ restoreFocus: true })
    startTransition(() => {
      const formData = new FormData()
      formData.set("scope", "all")
      void markAllReadAction(formData)
    })
  }

  function runRefreshFeed() {
    onDismiss({ restoreFocus: true })
    startTransition(() => {
      const formData = new FormData()
      formData.set("subscriptionId", subscription.id)
      void refreshFeedAction(refreshInitialState, formData)
    })
  }

  function runSetFeedPaused() {
    onDismiss({ restoreFocus: true })
    startTransition(() => {
      const formData = new FormData()
      formData.set("isPaused", String(!subscription.isPaused))
      formData.set("subscriptionId", subscription.id)
      void setFeedPausedAction(setFeedPausedInitialState, formData)
    })
  }

  function openUnsubscribeDialog() {
    setShowFeedError(false)
    onHideMenu()
    setUnsubscribeOpen(true)
  }

  function onUnsubscribeOpenChange(open: boolean) {
    setUnsubscribeOpen(open)

    if (!open) {
      onDismiss({ restoreFocus: true })
    }
  }

  return (
    <>
      {typeof document !== "undefined" && menuPosition
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
              <p className="px-2 py-1 text-xs leading-5 text-muted-foreground">
                {feedHealthSummary(subscription)}
              </p>
              <div className="-mx-1 my-1 h-px bg-border" role="separator" />
              <button
                className={menuItemClass}
                onClick={runMarkFeedRead}
                role="menuitem"
                type="button"
              >
                <CheckCheckIcon />
                Mark feed as read
              </button>
              {!subscription.isPaused ? (
                <button
                  className={menuItemClass}
                  onClick={runRefreshFeed}
                  role="menuitem"
                  type="button"
                >
                  <RefreshCwIcon />
                  Reload feed
                </button>
              ) : null}
              <button
                className={menuItemClass}
                onClick={runSetFeedPaused}
                role="menuitem"
                type="button"
              >
                {subscription.isPaused ? <PlayIcon /> : <PauseIcon />}
                {subscription.isPaused ? "Resume feed" : "Pause feed"}
              </button>
              <div className="-mx-1 my-1 h-px bg-border" role="separator" />
              <Link
                className={menuItemClass}
                href={feedHref}
                onClick={() => onDismiss({ restoreFocus: true })}
                role="menuitem"
              >
                <RssIcon />
                Go to feed
              </Link>
              {subscription.siteUrl ? (
                <a
                  className={menuItemClass}
                  href={subscription.siteUrl}
                  onClick={() => onDismiss({ restoreFocus: true })}
                  rel="noreferrer"
                  role="menuitem"
                  target="_blank"
                >
                  <ExternalLinkIcon />
                  Open original site
                </a>
              ) : (
                <button className={menuItemClass} disabled role="menuitem" type="button">
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
                    View refresh guidance
                  </button>
                  {showFeedError && (
                    <p className="px-2 pb-1 text-xs leading-5 text-destructive">
                      Arctic RSS could not refresh this feed recently. Try reloading it, or pause it while you decide what to do.
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
      <AlertDialog open={unsubscribeOpen} onOpenChange={onUnsubscribeOpenChange}>
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

function feedNavTrigger(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return null
  }

  return target.closest<HTMLAnchorElement>("[data-feed-nav-subscription-id]")
}

function feedHealthSummary(subscription: FeedNavContextMenuSubscription) {
  if (subscription.isPaused) {
    return "Paused. New articles will not be fetched until you resume this feed."
  }

  if (subscription.lastError) {
    return "Needs attention. A recent refresh did not finish."
  }

  if (subscription.lastSuccessfulFetchAt) {
    return `Last refreshed ${new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(subscription.lastSuccessfulFetchAt)}.`
  }

  return "Waiting for the first successful refresh."
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

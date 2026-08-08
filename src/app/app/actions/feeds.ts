"use server"

import { refresh, revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { getDiscoverDirectoryFeed } from "@/lib/discover-directory"
import { FeedValidationError } from "@/lib/feed-discovery"
import { FeedRefreshError, refreshFeed } from "@/lib/feed-refresh"
import {
  FeedSubscriptionError,
  getUserFeedSubscription,
  setFeedSubscriptionPaused,
  subscribeToFeed,
  unsubscribeFromFeed,
} from "@/lib/feed-subscriptions"
import { enforceRateLimit, getRateLimitErrorMessage } from "@/lib/rate-limit"
import { FeedFetchError, UnsafeUrlError } from "@/lib/url-safety"

import { revalidateArticleListPaths, revalidateFeedSubscriptionPaths } from "./revalidation"

const MANUAL_FEED_REFRESH_COOLDOWN_MS = 5 * 60 * 1000

export type SourceSubscriptionAnalytics = {
  firstSourceSubscribed: boolean
  sourceType: "feed"
}

export type AddFeedActionState = ActionState & { analytics?: SourceSubscriptionAnalytics }
export type SubscribeDirectoryFeedActionState = ActionState & { analytics?: SourceSubscriptionAnalytics }
export type RefreshFeedActionState = ActionState
export type SetFeedPausedActionState = ActionState
export type UnsubscribeFeedActionState = ActionState
export type BulkFeedAttentionActionState = ActionState

type ActionState = { message: string; status: "idle" | "success" | "error" }

export async function addFeedAction(
  _previousState: AddFeedActionState,
  formData: FormData
): Promise<AddFeedActionState> {
  const session = await auth()
  if (!session?.user?.id) return { message: "You need to sign in before adding feeds.", status: "error" }

  const url = String(formData.get("url") ?? "").trim()
  const folderId = String(formData.get("folderId") ?? "").trim() || undefined
  if (!url) return { message: "Enter a feed or website URL.", status: "error" }
  if (!(await canDiscover(session.user.id))) return rateLimitFailure()

  try {
    const subscription = await subscribeToFeed({ folderId, url, userId: session.user.id })
    let refreshMessage = typeof subscription.initialArticleCount === "number"
      ? `Imported ${subscription.initialArticleCount} articles.`
      : "Article refresh will retry if needed."
    if (typeof subscription.initialArticleCount !== "number") {
      try {
        refreshMessage = `Imported ${(await refreshFeed(subscription.feedId)).articleCount} articles.`
      } catch {
        refreshMessage = "Subscribed. Article refresh will retry."
      }
    }
    revalidatePath("/app")
    refresh()
    return {
      analytics: getFeedSubscriptionAnalytics(subscription),
      message: `Subscribed to ${subscription.customTitle || subscription.feed.title}. ${refreshMessage}`,
      status: "success",
    }
  } catch (error) {
    return subscriptionError(error, "Arctic RSS could not add that feed. Try another URL.")
  }
}

export async function subscribeDirectoryFeedAction(
  _previousState: SubscribeDirectoryFeedActionState,
  formData: FormData
): Promise<SubscribeDirectoryFeedActionState> {
  const session = await auth()
  if (!session?.user?.id) return { message: "You need to sign in before subscribing.", status: "error" }

  const directoryFeed = await getDiscoverDirectoryFeed(String(formData.get("directoryFeedId") ?? "").trim())
  if (!directoryFeed) return { message: "That directory feed is not available.", status: "error" }
  if (!(await canDiscover(session.user.id))) return rateLimitFailure()

  const folderId = String(formData.get("folderId") ?? "").trim() || undefined
  const folderName = formData.has("folderName") ? String(formData.get("folderName") ?? "") : undefined
  let subscription: Awaited<ReturnType<typeof subscribeToFeed>>
  try {
    subscription = await subscribeToFeed({
      folderId,
      ...(folderName === undefined ? {} : { folderName }),
      url: directoryFeed.url,
      userId: session.user.id,
    })
  } catch (error) {
    return subscriptionError(error, "Arctic RSS could not subscribe to that directory feed.")
  }

  let refreshMessage = typeof subscription.initialArticleCount === "number"
    ? `Imported ${subscription.initialArticleCount} articles.`
    : "Article refresh will retry."
  if (typeof subscription.initialArticleCount !== "number") {
    try {
      refreshMessage = `Imported ${(await refreshFeed(subscription.feedId)).articleCount} articles.`
    } catch {
      // The subscription is committed and the worker can retry the refresh.
    }
  }
  try { revalidatePath("/app") } catch { /* best effort after a committed mutation */ }
  try { refresh() } catch { /* best effort after a committed mutation */ }
  return {
    analytics: getFeedSubscriptionAnalytics(subscription),
    message: `Subscribed to ${directoryFeed.label}. ${refreshMessage}`,
    status: "success",
  }
}

export async function refreshFeedAction(
  _previousState: RefreshFeedActionState,
  formData: FormData
): Promise<RefreshFeedActionState> {
  const session = await auth()
  if (!session?.user?.id) return { message: "You need to sign in before refreshing feeds.", status: "error" }
  const subscriptionId = String(formData.get("subscriptionId") ?? "").trim()
  if (!subscriptionId) return { message: "Choose a feed to refresh.", status: "error" }
  const subscription = await getUserFeedSubscription(session.user.id, subscriptionId)
  if (!subscription) return { message: "That feed subscription was not found.", status: "error" }
  if (subscription.isPaused) return { message: "Resume this feed before reloading it.", status: "error" }
  if (!(await canDiscover(session.user.id))) return rateLimitFailure()
  const cooldownMessage = manualFeedRefreshCooldownMessage(subscription.feed.lastFetchedAt)
  if (cooldownMessage) return { message: cooldownMessage, status: "error" }
  try {
    const result = await refreshFeed(subscription.feedId)
    revalidatePath("/app")
    revalidatePath(`/app/feed/${subscription.id}`)
    refresh()
    return { message: `Fetched ${result.articleCount} articles.`, status: "success" }
  } catch (error) {
    if (error instanceof FeedRefreshError || error instanceof FeedFetchError || error instanceof UnsafeUrlError) {
      return { message: error.message, status: "error" }
    }
    return { message: "Arctic RSS could not refresh that feed.", status: "error" }
  }
}

export async function setFeedPausedAction(
  _previousState: SetFeedPausedActionState,
  formData: FormData
): Promise<SetFeedPausedActionState> {
  const session = await auth()
  if (!session?.user?.id) return { message: "You need to sign in before changing a feed.", status: "error" }
  const subscriptionId = String(formData.get("subscriptionId") ?? "").trim()
  const isPaused = String(formData.get("isPaused") ?? "") === "true"
  if (!subscriptionId) return { message: "Choose a feed to update.", status: "error" }
  if (!(await canDiscover(session.user.id))) return rateLimitFailure()
  try {
    await setFeedSubscriptionPaused({ isPaused, subscriptionId, userId: session.user.id })
    revalidatePath("/app", "layout")
    revalidateArticleListPaths()
    revalidatePath(`/app/feed/${encodeURIComponent(subscriptionId)}`)
    refresh()
    return {
      message: isPaused
        ? "Feed paused. New articles will stay out of your reader until you resume it."
        : "Feed resumed. Reload it when you are ready to fetch the latest articles.",
      status: "success",
    }
  } catch (error) {
    return error instanceof FeedSubscriptionError
      ? { message: error.message, status: "error" }
      : { message: "Arctic RSS could not update that feed.", status: "error" }
  }
}

export async function unsubscribeFeedAction(
  _previousState: UnsubscribeFeedActionState,
  formData: FormData
): Promise<UnsubscribeFeedActionState> {
  const session = await auth()
  if (!session?.user?.id) return { message: "You need to sign in before unsubscribing.", status: "error" }
  const subscriptionId = String(formData.get("subscriptionId") ?? "").trim()
  if (!subscriptionId) return { message: "Choose a feed to unsubscribe from.", status: "error" }
  let folderId: string | null | undefined
  try {
    folderId = (await unsubscribeFromFeed({ subscriptionId, userId: session.user.id })).folderId
  } catch (error) {
    return error instanceof FeedSubscriptionError
      ? { message: error.message, status: "error" }
      : { message: "Arctic RSS could not unsubscribe from that feed.", status: "error" }
  }
  try { revalidateFeedSubscriptionPaths(folderId) } catch { /* mutation is committed */ }
  redirect("/app")
}

/** Applies a deliberate, bounded repair action to user-selected failed feeds. */
export async function bulkFeedAttentionAction(
  _previousState: BulkFeedAttentionActionState,
  formData: FormData
): Promise<BulkFeedAttentionActionState> {
  const session = await auth()
  if (!session?.user?.id) {
    return { message: "You need to sign in before updating feeds.", status: "error" }
  }

  const subscriptionIds = [...new Set(formData.getAll("subscriptionIds").map(String))]
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 10)
  const operation = String(formData.get("operation") ?? "")
  if (!subscriptionIds.length) {
    return { message: "Choose at least one source.", status: "error" }
  }
  if (!isBulkFeedAttentionOperation(operation)) {
    return { message: "Choose a supported source action.", status: "error" }
  }
  if (operation === "unsubscribe" && formData.get("confirmation") !== "UNSUBSCRIBE") {
    return { message: "Type UNSUBSCRIBE to confirm removing the selected sources.", status: "error" }
  }
  if (!(await canDiscover(session.user.id))) {
    return rateLimitFailure()
  }

  const subscriptions = await Promise.all(
    subscriptionIds.map((subscriptionId) =>
      getUserFeedSubscription(session.user.id, subscriptionId)
    )
  )
  if (subscriptions.some((subscription) => !subscription)) {
    return { message: "One or more selected sources are no longer available.", status: "error" }
  }

  if (operation === "pause") {
    await Promise.all(
      subscriptionIds.map((subscriptionId) =>
        setFeedSubscriptionPaused({ isPaused: true, subscriptionId, userId: session.user.id })
      )
    )
    revalidatePath("/app", "layout")
    revalidateArticleListPaths()
    refresh()
    return {
      message: `${subscriptionIds.length} ${sourceLabel(subscriptionIds.length)} paused.`,
      status: "success",
    }
  }

  if (operation === "unsubscribe") {
    const removed = await Promise.all(
      subscriptionIds.map((subscriptionId) =>
        unsubscribeFromFeed({ subscriptionId, userId: session.user.id })
      )
    )
    await Promise.all(
      removed.map((subscription) => revalidateFeedSubscriptionPaths(subscription.folderId))
    )
    return {
      message: `${removed.length} ${sourceLabel(removed.length)} unsubscribed.`,
      status: "success",
    }
  }

  if (subscriptions.some((subscription) => subscription!.isPaused)) {
    return {
      message: "Resume selected sources before retrying them.",
      status: "error",
    }
  }

  const refreshed = await Promise.allSettled(
    subscriptions.map((subscription) => refreshFeed(subscription!.feedId))
  )
  const succeeded = refreshed.filter((result) => result.status === "fulfilled").length
  revalidatePath("/app")
  refresh()
  return {
    message:
      succeeded === subscriptionIds.length
        ? `${succeeded} ${sourceLabel(succeeded)} retried.`
        : `${succeeded} of ${subscriptionIds.length} selected ${sourceLabel(subscriptionIds.length)} retried.`,
    status: succeeded ? "success" : "error",
  }
}

async function canDiscover(userId: string) {
  return (await enforceRateLimit({ action: "feed_discovery", userId })).allowed
}

function rateLimitFailure() {
  return { message: getRateLimitErrorMessage(), status: "error" as const }
}

function subscriptionError(error: unknown, fallback: string): AddFeedActionState {
  if (error instanceof FeedSubscriptionError || error instanceof FeedValidationError || error instanceof FeedFetchError || error instanceof UnsafeUrlError) {
    return { message: error.message, status: "error" }
  }
  return { message: fallback, status: "error" }
}

function getFeedSubscriptionAnalytics(subscription: { sourceCountBeforeSubscribe?: number }): SourceSubscriptionAnalytics | undefined {
  return typeof subscription.sourceCountBeforeSubscribe === "number"
    ? { firstSourceSubscribed: subscription.sourceCountBeforeSubscribe === 0, sourceType: "feed" }
    : undefined
}

function manualFeedRefreshCooldownMessage(lastFetchedAt: Date | null) {
  if (!lastFetchedAt) return null
  const remainingMs = MANUAL_FEED_REFRESH_COOLDOWN_MS - (Date.now() - lastFetchedAt.getTime())
  if (remainingMs <= 0) return null
  const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60_000))
  return `This feed was refreshed recently. Try again in ${remainingMinutes} ${remainingMinutes === 1 ? "minute" : "minutes"}.`
}

function isBulkFeedAttentionOperation(
  value: string
): value is "pause" | "retry" | "unsubscribe" {
  return value === "pause" || value === "retry" || value === "unsubscribe"
}

function sourceLabel(count: number) {
  return count === 1 ? "source" : "sources"
}

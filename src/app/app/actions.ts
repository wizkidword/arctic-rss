"use server"

import { refresh, revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import {
  BugReportError,
  createBugReportForUser,
} from "@/lib/bug-reports"
import {
  FeatureSuggestionError,
  createFeatureSuggestionForUser,
} from "@/lib/feature-suggestions"
import { getPrisma } from "@/lib/db"
import { getDiscoverDirectoryFeed } from "@/lib/discover-directory"
import { requestEmailVerification } from "@/lib/email-verification"
import { FeedValidationError } from "@/lib/feed-discovery"
import { FeedRefreshError, refreshFeed } from "@/lib/feed-refresh"
import {
  FeedSubscriptionError,
  getUserFeedSubscription,
  setFeedSubscriptionPaused,
  subscribeToFeed,
  unsubscribeFromFeed,
} from "@/lib/feed-subscriptions"
import {
  createFolder,
  deleteFolder,
  FolderError,
  moveSubscriptionToFolder,
  renameFolder,
} from "@/lib/folders"
import {
  cancelOpmlImportJob,
  createOpmlImportJob,
  OpmlImportJobError,
  retryOpmlImportJob,
} from "@/lib/opml-import-jobs"
import { OpmlError } from "@/lib/opml"
import { isDefaultView, type DefaultView } from "@/lib/preferences"
import {
  enforceRateLimit,
  getRateLimitErrorMessage,
} from "@/lib/rate-limit"
import {
  isDateFormatPreference,
  isDisplayMode,
  isSupportedTimeZone,
  isThemePreference,
  isTimeFormatPreference,
  type DateTimePreferences,
  type DisplayMode,
  type ThemePreference,
} from "@/lib/settings"
import { FeedFetchError, UnsafeUrlError } from "@/lib/url-safety"

import {
  revalidateArticleListPaths,
  revalidateFeedSubscriptionPaths,
  revalidateFolderPaths,
  revalidateSettingsPaths,
} from "./actions/revalidation"
// Keep this module as the stable Next.js Server Action boundary. The extracted
// modules below own the implementation details without changing client imports.
import * as articleActions from "./actions/articles"
import * as aiActions from "./actions/ai"

const MANUAL_FEED_REFRESH_COOLDOWN_MS = 5 * 60 * 1000

export type AddFeedActionState = {
  analytics?: SourceSubscriptionAnalytics
  message: string
  status: "idle" | "success" | "error"
}

export type SubscribeDirectoryFeedActionState = {
  analytics?: SourceSubscriptionAnalytics
  message: string
  status: "idle" | "success" | "error"
}

export type RefreshFeedActionState = {
  message: string
  status: "idle" | "success" | "error"
}

export type SetFeedPausedActionState = {
  message: string
  status: "idle" | "success" | "error"
}

export type UnsubscribeFeedActionState = {
  message: string
  status: "idle" | "success" | "error"
}

export type ImportOpmlActionState = {
  jobId?: string
  message: string
  status: "idle" | "success" | "error"
}

export type {
  AddArticleToCollectionActionState,
  AddPodcastEpisodeToCollectionActionState,
} from "./actions/articles"
export type {
  DismissStoryClusterActionState,
  EvaluateStoryClusterActionState,
  GenerateAiDigestActionState,
  GenerateArticleSummaryActionState,
  GenerateStoryClusterAnalysisActionState,
  MergeStoryClustersActionState,
  SplitStoryClusterMemberActionState,
  UpdateAiPreferencesActionState,
} from "./actions/ai"

export type SubmitBugReportActionState = {
  message: string
  status: "idle" | "success" | "error"
}

export type SubmitFeatureSuggestionActionState = {
  message: string
  status: "idle" | "success" | "error"
}

export type ResendEmailVerificationActionState = {
  message: string
  status: "idle" | "success" | "error"
}

type SourceSubscriptionAnalytics = {
  firstSourceSubscribed: boolean
  sourceType: "feed"
}

const MAX_OPML_IMPORT_BYTES = 2 * 1024 * 1024

export async function updateDefaultView(defaultView: DefaultView) {
  const session = await auth()

  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }

  if (!isDefaultView(defaultView)) {
    throw new Error("Unsupported reader view")
  }

  await getPrisma().userSettings.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      defaultView,
    },
    update: {
      defaultView,
    },
  })

  revalidatePath("/app")
}

export async function updateThemePreference(theme: ThemePreference) {
  const session = await auth()

  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }

  if (!isThemePreference(theme)) {
    throw new Error("Unsupported theme preference")
  }

  await getPrisma().userSettings.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      theme,
    },
    update: {
      theme,
    },
  })

  revalidatePath("/app", "layout")
  revalidatePath("/app/settings")
  refresh()
}

export async function updateDisplayMode(displayMode: DisplayMode) {
  const session = await auth()

  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }

  if (!isDisplayMode(displayMode)) {
    throw new Error("Unsupported display mode")
  }

  await getPrisma().userSettings.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      displayMode,
    },
    update: {
      displayMode,
    },
  })

  revalidatePath("/app", "layout")
  revalidatePath("/app/settings")
  refresh()
}

export async function updateDateTimePreferences({
  dateFormat,
  timeFormat,
  timeZone,
}: DateTimePreferences) {
  const session = await auth()

  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }

  if (
    !isDateFormatPreference(dateFormat) ||
    !isTimeFormatPreference(timeFormat) ||
    !isSupportedTimeZone(timeZone)
  ) {
    throw new Error("Unsupported date and time preference")
  }

  await getPrisma().userSettings.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      dateFormat,
      timeFormat,
      timeZone,
    },
    update: {
      dateFormat,
      timeFormat,
      timeZone,
    },
  })

  revalidatePath("/app", "layout")
  revalidatePath("/app/settings")
  refresh()
}

export async function addFeedAction(
  _previousState: AddFeedActionState,
  formData: FormData
): Promise<AddFeedActionState> {
  const session = await auth()

  if (!session?.user?.id) {
    return {
      message: "You need to sign in before adding feeds.",
      status: "error",
    }
  }

  const url = String(formData.get("url") ?? "").trim()
  const folderId = String(formData.get("folderId") ?? "").trim() || undefined

  if (!url) {
    return {
      message: "Enter a feed or website URL.",
      status: "error",
    }
  }

  const rateLimit = await enforceRateLimit({
    action: "feed_discovery",
    userId: session.user.id,
  })

  if (!rateLimit.allowed) {
    return { message: getRateLimitErrorMessage(), status: "error" }
  }

  try {
    const subscription = await subscribeToFeed({
      folderId,
      url,
      userId: session.user.id,
    })
    let refreshMessage =
      typeof subscription.initialArticleCount === "number"
        ? `Imported ${subscription.initialArticleCount} articles.`
        : "Article refresh will retry if needed."

    if (typeof subscription.initialArticleCount !== "number") {
      try {
        const refreshResult = await refreshFeed(subscription.feedId)
        refreshMessage = `Imported ${refreshResult.articleCount} articles.`
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
    if (
      error instanceof FeedSubscriptionError ||
      error instanceof FeedValidationError ||
      error instanceof FeedFetchError ||
      error instanceof UnsafeUrlError
    ) {
      return {
        message: error.message,
        status: "error",
      }
    }

    return {
      message: "Arctic RSS could not add that feed. Try another URL.",
      status: "error",
    }
  }
}

export async function subscribeDirectoryFeedAction(
  _previousState: SubscribeDirectoryFeedActionState,
  formData: FormData
): Promise<SubscribeDirectoryFeedActionState> {
  const session = await auth()

  if (!session?.user?.id) {
    return {
      message: "You need to sign in before subscribing.",
      status: "error",
    }
  }

  const directoryFeedId = String(
    formData.get("directoryFeedId") ?? ""
  ).trim()
  const folderId = String(formData.get("folderId") ?? "").trim() || undefined
  const folderName = formData.has("folderName")
    ? String(formData.get("folderName") ?? "")
    : undefined
  const directoryFeed = await getDiscoverDirectoryFeed(directoryFeedId)

  if (!directoryFeed) {
    return {
      message: "That directory feed is not available.",
      status: "error",
    }
  }

  const rateLimit = await enforceRateLimit({
    action: "feed_discovery",
    userId: session.user.id,
  })

  if (!rateLimit.allowed) {
    return { message: getRateLimitErrorMessage(), status: "error" }
  }

  let subscription: Awaited<ReturnType<typeof subscribeToFeed>>

  try {
    subscription = await subscribeToFeed({
      folderId,
      ...(folderName !== undefined ? { folderName } : {}),
      url: directoryFeed.url,
      userId: session.user.id,
    })
  } catch (error) {
    if (
      error instanceof FeedSubscriptionError ||
      error instanceof FeedValidationError ||
      error instanceof FeedFetchError ||
      error instanceof UnsafeUrlError
    ) {
      return {
        message: error.message,
        status: "error",
      }
    }

    return {
      message: "Arctic RSS could not subscribe to that directory feed.",
      status: "error",
    }
  }

  let refreshMessage =
    typeof subscription.initialArticleCount === "number"
      ? `Imported ${subscription.initialArticleCount} articles.`
      : "Article refresh will retry."

  if (typeof subscription.initialArticleCount !== "number") {
    try {
      const refreshResult = await refreshFeed(subscription.feedId)
      refreshMessage = `Imported ${refreshResult.articleCount} articles.`
    } catch {
      // The subscription is committed and the worker can retry the refresh.
    }
  }

  try {
    revalidatePath("/app")
  } catch {
    // The subscription is committed; cache invalidation is best effort.
  }

  try {
    refresh()
  } catch {
    // The subscription is committed; client refresh is best effort.
  }

  return {
    analytics: getFeedSubscriptionAnalytics(subscription),
    message: `Subscribed to ${directoryFeed.label}. ${refreshMessage}`,
    status: "success",
  }
}

function getFeedSubscriptionAnalytics(subscription: {
  sourceCountBeforeSubscribe?: number
}): SourceSubscriptionAnalytics | undefined {
  if (typeof subscription.sourceCountBeforeSubscribe !== "number") {
    return undefined
  }

  return {
    firstSourceSubscribed: subscription.sourceCountBeforeSubscribe === 0,
    sourceType: "feed",
  }
}

export async function refreshFeedAction(
  _previousState: RefreshFeedActionState,
  formData: FormData
): Promise<RefreshFeedActionState> {
  const session = await auth()

  if (!session?.user?.id) {
    return {
      message: "You need to sign in before refreshing feeds.",
      status: "error",
    }
  }

  const subscriptionId = String(formData.get("subscriptionId") ?? "").trim()

  if (!subscriptionId) {
    return {
      message: "Choose a feed to refresh.",
      status: "error",
    }
  }

  const subscription = await getUserFeedSubscription(
    session.user.id,
    subscriptionId
  )

  if (!subscription) {
    return {
      message: "That feed subscription was not found.",
      status: "error",
    }
  }

  if (subscription.isPaused) {
    return {
      message: "Resume this feed before reloading it.",
      status: "error",
    }
  }

  const rateLimit = await enforceRateLimit({
    action: "feed_discovery",
    userId: session.user.id,
  })

  if (!rateLimit.allowed) {
    return { message: getRateLimitErrorMessage(), status: "error" }
  }

  const cooldownMessage = manualFeedRefreshCooldownMessage(
    subscription.feed.lastFetchedAt
  )

  if (cooldownMessage) {
    return {
      message: cooldownMessage,
      status: "error",
    }
  }

  try {
    const result = await refreshFeed(subscription.feedId)

    revalidatePath("/app")
    revalidatePath(`/app/feed/${subscription.id}`)
    refresh()

    return {
      message: `Fetched ${result.articleCount} articles.`,
      status: "success",
    }
  } catch (error) {
    if (
      error instanceof FeedRefreshError ||
      error instanceof FeedFetchError ||
      error instanceof UnsafeUrlError
    ) {
      return {
        message: error.message,
        status: "error",
      }
    }

    return {
      message: "Arctic RSS could not refresh that feed.",
      status: "error",
    }
  }
}

export async function setFeedPausedAction(
  _previousState: SetFeedPausedActionState,
  formData: FormData
): Promise<SetFeedPausedActionState> {
  const session = await auth()

  if (!session?.user?.id) {
    return {
      message: "You need to sign in before changing a feed.",
      status: "error",
    }
  }

  const subscriptionId = String(formData.get("subscriptionId") ?? "").trim()
  const isPaused = String(formData.get("isPaused") ?? "") === "true"

  if (!subscriptionId) {
    return {
      message: "Choose a feed to update.",
      status: "error",
    }
  }

  const rateLimit = await enforceRateLimit({
    action: "feed_discovery",
    userId: session.user.id,
  })

  if (!rateLimit.allowed) {
    return { message: getRateLimitErrorMessage(), status: "error" }
  }

  try {
    await setFeedSubscriptionPaused({
      isPaused,
      subscriptionId,
      userId: session.user.id,
    })

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
    if (error instanceof FeedSubscriptionError) {
      return {
        message: error.message,
        status: "error",
      }
    }

    return {
      message: "Arctic RSS could not update that feed.",
      status: "error",
    }
  }
}

function manualFeedRefreshCooldownMessage(lastFetchedAt: Date | null) {
  if (!lastFetchedAt) {
    return null
  }

  const elapsedMs = Date.now() - lastFetchedAt.getTime()

  if (elapsedMs >= MANUAL_FEED_REFRESH_COOLDOWN_MS) {
    return null
  }

  const remainingMinutes = Math.max(
    1,
    Math.ceil((MANUAL_FEED_REFRESH_COOLDOWN_MS - elapsedMs) / 60_000)
  )

  return `This feed was refreshed recently. Try again in ${remainingMinutes} ${
    remainingMinutes === 1 ? "minute" : "minutes"
  }.`
}

export async function unsubscribeFeedAction(
  _previousState: UnsubscribeFeedActionState,
  formData: FormData
): Promise<UnsubscribeFeedActionState> {
  const session = await auth()

  if (!session?.user?.id) {
    return {
      message: "You need to sign in before unsubscribing.",
      status: "error",
    }
  }

  const subscriptionId = String(formData.get("subscriptionId") ?? "").trim()

  if (!subscriptionId) {
    return {
      message: "Choose a feed to unsubscribe from.",
      status: "error",
    }
  }

  let folderId: string | null | undefined

  try {
    const subscription = await unsubscribeFromFeed({
      subscriptionId,
      userId: session.user.id,
    })
    folderId = subscription.folderId
  } catch (error) {
    if (error instanceof FeedSubscriptionError) {
      return {
        message: error.message,
        status: "error",
      }
    }

    return {
      message: "Arctic RSS could not unsubscribe from that feed.",
      status: "error",
    }
  }

  try {
    revalidateFeedSubscriptionPaths(folderId)
  } catch {
    // The unsubscribe is committed; cache invalidation is best effort.
  }

  redirect("/app")
}

export async function importOpmlAction(
  _previousState: ImportOpmlActionState,
  formData: FormData
): Promise<ImportOpmlActionState> {
  const session = await auth()

  if (!session?.user?.id) {
    return {
      message: "You need to sign in before importing OPML.",
      status: "error",
    }
  }

  const file = formData.get("opmlFile")

  if (!(file instanceof File) || file.size === 0) {
    return {
      message: "Choose an OPML file to import.",
      status: "error",
    }
  }

  if (file.size > MAX_OPML_IMPORT_BYTES) {
    return {
      message: "OPML imports are limited to 2 MB.",
      status: "error",
    }
  }

  const rateLimit = await enforceRateLimit({
    action: "opml_import",
    userId: session.user.id,
  })

  if (!rateLimit.allowed) {
    return { message: getRateLimitErrorMessage(), status: "error" }
  }

  try {
    const queuedImport = await createOpmlImportJob({
      opmlXml: await file.text(),
      userId: session.user.id,
    })

    revalidateSettingsPaths()
    refresh()

    return {
      jobId: queuedImport.jobId,
      message: `Import queued for ${queuedImport.totalFeeds} feeds. It will continue in the background; refresh this page to follow its progress.`,
      status: "success",
    }
  } catch (error) {
    if (error instanceof OpmlError || error instanceof OpmlImportJobError) {
      return {
        message: error.message,
        status: "error",
      }
    }

    return {
      message: "Arctic RSS could not import that OPML file.",
      status: "error",
    }
  }
}

export async function cancelOpmlImportAction(formData: FormData) {
  const session = await auth()
  const jobId = formData.get("jobId")

  if (!session?.user?.id || typeof jobId !== "string" || !isImportJobId(jobId)) {
    return
  }

  await cancelOpmlImportJob({
    jobId,
    userId: session.user.id,
  })
  revalidateSettingsPaths()
  refresh()
}

export async function retryOpmlImportAction(formData: FormData) {
  const session = await auth()
  const jobId = formData.get("jobId")

  if (!session?.user?.id || typeof jobId !== "string" || !isImportJobId(jobId)) {
    return
  }

  try {
    await retryOpmlImportJob({
      jobId,
      userId: session.user.id,
    })
  } catch (error) {
    if (!(error instanceof OpmlImportJobError)) {
      throw error
    }
  }

  revalidateSettingsPaths()
  refresh()
}

export async function submitBugReportAction(
  _previousState: SubmitBugReportActionState,
  formData: FormData
): Promise<SubmitBugReportActionState> {
  const session = await auth()

  if (!session?.user?.id) {
    return {
      message: "You need to sign in before reporting a bug.",
      status: "error",
    }
  }

  const rateLimit = await enforceRateLimit({
    action: "feedback",
    userId: session.user.id,
  })

  if (!rateLimit.allowed) {
    return { message: getRateLimitErrorMessage(), status: "error" }
  }

  try {
    await createBugReportForUser({
      contactEmail: session.user.email ?? null,
      description: String(formData.get("description") ?? ""),
      pageUrl: String(formData.get("pageUrl") ?? ""),
      title: String(formData.get("title") ?? ""),
      userAgent: String(formData.get("userAgent") ?? ""),
      userId: session.user.id,
    })

    revalidatePath("/admin")

    return {
      message: "Thanks, your bug report was sent.",
      status: "success",
    }
  } catch (error) {
    if (error instanceof BugReportError) {
      return {
        message: error.message,
        status: "error",
      }
    }

    return {
      message: "Arctic RSS could not send that bug report.",
      status: "error",
    }
  }
}

export async function submitFeatureSuggestionAction(
  _previousState: SubmitFeatureSuggestionActionState,
  formData: FormData
): Promise<SubmitFeatureSuggestionActionState> {
  const session = await auth()

  if (!session?.user?.id) {
    return {
      message: "You need to sign in before suggesting a feature.",
      status: "error",
    }
  }

  const rateLimit = await enforceRateLimit({
    action: "feedback",
    userId: session.user.id,
  })

  if (!rateLimit.allowed) {
    return { message: getRateLimitErrorMessage(), status: "error" }
  }

  try {
    await createFeatureSuggestionForUser({
      contactEmail: session.user.email ?? null,
      description: String(formData.get("description") ?? ""),
      pageUrl: String(formData.get("pageUrl") ?? ""),
      title: String(formData.get("title") ?? ""),
      userAgent: String(formData.get("userAgent") ?? ""),
      userId: session.user.id,
    })

    revalidatePath("/admin")

    return {
      message: "Thanks, your feature suggestion was sent.",
      status: "success",
    }
  } catch (error) {
    if (error instanceof FeatureSuggestionError) {
      return {
        message: error.message,
        status: "error",
      }
    }

    return {
      message: "Arctic RSS could not send that feature suggestion.",
      status: "error",
    }
  }
}

export async function resendEmailVerificationAction(
  _previousState: ResendEmailVerificationActionState,
  _formData: FormData
): Promise<ResendEmailVerificationActionState> {
  const session = await auth()

  if (!session?.user?.id) {
    return {
      message: "You need to sign in before resending verification.",
      status: "error",
    }
  }

  const user = await getPrisma().user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      emailVerified: true,
    },
  })

  if (!user) {
    return {
      message: "We could not find your account. Log in again and retry.",
      status: "error",
    }
  }

  if (user.emailVerified) {
    return {
      message: "Your email is already verified.",
      status: "success",
    }
  }

  const rateLimit = await enforceRateLimit({
    action: "verification_resend",
    userId: session.user.id,
  })

  if (!rateLimit.allowed) {
    return { message: getRateLimitErrorMessage(), status: "error" }
  }

  try {
    await requestEmailVerification({
      email: user.email,
      userId: session.user.id,
    })
  } catch (error) {
    console.error("Failed to resend verification email.", error)

    return {
      message:
        "We could not send that email right now. Please try again in a few minutes.",
      status: "error",
    }
  }

  return {
    message: "Verification email sent. Check your inbox when it arrives.",
    status: "success",
  }
}

export async function setArticleReadAction(
  ...args: Parameters<typeof articleActions.setArticleReadAction>
) {
  return articleActions.setArticleReadAction(...args)
}

export async function setArticleStarredAction(
  ...args: Parameters<typeof articleActions.setArticleStarredAction>
) {
  return articleActions.setArticleStarredAction(...args)
}

export async function deleteArticleAction(
  ...args: Parameters<typeof articleActions.deleteArticleAction>
) {
  return articleActions.deleteArticleAction(...args)
}

export async function markAllReadAction(
  ...args: Parameters<typeof articleActions.markAllReadAction>
) {
  return articleActions.markAllReadAction(...args)
}

export async function cancelBulkReadAction(
  ...args: Parameters<typeof articleActions.cancelBulkReadAction>
) {
  return articleActions.cancelBulkReadAction(...args)
}

export async function addArticleToCollectionAction(
  ...args: Parameters<typeof articleActions.addArticleToCollectionAction>
) {
  return articleActions.addArticleToCollectionAction(...args)
}

export async function removeArticleFromCollectionAction(
  ...args: Parameters<typeof articleActions.removeArticleFromCollectionAction>
) {
  return articleActions.removeArticleFromCollectionAction(...args)
}

export async function addPodcastEpisodeToCollectionAction(
  ...args: Parameters<typeof articleActions.addPodcastEpisodeToCollectionAction>
) {
  return articleActions.addPodcastEpisodeToCollectionAction(...args)
}

export async function removePodcastEpisodeFromCollectionAction(
  ...args: Parameters<typeof articleActions.removePodcastEpisodeFromCollectionAction>
) {
  return articleActions.removePodcastEpisodeFromCollectionAction(...args)
}

export async function markArticleReadOnOpen(
  ...args: Parameters<typeof articleActions.markArticleReadOnOpen>
) {
  return articleActions.markArticleReadOnOpen(...args)
}

export async function generateArticleSummaryAction(
  ...args: Parameters<typeof aiActions.generateArticleSummaryAction>
) {
  return aiActions.generateArticleSummaryAction(...args)
}

export async function evaluateStoryClusterAction(
  ...args: Parameters<typeof aiActions.evaluateStoryClusterAction>
) {
  return aiActions.evaluateStoryClusterAction(...args)
}

export async function generateStoryClusterAnalysisAction(
  ...args: Parameters<typeof aiActions.generateStoryClusterAnalysisAction>
) {
  return aiActions.generateStoryClusterAnalysisAction(...args)
}

export async function dismissStoryClusterAction(
  ...args: Parameters<typeof aiActions.dismissStoryClusterAction>
) {
  return aiActions.dismissStoryClusterAction(...args)
}

export async function splitStoryClusterMemberAction(
  ...args: Parameters<typeof aiActions.splitStoryClusterMemberAction>
) {
  return aiActions.splitStoryClusterMemberAction(...args)
}

export async function mergeStoryClustersAction(
  ...args: Parameters<typeof aiActions.mergeStoryClustersAction>
) {
  return aiActions.mergeStoryClustersAction(...args)
}

export async function generateAiDigestAction(
  ...args: Parameters<typeof aiActions.generateAiDigestAction>
) {
  return aiActions.generateAiDigestAction(...args)
}

export async function updateAiPreferencesAction(
  ...args: Parameters<typeof aiActions.updateAiPreferencesAction>
) {
  return aiActions.updateAiPreferencesAction(...args)
}
export async function createFolderAction(formData: FormData) {
  const session = await auth()

  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }

  const name = String(formData.get("name") ?? "")

  try {
    await createFolder({
      name,
      userId: session.user.id,
    })
  } catch (error) {
    if (error instanceof FolderError) {
      return
    }

    throw error
  }

  revalidateFolderPaths()
  refresh()
}

export async function renameFolderAction(formData: FormData) {
  const session = await auth()

  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }

  const folderId = String(formData.get("folderId") ?? "").trim()
  const name = String(formData.get("name") ?? "")

  if (!folderId) {
    return
  }

  try {
    await renameFolder({
      folderId,
      name,
      userId: session.user.id,
    })
  } catch (error) {
    if (error instanceof FolderError) {
      return
    }

    throw error
  }

  revalidateFolderPaths(folderId)
  refresh()
}

export async function deleteFolderAction(formData: FormData) {
  const session = await auth()

  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }

  const folderId = String(formData.get("folderId") ?? "").trim()

  if (!folderId) {
    return
  }

  try {
    await deleteFolder({
      folderId,
      userId: session.user.id,
    })
  } catch (error) {
    if (error instanceof FolderError) {
      return
    }

    throw error
  }

  revalidateFolderPaths(folderId)
  refresh()
}

export async function moveSubscriptionToFolderAction(formData: FormData) {
  const session = await auth()

  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }

  const subscriptionId = String(formData.get("subscriptionId") ?? "").trim()
  const folderId = String(formData.get("folderId") ?? "").trim() || null

  if (!subscriptionId) {
    return
  }

  let previousFolderId: string | null | undefined

  try {
    const result = await moveSubscriptionToFolder({
      folderId,
      subscriptionId,
      userId: session.user.id,
    })
    previousFolderId = result.previousFolderId
  } catch (error) {
    if (error instanceof FolderError) {
      return
    }

    throw error
  }

  revalidateFolderPaths(previousFolderId, folderId)
  refresh()
}

function isImportJobId(value: string) {
  return value.length > 0 && value.length <= 100 && /^[a-zA-Z0-9_-]+$/.test(value)
}

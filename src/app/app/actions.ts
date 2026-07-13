"use server"

import { refresh, revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { enqueueAiDigest } from "@/lib/ai-digest-queue"
import { AiDigestError, requestAiDigestForUser } from "@/lib/ai-digests"
import {
  AiSummaryError,
  generateArticleSummaryForUser,
} from "@/lib/ai-summaries"
import {
  addPodcastEpisodeToCollection,
  addArticleToCollection,
  ArticleCollectionError,
  removePodcastEpisodeFromCollection,
  removeArticleFromCollection,
} from "@/lib/article-collections"
import {
  BugReportError,
  createBugReportForUser,
} from "@/lib/bug-reports"
import {
  FeatureSuggestionError,
  createFeatureSuggestionForUser,
} from "@/lib/feature-suggestions"
import { updateAiPreferencesForUser } from "@/lib/ai-dashboard"
import {
  ArticleStateError,
  deleteArticleForUser,
  setArticleReadState,
  setArticleStarredState,
  type ArticleReadScope,
} from "@/lib/articles"
import { cancelBulkReadJob, startBulkRead } from "@/lib/bulk-read-jobs"
import { getPrisma } from "@/lib/db"
import { getDiscoverDirectoryFeed } from "@/lib/discover-directory"
import { requestEmailVerification } from "@/lib/email-verification"
import { FeedValidationError } from "@/lib/feed-discovery"
import { FeedRefreshError, refreshFeed } from "@/lib/feed-refresh"
import {
  FeedSubscriptionError,
  getUserFeedSubscription,
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

export type UnsubscribeFeedActionState = {
  message: string
  status: "idle" | "success" | "error"
}

export type ImportOpmlActionState = {
  jobId?: string
  message: string
  status: "idle" | "success" | "error"
}

export type GenerateArticleSummaryActionState = {
  message: string
  status: "idle" | "success" | "error"
}

export type AddArticleToCollectionActionState = {
  message: string
  status: "idle" | "success" | "error"
}

export type AddPodcastEpisodeToCollectionActionState = {
  message: string
  status: "idle" | "success" | "error"
}

export type GenerateAiDigestActionState = {
  digestId?: string
  message: string
  status: "idle" | "success" | "error"
}

export type SubmitBugReportActionState = {
  message: string
  status: "idle" | "success" | "error"
}

export type SubmitFeatureSuggestionActionState = {
  message: string
  status: "idle" | "success" | "error"
}

export type UpdateAiPreferencesActionState = {
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

  revalidateReaderPaths()
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
    revalidatePath("/app", "layout")
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

  try {
    await unsubscribeFromFeed({
      subscriptionId,
      userId: session.user.id,
    })
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
    revalidateReaderPaths()
    revalidateSettingsPaths()
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

export async function setArticleReadAction(formData: FormData) {
  const session = await auth()

  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }

  const articleId = String(formData.get("articleId") ?? "").trim()
  const isRead = String(formData.get("isRead") ?? "") === "true"

  if (!articleId) {
    throw new Error("Article is required.")
  }

  await setArticleReadState({
    articleId,
    isRead,
    userId: session.user.id,
  })

  revalidateReaderPaths()
  refresh()
}

export async function setArticleStarredAction(formData: FormData) {
  const session = await auth()

  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }

  const articleId = String(formData.get("articleId") ?? "").trim()
  const isStarred = String(formData.get("isStarred") ?? "") === "true"

  if (!articleId) {
    throw new Error("Article is required.")
  }

  await setArticleStarredState({
    articleId,
    isStarred,
    userId: session.user.id,
  })

  revalidateReaderPaths()
  refresh()
}

export async function deleteArticleAction(formData: FormData) {
  const session = await auth()

  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }

  const articleId = String(formData.get("articleId") ?? "").trim()

  if (!articleId) {
    throw new Error("Article is required.")
  }

  await deleteArticleForUser({
    articleId,
    userId: session.user.id,
  })

  revalidateReaderPaths()
  revalidatePath(`/app/article/${articleId}`)
  refresh()
}

export async function markAllReadAction(formData: FormData) {
  const session = await auth()

  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }

  const scopeType = String(formData.get("scope") ?? "").trim()
  let scope: ArticleReadScope

  if (scopeType === "feed") {
    const feedId = String(formData.get("feedId") ?? "").trim()

    if (!feedId) {
      throw new Error("Feed is required.")
    }

    scope = {
      feedId,
      type: "feed",
    }
  } else if (scopeType === "all") {
    scope = {
      type: "all",
    }
  } else if (scopeType === "folder") {
    const folderId = String(formData.get("folderId") ?? "").trim()

    if (!folderId) {
      throw new Error("Folder is required.")
    }

    scope = {
      folderId,
      type: "folder",
    }
  } else {
    throw new Error("Unsupported read scope.")
  }

  await startBulkRead({
    scope,
    userId: session.user.id,
  })

  revalidateReaderPaths()
  refresh()
}

export async function cancelBulkReadAction(jobId: string) {
  const session = await auth()

  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }

  await cancelBulkReadJob({
    jobId,
    userId: session.user.id,
  })
  revalidateReaderPaths()
  refresh()
}

export async function addArticleToCollectionAction(
  _previousState: AddArticleToCollectionActionState,
  formData: FormData
): Promise<AddArticleToCollectionActionState> {
  const session = await auth()

  if (!session?.user?.id) {
    return {
      message: "You need to sign in before saving articles.",
      status: "error",
    }
  }

  const articleId = String(formData.get("articleId") ?? "").trim()
  const collectionId =
    String(formData.get("collectionId") ?? "").trim() || undefined
  const collectionName = formData.has("collectionName")
    ? String(formData.get("collectionName") ?? "")
    : undefined

  try {
    const result = await addArticleToCollection({
      articleId,
      collectionId,
      collectionName,
      userId: session.user.id,
    })
    revalidateCollectionPaths(result.collectionId)
  } catch (error) {
    if (error instanceof ArticleCollectionError) {
      return {
        message: error.message,
        status: "error",
      }
    }

    return {
      message: "Arctic RSS could not save that article.",
      status: "error",
    }
  }

  revalidateReaderPaths()
  refresh()

  return {
    message: "Article saved to collection.",
    status: "success",
  }
}

export async function removeArticleFromCollectionAction(formData: FormData) {
  const session = await auth()

  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }

  const articleId = String(formData.get("articleId") ?? "").trim()
  const collectionId = String(formData.get("collectionId") ?? "").trim()

  await removeArticleFromCollection({
    articleId,
    collectionId,
    userId: session.user.id,
  })

  revalidateCollectionPaths(collectionId)
  revalidateReaderPaths()
  refresh()
}

export async function addPodcastEpisodeToCollectionAction(
  _previousState: AddPodcastEpisodeToCollectionActionState,
  formData: FormData
): Promise<AddPodcastEpisodeToCollectionActionState> {
  const session = await auth()

  if (!session?.user?.id) {
    return {
      message: "You need to sign in before saving podcast episodes.",
      status: "error",
    }
  }

  const episodeId = String(formData.get("episodeId") ?? "").trim()
  const collectionId =
    String(formData.get("collectionId") ?? "").trim() || undefined
  const collectionName = formData.has("collectionName")
    ? String(formData.get("collectionName") ?? "")
    : undefined

  try {
    const result = await addPodcastEpisodeToCollection({
      collectionId,
      collectionName,
      episodeId,
      userId: session.user.id,
    })
    revalidateCollectionPaths(result.collectionId)
  } catch (error) {
    if (error instanceof ArticleCollectionError) {
      return {
        message: error.message,
        status: "error",
      }
    }

    return {
      message: "Arctic RSS could not save that podcast episode.",
      status: "error",
    }
  }

  revalidatePodcastPaths()
  refresh()

  return {
    message: "Episode saved to collection.",
    status: "success",
  }
}

export async function removePodcastEpisodeFromCollectionAction(
  formData: FormData
) {
  const session = await auth()

  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }

  const episodeId = String(formData.get("episodeId") ?? "").trim()
  const collectionId = String(formData.get("collectionId") ?? "").trim()

  await removePodcastEpisodeFromCollection({
    collectionId,
    episodeId,
    userId: session.user.id,
  })

  revalidateCollectionPaths(collectionId)
  revalidatePodcastPaths()
  refresh()
}

export async function markArticleReadOnOpen(articleId: string) {
  const session = await auth()

  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }

  try {
    await setArticleReadState({
      articleId,
      isRead: true,
      userId: session.user.id,
    })
  } catch (error) {
    if (error instanceof ArticleStateError) {
      return
    }

    throw error
  }
}

export async function generateArticleSummaryAction(
  _previousState: GenerateArticleSummaryActionState,
  formData: FormData
): Promise<GenerateArticleSummaryActionState> {
  const session = await auth()

  if (!session?.user?.id) {
    return {
      message: "You need to sign in before generating summaries.",
      status: "error",
    }
  }

  const articleId = String(formData.get("articleId") ?? "").trim()

  if (!articleId) {
    return {
      message: "Choose an article to summarize.",
      status: "error",
    }
  }

  const rateLimit = await enforceRateLimit({
    action: "ai_summary",
    userId: session.user.id,
  })

  if (!rateLimit.allowed) {
    return { message: getRateLimitErrorMessage(), status: "error" }
  }

  try {
    const summary = await generateArticleSummaryForUser({
      articleId,
      userId: session.user.id,
    })

    revalidateReaderPaths()
    refresh()

    return {
      message: summary.fromCache ? "Summary ready." : "Summary generated.",
      status: "success",
    }
  } catch (error) {
    if (error instanceof AiSummaryError) {
      return {
        message: error.message,
        status: "error",
      }
    }

    return {
      message: "Arctic RSS could not summarize that article.",
      status: "error",
    }
  }
}

export async function generateAiDigestAction(
  _previousState: GenerateAiDigestActionState,
  _formData: FormData
): Promise<GenerateAiDigestActionState> {
  void _previousState
  void _formData

  const session = await auth()

  if (!session?.user?.id) {
    return {
      message: "You need to sign in before generating a digest.",
      status: "error",
    }
  }

  const rateLimit = await enforceRateLimit({
    action: "ai_digest",
    userId: session.user.id,
  })

  if (!rateLimit.allowed) {
    return { message: getRateLimitErrorMessage(), status: "error" }
  }

  try {
    const digest = await requestAiDigestForUser({
      userId: session.user.id,
    })

    if (!digest.existing) {
      await enqueueAiDigest(digest.digestId)
    }

    revalidatePath("/app/ai")
    refresh()

    return {
      digestId: digest.digestId,
      message: digest.existing
        ? "Digest generation is already in progress."
        : "Digest generation started.",
      status: "success",
    }
  } catch (error) {
    if (error instanceof AiDigestError) {
      return {
        message: error.message,
        status: "error",
      }
    }

    return {
      message: "Arctic RSS could not start that digest.",
      status: "error",
    }
  }
}

export async function updateAiPreferencesAction(
  _previousState: UpdateAiPreferencesActionState,
  formData: FormData
): Promise<UpdateAiPreferencesActionState> {
  const session = await auth()

  if (!session?.user?.id) {
    return {
      message: "You need to sign in before updating AI preferences.",
      status: "error",
    }
  }

  try {
    await updateAiPreferencesForUser({
      aiAutoSummariesEnabled: formData.has("aiAutoSummariesEnabled"),
      dailyDigestEnabled: formData.has("dailyDigestEnabled"),
      userId: session.user.id,
    })

    revalidatePath("/app/ai")
    refresh()

    return {
      message: "AI preferences saved.",
      status: "success",
    }
  } catch {
    return {
      message: "Arctic RSS could not save those AI preferences.",
      status: "error",
    }
  }
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

  try {
    await moveSubscriptionToFolder({
      folderId,
      subscriptionId,
      userId: session.user.id,
    })
  } catch (error) {
    if (error instanceof FolderError) {
      return
    }

    throw error
  }

  revalidateFolderPaths(folderId ?? undefined)
  refresh()
}

function revalidateReaderPaths() {
  revalidatePath("/app")
  revalidatePath("/app", "layout")
  revalidatePath("/app/ai")
  revalidatePath("/app/collections")
  revalidatePath("/app/unread")
  revalidatePath("/app/starred")
  revalidatePath("/app/folders")
  revalidatePath("/app/settings/import-export")
}

function revalidatePodcastPaths() {
  revalidatePath("/app/podcasts")
  revalidatePath("/app/podcasts/discover")
}

function revalidateCollectionPaths(collectionId?: string) {
  revalidatePath("/app/collections")

  if (collectionId) {
    revalidatePath(`/app/collections/${collectionId}`)
  }
}

function revalidateFolderPaths(folderId?: string) {
  revalidateReaderPaths()
  revalidateSettingsPaths()

  if (folderId) {
    revalidatePath(`/app/folder/${folderId}`)
  }
}

function revalidateSettingsPaths() {
  revalidatePath("/app/settings")
  revalidatePath("/app/settings/import-export")
}

function isImportJobId(value: string) {
  return value.length > 0 && value.length <= 100 && /^[a-zA-Z0-9_-]+$/.test(value)
}

"use server"

import { refresh, revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { enqueueAiDigest } from "@/lib/ai-digest-queue"
import { AiDigestError, requestAiDigestForUser } from "@/lib/ai-digests"
import {
  AiSummaryError,
  generateArticleSummaryForUser,
} from "@/lib/ai-summaries"
import { updateAiPreferencesForUser } from "@/lib/ai-dashboard"
import {
  ArticleStateError,
  markArticlesRead,
  setArticleReadState,
  setArticleStarredState,
  type ArticleReadScope,
} from "@/lib/articles"
import { getPrisma } from "@/lib/db"
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
import { importOpmlForUser, OpmlError } from "@/lib/opml"
import { isDefaultView, type DefaultView } from "@/lib/preferences"
import { FeedFetchError, UnsafeUrlError } from "@/lib/url-safety"

export type AddFeedActionState = {
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
  errors?: string[]
  message: string
  status: "idle" | "success" | "error"
  summary?: {
    addedFeeds: number
    failedFeeds: number
    folderCount: number
    skippedFeeds: number
    totalFeeds: number
  }
}

export type GenerateArticleSummaryActionState = {
  message: string
  status: "idle" | "success" | "error"
}

export type GenerateAiDigestActionState = {
  digestId?: string
  message: string
  status: "idle" | "success" | "error"
}

export type UpdateAiPreferencesActionState = {
  message: string
  status: "idle" | "success" | "error"
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

  try {
    const subscription = await subscribeToFeed({
      folderId,
      url,
      userId: session.user.id,
    })
    let refreshMessage = "Article refresh will retry if needed."

    try {
      const refreshResult = await refreshFeed(subscription.feedId)
      refreshMessage = `Imported ${refreshResult.articleCount} articles.`
    } catch {
      refreshMessage = "Subscribed. Article refresh will retry."
    }

    revalidatePath("/app")
    refresh()

    return {
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

  let subscription: Awaited<ReturnType<typeof unsubscribeFromFeed>>

  try {
    subscription = await unsubscribeFromFeed({
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

  return {
    message: `Unsubscribed from ${subscription.title}.`,
    status: "success",
  }
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

  try {
    const summary = await importOpmlForUser({
      opmlXml: await file.text(),
      userId: session.user.id,
    })

    revalidateReaderPaths()
    revalidateSettingsPaths()
    refresh()

    return {
      errors: summary.errors.map(
        (error) => `${error.title}: ${error.message}`
      ),
      message: `Imported ${summary.addedFeeds} feeds. Skipped ${summary.skippedFeeds}; failed ${summary.failedFeeds}.`,
      status: "success",
      summary: {
        addedFeeds: summary.addedFeeds,
        failedFeeds: summary.failedFeeds,
        folderCount: summary.folderCount,
        skippedFeeds: summary.skippedFeeds,
        totalFeeds: summary.totalFeeds,
      },
    }
  } catch (error) {
    if (error instanceof OpmlError) {
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

  await markArticlesRead({
    scope,
    userId: session.user.id,
  })

  revalidateReaderPaths()
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

  revalidateReaderPaths()
  refresh()
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
  revalidatePath("/app/ai")
  revalidatePath("/app/unread")
  revalidatePath("/app/starred")
  revalidatePath("/app/folders")
  revalidatePath("/app/settings/import-export")
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

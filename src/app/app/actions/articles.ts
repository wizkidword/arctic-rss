"use server"

import { refresh, revalidatePath } from "next/cache"

import { auth } from "@/auth"
import {
  addArticleToCollection,
  addPodcastEpisodeToCollection,
  ArticleCollectionError,
  removeArticleFromCollection,
  removePodcastEpisodeFromCollection,
} from "@/lib/article-collections"
import {
  ArticleStateError,
  deleteArticleForUser,
  setArticleReadState,
  setArticleStarredState,
  type ArticleReadScope,
} from "@/lib/articles"
import { cancelBulkReadJob, startBulkRead } from "@/lib/bulk-read-jobs"

import {
  revalidateArticleListPaths,
  revalidateCollectionPaths,
  revalidatePodcastPaths,
} from "./revalidation"

export type AddArticleToCollectionActionState = {
  message: string
  status: "idle" | "success" | "error"
}

export type AddPodcastEpisodeToCollectionActionState = {
  message: string
  status: "idle" | "success" | "error"
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

  revalidateArticleListPaths()
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

  revalidateArticleListPaths()
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

  revalidateArticleListPaths()
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

  revalidateArticleListPaths()
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
  revalidateArticleListPaths()
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

  revalidateArticleListPaths()
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
  revalidateArticleListPaths()
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

"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import {
  acknowledgeSavedSearchMonitorForUser,
  createSavedSearchForUser,
  deleteSavedSearchForUser,
  setSavedSearchMonitorEnabledForUser,
  SavedSearchError,
} from "@/lib/saved-searches"
import { parseArticleSearchFilters, type ArticleSearchParams } from "@/lib/article-search"

export type SavedSearchActionState = {
  message: string
  status: "idle" | "success" | "error"
}

export async function createSavedSearchAction(
  _previousState: SavedSearchActionState,
  formData: FormData
): Promise<SavedSearchActionState> {
  const session = await auth()

  if (!session?.user?.id) {
    return {
      message: "You need to sign in before saving a search.",
      status: "error",
    }
  }

  try {
    await createSavedSearchForUser({
      input: {
        description: formValue(formData, "description"),
        filters: parseArticleSearchFilters(searchParamsFromFormData(formData)),
        name: formValue(formData, "name"),
      },
      userId: session.user.id,
    })
  } catch (error) {
    if (error instanceof SavedSearchError) {
      return { message: error.message, status: "error" }
    }

    return {
      message: "Arctic RSS could not save that search.",
      status: "error",
    }
  }

  revalidatePath("/app/saved-searches")
  redirect("/app/saved-searches")
}

export async function deleteSavedSearchAction(formData: FormData) {
  const session = await auth()

  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }

  try {
    await deleteSavedSearchForUser({
      savedSearchId: formValue(formData, "savedSearchId"),
      userId: session.user.id,
    })
  } catch (error) {
    if (!(error instanceof SavedSearchError)) {
      throw error
    }
  }

  revalidatePath("/app/saved-searches")
}

export async function setSavedSearchMonitorEnabledAction(formData: FormData) {
  const session = await auth()

  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }

  const enabled = formValue(formData, "enabled")

  if (enabled !== "true" && enabled !== "false") {
    return
  }

  try {
    await setSavedSearchMonitorEnabledForUser({
      enabled: enabled === "true",
      savedSearchId: formValue(formData, "savedSearchId"),
      userId: session.user.id,
    })
  } catch (error) {
    if (!(error instanceof SavedSearchError)) {
      throw error
    }
  }

  revalidatePath("/app/saved-searches")
}

export async function acknowledgeSavedSearchMonitorAction(formData: FormData) {
  const session = await auth()

  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }

  try {
    await acknowledgeSavedSearchMonitorForUser({
      savedSearchId: formValue(formData, "savedSearchId"),
      userId: session.user.id,
    })
  } catch (error) {
    if (!(error instanceof SavedSearchError)) {
      throw error
    }
  }

  revalidatePath("/app/saved-searches")
}

function searchParamsFromFormData(formData: FormData): ArticleSearchParams {
  return {
    collection: formValue(formData, "collection") || undefined,
    folder: formValue(formData, "folder") || undefined,
    from: formValue(formData, "from") || undefined,
    q: formValue(formData, "q") || undefined,
    source: formValue(formData, "source") || undefined,
    state: formValue(formData, "state") || undefined,
    to: formValue(formData, "to") || undefined,
  }
}

function formValue(formData: FormData, key: string) {
  const value = formData.get(key)

  return typeof value === "string" ? value : ""
}

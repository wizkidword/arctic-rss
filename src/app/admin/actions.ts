"use server"

import { refresh, revalidatePath } from "next/cache"

import { auth } from "@/auth"
import {
  DiscoverOpmlImportError,
  importDiscoverOpml,
} from "@/lib/discover-directory-import"
import {
  DiscoverCategoryMetadataError,
  updateDiscoverCategoryMetadata,
} from "@/lib/discover-category-customizations"
import {
  DiscoverSubredditError,
  addDiscoverSubredditToRedditTopic,
} from "@/lib/discover-subreddits"
import { OpmlError } from "@/lib/opml"

const MAX_DISCOVER_OPML_IMPORT_BYTES = 4 * 1024 * 1024

export type ImportDiscoverOpmlActionState = {
  errors?: string[]
  message: string
  status: "idle" | "success" | "error"
  summary?: {
    categoriesCreated: number
    categoriesUpdated: number
    failedFeeds: number
    importedFeeds: number
    totalFeeds: number
  }
}

export type UpdateDiscoverCategoryMetadataActionState = {
  message: string
  status: "idle" | "success" | "error"
}

export type AddDiscoverSubredditActionState = {
  message: string
  status: "idle" | "success" | "error"
}

export async function importDiscoverOpmlAction(
  _previousState: ImportDiscoverOpmlActionState,
  formData: FormData
): Promise<ImportDiscoverOpmlActionState> {
  const session = await auth()

  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return {
      message: "Only administrators can import Discover OPML files.",
      status: "error",
    }
  }

  const file = formData.get("opmlFile")

  if (!(file instanceof File) || file.size === 0) {
    return {
      message: "Choose an OPML file to add to Discover.",
      status: "error",
    }
  }

  if (file.size > MAX_DISCOVER_OPML_IMPORT_BYTES) {
    return {
      message: "Discover OPML imports are limited to 4 MB.",
      status: "error",
    }
  }

  try {
    const summary = await importDiscoverOpml({
      adminUserId: session.user.id,
      categoryName: fieldValue(formData, "categoryName"),
      countryCode: fieldValue(formData, "countryCode"),
      description: fieldValue(formData, "description"),
      fileName: file.name,
      opmlXml: await file.text(),
    })

    revalidatePath("/app/discover")
    refresh()

    const errors = summary.errors.map(
      (error) => `${error.title}: ${error.message}`
    )

    return {
      ...(errors.length ? { errors } : {}),
      message: `Imported ${summary.importedFeeds} feeds across ${summary.categoriesCreated + summary.categoriesUpdated} ${summary.categoriesCreated + summary.categoriesUpdated === 1 ? "category" : "categories"}. Failed ${summary.failedFeeds}.`,
      status: "success",
      summary: {
        categoriesCreated: summary.categoriesCreated,
        categoriesUpdated: summary.categoriesUpdated,
        failedFeeds: summary.failedFeeds,
        importedFeeds: summary.importedFeeds,
        totalFeeds: summary.totalFeeds,
      },
    }
  } catch (error) {
    if (
      error instanceof DiscoverOpmlImportError ||
      error instanceof OpmlError
    ) {
      return {
        message: error.message,
        status: "error",
      }
    }

    return {
      message: "Arctic RSS could not import that Discover OPML file.",
      status: "error",
    }
  }
}

export async function updateDiscoverCategoryMetadataAction(
  _previousState: UpdateDiscoverCategoryMetadataActionState,
  formData: FormData
): Promise<UpdateDiscoverCategoryMetadataActionState> {
  const session = await auth()

  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return {
      message: "Only administrators can edit Discover cards.",
      status: "error",
    }
  }

  try {
    const result = await updateDiscoverCategoryMetadata({
      adminUserId: session.user.id,
      categoryId: fieldValue(formData, "categoryId"),
      description: fieldValue(formData, "description"),
      iconKey: fieldValue(formData, "iconKey"),
    })

    revalidatePath("/admin")
    revalidatePath("/app/discover")
    refresh()

    return {
      message: `Updated ${result.label}.`,
      status: "success",
    }
  } catch (error) {
    if (error instanceof DiscoverCategoryMetadataError) {
      return {
        message: error.message,
        status: "error",
      }
    }

    return {
      message: "Arctic RSS could not update that Discover card.",
      status: "error",
    }
  }
}

export async function addDiscoverSubredditAction(
  _previousState: AddDiscoverSubredditActionState,
  formData: FormData
): Promise<AddDiscoverSubredditActionState> {
  const session = await auth()

  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return {
      message: "Only administrators can add subreddits to Discover.",
      status: "error",
    }
  }

  try {
    const result = await addDiscoverSubredditToRedditTopic({
      adminUserId: session.user.id,
      subredditName: fieldValue(formData, "subredditName"),
    })

    revalidatePath("/admin")
    revalidatePath("/app/discover")
    refresh()

    return {
      message: `Added ${result.label} to Reddit.`,
      status: "success",
    }
  } catch (error) {
    if (error instanceof DiscoverSubredditError) {
      return {
        message: error.message,
        status: "error",
      }
    }

    return {
      message: "Arctic RSS could not add that subreddit.",
      status: "error",
    }
  }
}

function fieldValue(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim()

  return value || undefined
}

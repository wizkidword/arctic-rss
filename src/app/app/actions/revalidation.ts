import { revalidatePath } from "next/cache"

export function revalidateArticleListPaths() {
  // Article state only changes the three reader lists. refresh() updates the
  // authenticated route that initiated the Server Action.
  revalidatePath("/app")
  revalidatePath("/app/unread")
  revalidatePath("/app/starred")
}

export function revalidatePodcastPaths() {
  revalidatePath("/app/podcasts")
  revalidatePath("/app/podcasts/discover")
}

export function revalidateCollectionPaths(collectionId?: string) {
  revalidatePath("/app/collections")

  if (collectionId) {
    revalidatePath(`/app/collections/${collectionId}`)
  }
}

export function revalidateFeedSubscriptionPaths(folderId?: string | null) {
  revalidateArticleListPaths()
  revalidateFolderPaths(folderId)
}

export function revalidateFolderPaths(
  ...folderIds: Array<string | null | undefined>
) {
  revalidatePath("/app/folders")
  revalidatePath("/app/settings/import-export")

  for (const folderId of new Set(folderIds)) {
    if (folderId) {
      revalidatePath(`/app/folder/${folderId}`)
    }
  }
}

export function revalidateSettingsPaths() {
  revalidatePath("/app/settings")
  revalidatePath("/app/settings/import-export")
}

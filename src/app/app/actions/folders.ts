"use server"

import { refresh } from "next/cache"

import { auth } from "@/auth"
import {
  createFolder,
  deleteFolder,
  FolderError,
  moveSubscriptionToFolder,
  renameFolder,
} from "@/lib/folders"

import { revalidateFolderPaths } from "./revalidation"

export async function createFolderAction(formData: FormData) {
  const session = await auth()

  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }

  try {
    await createFolder({ name: String(formData.get("name") ?? ""), userId: session.user.id })
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

  if (!folderId) {
    return
  }

  try {
    await renameFolder({
      folderId,
      name: String(formData.get("name") ?? ""),
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
    await deleteFolder({ folderId, userId: session.user.id })
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

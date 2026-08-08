"use server"

import { refresh } from "next/cache"

import { auth } from "@/auth"
import {
  cancelOpmlImportJob,
  createOpmlImportJob,
  OpmlImportJobError,
  retryOpmlImportJob,
} from "@/lib/opml-import-jobs"
import { OpmlError } from "@/lib/opml"
import { enforceRateLimit, getRateLimitErrorMessage } from "@/lib/rate-limit"

import { revalidateSettingsPaths } from "./revalidation"

const MAX_OPML_IMPORT_BYTES = 2 * 1024 * 1024

export type ImportOpmlActionState = {
  jobId?: string
  message: string
  status: "idle" | "success" | "error"
}

export async function importOpmlAction(
  _previousState: ImportOpmlActionState,
  formData: FormData
): Promise<ImportOpmlActionState> {
  const session = await auth()

  if (!session?.user?.id) {
    return { message: "You need to sign in before importing OPML.", status: "error" }
  }

  const file = formData.get("opmlFile")
  if (!(file instanceof File) || file.size === 0) {
    return { message: "Choose an OPML file to import.", status: "error" }
  }
  if (file.size > MAX_OPML_IMPORT_BYTES) {
    return { message: "OPML imports are limited to 2 MB.", status: "error" }
  }

  const rateLimit = await enforceRateLimit({ action: "opml_import", userId: session.user.id })
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
      return { message: error.message, status: "error" }
    }
    return { message: "Arctic RSS could not import that OPML file.", status: "error" }
  }
}

export async function cancelOpmlImportAction(formData: FormData) {
  const session = await auth()
  const jobId = formData.get("jobId")
  if (!session?.user?.id || typeof jobId !== "string" || !isImportJobId(jobId)) {
    return
  }
  await cancelOpmlImportJob({ jobId, userId: session.user.id })
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
    await retryOpmlImportJob({ jobId, userId: session.user.id })
  } catch (error) {
    if (!(error instanceof OpmlImportJobError)) {
      throw error
    }
  }
  revalidateSettingsPaths()
  refresh()
}

function isImportJobId(value: string) {
  return value.length > 0 && value.length <= 100 && /^[a-zA-Z0-9_-]+$/.test(value)
}

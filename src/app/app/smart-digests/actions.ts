"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import {
  createSmartDigestRuleForUser,
  SmartDigestError,
  type SmartDigestInput,
} from "@/lib/smart-digests"

export type SmartDigestRuleActionState = {
  message: string
  status: "idle" | "success" | "error"
}

export async function createSmartDigestRuleAction(
  _previousState: SmartDigestRuleActionState,
  formData: FormData
): Promise<SmartDigestRuleActionState> {
  const session = await auth()

  if (!session?.user?.id) {
    return {
      message: "You need to sign in before creating Smart Digests.",
      status: "error",
    }
  }

  let ruleId = ""

  try {
    const rule = await createSmartDigestRuleForUser({
      input: smartDigestInputFromFormData(formData),
      userId: session.user.id,
    })

    ruleId = rule.id
  } catch (error) {
    if (error instanceof SmartDigestError) {
      return { message: error.message, status: "error" }
    }

    return {
      message: "Arctic RSS could not create that Smart Digest.",
      status: "error",
    }
  }

  revalidatePath("/app/smart-digests")
  redirect(`/app/smart-digests/${encodeURIComponent(ruleId)}`)
}

function smartDigestInputFromFormData(formData: FormData): SmartDigestInput {
  return {
    emailEnabled: formData.has("emailEnabled"),
    excludeTerms: String(formData.get("excludeTerms") ?? ""),
    feedSubscriptionIds: formData.getAll("feedSubscriptionIds").map(String),
    folderIds: formData.getAll("folderIds").map(String),
    includeTerms: String(formData.get("includeTerms") ?? ""),
    name: String(formData.get("name") ?? ""),
    scheduledHour: Number(formData.get("scheduledHour") ?? 8),
    sourceScope: String(
      formData.get("sourceScope") || "ALL_FEEDS"
    ) as SmartDigestInput["sourceScope"],
    timeZone: String(formData.get("timeZone") || "UTC"),
    topicPrompt: String(formData.get("topicPrompt") ?? ""),
  }
}

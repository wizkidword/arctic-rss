"use server"

import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { BugReportError, createBugReportForUser } from "@/lib/bug-reports"
import { FeatureSuggestionError, createFeatureSuggestionForUser } from "@/lib/feature-suggestions"
import { enforceRateLimit, getRateLimitErrorMessage } from "@/lib/rate-limit"

type ActionState = { message: string; status: "idle" | "success" | "error" }
export type SubmitBugReportActionState = ActionState
export type SubmitFeatureSuggestionActionState = ActionState

export async function submitBugReportAction(
  _previousState: SubmitBugReportActionState,
  formData: FormData
): Promise<SubmitBugReportActionState> {
  const session = await auth()
  if (!session?.user?.id) return { message: "You need to sign in before reporting a bug.", status: "error" }
  if (!(await isAllowed(session.user.id))) return { message: getRateLimitErrorMessage(), status: "error" }
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
    return { message: "Thanks, your bug report was sent.", status: "success" }
  } catch (error) {
    return error instanceof BugReportError
      ? { message: error.message, status: "error" }
      : { message: "Arctic RSS could not send that bug report.", status: "error" }
  }
}

export async function submitFeatureSuggestionAction(
  _previousState: SubmitFeatureSuggestionActionState,
  formData: FormData
): Promise<SubmitFeatureSuggestionActionState> {
  const session = await auth()
  if (!session?.user?.id) return { message: "You need to sign in before suggesting a feature.", status: "error" }
  if (!(await isAllowed(session.user.id))) return { message: getRateLimitErrorMessage(), status: "error" }
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
    return { message: "Thanks, your feature suggestion was sent.", status: "success" }
  } catch (error) {
    return error instanceof FeatureSuggestionError
      ? { message: error.message, status: "error" }
      : { message: "Arctic RSS could not send that feature suggestion.", status: "error" }
  }
}

async function isAllowed(userId: string) {
  return (await enforceRateLimit({ action: "feedback", userId })).allowed
}

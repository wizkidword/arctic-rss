import { refresh, revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { enqueueAiDigest } from "@/lib/ai-digest-queue"
import {
  AiDigestError,
  isAiDigestPeriod,
  requestAiDigestForUser,
  type AiDigestPeriod,
} from "@/lib/ai-digests"
import {
  AiSummaryError,
  generateArticleSummaryForUser,
} from "@/lib/ai-summaries"
import {
  generateStoryClusterAnalysisForUser,
  StoryClusterAnalysisError,
} from "@/lib/story-cluster-analysis"
import { updateAiPreferencesForUser } from "@/lib/ai-dashboard"
import {
  enforceRateLimit,
  getRateLimitErrorMessage,
} from "@/lib/rate-limit"
import {
  evaluateStoryClustersForArticleUser,
  StoryClusterReaderError,
} from "@/lib/story-cluster-reader"
import {
  dismissStoryClusterForUser,
  mergeStoryClustersForUser,
  splitStoryClusterMemberForUser,
  StoryClusterControlError,
} from "@/lib/story-cluster-controls"

import { revalidateArticleListPaths } from "./revalidation"

export type GenerateArticleSummaryActionState = {
  message: string
  status: "idle" | "success" | "error"
}

export type EvaluateStoryClusterActionState = {
  message: string
  status: "idle" | "success" | "error"
}

export type GenerateStoryClusterAnalysisActionState = {
  message: string
  status: "idle" | "success" | "error"
}

export type DismissStoryClusterActionState = {
  message: string
  status: "idle" | "success" | "error"
}

export type SplitStoryClusterMemberActionState = {
  message: string
  status: "idle" | "success" | "error"
}

export type MergeStoryClustersActionState = {
  message: string
  status: "idle" | "success" | "error"
}

export type GenerateAiDigestActionState = {
  digestId?: string
  message: string
  period?: AiDigestPeriod
  status: "idle" | "success" | "error"
}

export type UpdateAiPreferencesActionState = {
  message: string
  status: "idle" | "success" | "error"
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

    revalidateArticleListPaths()
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

export async function evaluateStoryClusterAction(
  _previousState: EvaluateStoryClusterActionState,
  formData: FormData
): Promise<EvaluateStoryClusterActionState> {
  const session = await auth()

  if (!session?.user?.id) {
    return {
      message: "You need to sign in before checking related coverage.",
      status: "error",
    }
  }

  const articleId = String(formData.get("articleId") ?? "").trim()

  if (!articleId) {
    return {
      message: "Choose an article before checking related coverage.",
      status: "error",
    }
  }

  const rateLimit = await enforceRateLimit({
    action: "story_cluster_evaluation",
    userId: session.user.id,
  })

  if (!rateLimit.allowed) {
    return { message: getRateLimitErrorMessage(), status: "error" }
  }

  try {
    const result = await evaluateStoryClustersForArticleUser({
      articleId,
      userId: session.user.id,
    })

    if (!result.matched) {
      return {
        message: "No matching coverage was found in your latest 50 visible articles.",
        status: "success",
      }
    }

    if (result.dismissed) {
      return {
        message: "You previously dismissed matching coverage for this article. Your original articles remain visible.",
        status: "success",
      }
    }

    revalidateArticleListPaths()
    revalidatePath(`/app/article/${encodeURIComponent(articleId)}`)
    refresh()

    return {
      message: result.created
        ? "Related coverage is ready."
        : "Related coverage is already up to date.",
      status: "success",
    }
  } catch (error) {
    if (error instanceof StoryClusterReaderError) {
      return {
        message: error.message,
        status: "error",
      }
    }

    return {
      message: "Arctic RSS could not check related coverage.",
      status: "error",
    }
  }
}

export async function generateStoryClusterAnalysisAction(
  _previousState: GenerateStoryClusterAnalysisActionState,
  formData: FormData
): Promise<GenerateStoryClusterAnalysisActionState> {
  const session = await auth()

  if (!session?.user?.id) {
    return {
      message: "You need to sign in before generating a cited comparison.",
      status: "error",
    }
  }

  const articleId = String(formData.get("articleId") ?? "").trim()
  const clusterId = String(formData.get("clusterId") ?? "").trim()

  if (!articleId || !clusterId) {
    return {
      message: "Choose an available story group before generating a comparison.",
      status: "error",
    }
  }

  const rateLimit = await enforceRateLimit({
    action: "story_cluster_analysis",
    userId: session.user.id,
  })

  if (!rateLimit.allowed) {
    return { message: getRateLimitErrorMessage(), status: "error" }
  }

  try {
    const analysis = await generateStoryClusterAnalysisForUser({
      clusterId,
      userId: session.user.id,
    })

    revalidateArticleListPaths()
    revalidatePath(`/app/article/${encodeURIComponent(articleId)}`)
    refresh()

    return {
      message: analysis.fromCache
        ? "Cited source analysis ready."
        : "Cited source analysis generated.",
      status: "success",
    }
  } catch (error) {
    if (error instanceof StoryClusterAnalysisError) {
      return {
        message: error.message,
        status: "error",
      }
    }

    return {
      message: "Arctic RSS could not generate that cited comparison.",
      status: "error",
    }
  }
}

export async function dismissStoryClusterAction(
  _previousState: DismissStoryClusterActionState,
  formData: FormData
): Promise<DismissStoryClusterActionState> {
  const session = await auth()

  if (!session?.user?.id) {
    return {
      message: "You need to sign in before dismissing related coverage.",
      status: "error",
    }
  }

  const articleId = String(formData.get("articleId") ?? "").trim()
  const clusterId = String(formData.get("clusterId") ?? "").trim()

  if (!articleId || !clusterId) {
    return {
      message: "Choose an available related-coverage group first.",
      status: "error",
    }
  }

  const rateLimit = await enforceRateLimit({
    action: "story_cluster_control",
    userId: session.user.id,
  })

  if (!rateLimit.allowed) {
    return { message: getRateLimitErrorMessage(), status: "error" }
  }

  try {
    const result = await dismissStoryClusterForUser({
      clusterId,
      userId: session.user.id,
    })

    if (!result.dismissed) {
      return {
        message: "This related-coverage group is already dismissed.",
        status: "success",
      }
    }

    revalidateArticleListPaths()
    revalidatePath(`/app/article/${encodeURIComponent(articleId)}`)
    refresh()

    return {
      message: "Related-coverage group dismissed. Your original articles are unchanged.",
      status: "success",
    }
  } catch (error) {
    if (error instanceof StoryClusterControlError) {
      return {
        message: error.message,
        status: "error",
      }
    }

    return {
      message: "Arctic RSS could not dismiss this related-coverage group.",
      status: "error",
    }
  }
}

export async function splitStoryClusterMemberAction(
  _previousState: SplitStoryClusterMemberActionState,
  formData: FormData
): Promise<SplitStoryClusterMemberActionState> {
  const session = await auth()

  if (!session?.user?.id) {
    return {
      message: "You need to sign in before separating related coverage.",
      status: "error",
    }
  }

  const articleId = String(formData.get("articleId") ?? "").trim()
  const clusterId = String(formData.get("clusterId") ?? "").trim()
  const memberArticleId = String(formData.get("memberArticleId") ?? "").trim()

  if (!articleId || !clusterId || !memberArticleId) {
    return {
      message: "Choose an available source and related-coverage group first.",
      status: "error",
    }
  }

  const rateLimit = await enforceRateLimit({
    action: "story_cluster_control",
    userId: session.user.id,
  })

  if (!rateLimit.allowed) {
    return { message: getRateLimitErrorMessage(), status: "error" }
  }

  try {
    const result = await splitStoryClusterMemberForUser({
      clusterId,
      memberArticleId,
      userId: session.user.id,
    })

    if (!result.split) {
      return {
        message: "This source is already separated from the related-coverage group.",
        status: "success",
      }
    }

    revalidateArticleListPaths()
    revalidatePath(`/app/article/${encodeURIComponent(articleId)}`)
    refresh()

    return {
      message: "Source separated from the related-coverage group. Original articles are unchanged.",
      status: "success",
    }
  } catch (error) {
    if (error instanceof StoryClusterControlError) {
      return {
        message: error.message,
        status: "error",
      }
    }

    return {
      message: "Arctic RSS could not separate this source from the related-coverage group.",
      status: "error",
    }
  }
}

export async function mergeStoryClustersAction(
  _previousState: MergeStoryClustersActionState,
  formData: FormData
): Promise<MergeStoryClustersActionState> {
  const session = await auth()

  if (!session?.user?.id) {
    return {
      message: "You need to sign in before merging related coverage.",
      status: "error",
    }
  }

  const articleId = String(formData.get("articleId") ?? "").trim()
  const firstClusterId = String(formData.get("firstClusterId") ?? "").trim()
  const secondClusterId = String(formData.get("secondClusterId") ?? "").trim()

  if (!articleId || !firstClusterId || !secondClusterId) {
    return {
      message: "Choose two available related-coverage groups first.",
      status: "error",
    }
  }

  const rateLimit = await enforceRateLimit({
    action: "story_cluster_control",
    userId: session.user.id,
  })

  if (!rateLimit.allowed) {
    return { message: getRateLimitErrorMessage(), status: "error" }
  }

  try {
    const result = await mergeStoryClustersForUser({
      firstClusterId,
      secondClusterId,
      userId: session.user.id,
    })

    if (!result.merged) {
      return {
        message: "These related-coverage groups are already merged.",
        status: "success",
      }
    }

    revalidateArticleListPaths()
    revalidatePath(`/app/article/${encodeURIComponent(articleId)}`)
    refresh()

    return {
      message: "Related-coverage groups merged. Original articles are unchanged.",
      status: "success",
    }
  } catch (error) {
    if (error instanceof StoryClusterControlError) {
      return {
        message: error.message,
        status: "error",
      }
    }

    return {
      message: "Arctic RSS could not merge these related-coverage groups.",
      status: "error",
    }
  }
}

export async function generateAiDigestAction(
  _previousState: GenerateAiDigestActionState,
  formData: FormData
): Promise<GenerateAiDigestActionState> {
  void _previousState

  const submittedPeriod = formData.get("period")
  const period =
    submittedPeriod === null
      ? "DAILY"
      : isAiDigestPeriod(submittedPeriod)
        ? submittedPeriod
        : null

  if (!period) {
    return {
      message: "Choose a daily or weekly briefing.",
      status: "error",
    }
  }

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
      period,
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
        ? "A briefing is already in progress."
        : `${period === "WEEKLY" ? "Weekly" : "Daily"} briefing started.`,
      period,
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

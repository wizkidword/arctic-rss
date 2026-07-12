"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import {
  markPodcastEpisodePlayed,
  savePodcastPlaybackProgress,
  togglePodcastEpisodeStar,
} from "@/lib/podcast-episode-state"
import {
  PodcastSubscriptionError,
  subscribeToPodcast,
  unsubscribeFromPodcast,
} from "@/lib/podcast-subscriptions"

export type PodcastActionState = {
  analytics?: {
    firstSourceSubscribed: boolean
    sourceType: "podcast"
  }
  message: string
  status: "idle" | "success" | "error"
}

export async function subscribeToPodcastAction(
  formData: FormData
): Promise<PodcastActionState> {
  const session = await auth()

  if (!session?.user?.id) {
    return {
      message: "You need to sign in before subscribing to podcasts.",
      status: "error",
    }
  }

  const url = String(formData.get("url") ?? "").trim()

  if (!url) {
    return {
      message: "Podcast RSS URL is required.",
      status: "error",
    }
  }

  try {
    const subscription = await subscribeToPodcast({
      url,
      userId: session.user.id,
    })
    const episodeMessage =
      typeof subscription.initialEpisodeCount === "number"
        ? `Imported ${subscription.initialEpisodeCount} ${
            subscription.initialEpisodeCount === 1 ? "episode" : "episodes"
          }.`
        : "Episodes will refresh soon."

    revalidatePodcastPaths()

    return {
      analytics: getPodcastSubscriptionAnalytics(subscription),
      message: `Subscribed to ${
        subscription.customTitle || subscription.podcast.title
      }. ${episodeMessage}`,
      status: "success",
    }
  } catch (error) {
    if (error instanceof PodcastSubscriptionError) {
      return {
        message: error.message,
        status: "error",
      }
    }

    return {
      message: "We could not subscribe to that podcast right now.",
      status: "error",
    }
  }
}

export async function subscribeToPodcastStateAction(
  _previousState: PodcastActionState,
  formData: FormData
): Promise<PodcastActionState> {
  return subscribeToPodcastAction(formData)
}

function getPodcastSubscriptionAnalytics(subscription: {
  sourceCountBeforeSubscribe?: number
}): PodcastActionState["analytics"] {
  if (typeof subscription.sourceCountBeforeSubscribe !== "number") {
    return undefined
  }

  return {
    firstSourceSubscribed: subscription.sourceCountBeforeSubscribe === 0,
    sourceType: "podcast",
  }
}

export async function unsubscribePodcastAction(
  formData: FormData
): Promise<PodcastActionState> {
  const session = await auth()

  if (!session?.user?.id) {
    return {
      message: "You need to sign in before unsubscribing from podcasts.",
      status: "error",
    }
  }

  const subscriptionId = String(formData.get("subscriptionId") ?? "").trim()

  if (!subscriptionId) {
    return {
      message: "Choose a podcast subscription to unsubscribe from.",
      status: "error",
    }
  }

  try {
    await unsubscribeFromPodcast({
      subscriptionId,
      userId: session.user.id,
    })
  } catch (error) {
    if (error instanceof PodcastSubscriptionError) {
      return {
        message: error.message,
        status: "error",
      }
    }

    return {
      message: "We could not unsubscribe from that podcast right now.",
      status: "error",
    }
  }

  revalidatePodcastPaths()
  redirect("/app/podcasts")
}

export async function savePodcastPlaybackProgressAction(
  formData: FormData
): Promise<PodcastActionState> {
  const user = await getPodcastActionUser()

  if (!user) {
    return podcastEpisodeAuthError()
  }

  const episodeId = String(formData.get("episodeId") ?? "").trim()

  if (!episodeId) {
    return {
      message: "Choose a podcast episode.",
      status: "error",
    }
  }

  try {
    await savePodcastPlaybackProgress({
      episodeId,
      playbackPositionSeconds: Number(
        formData.get("playbackPositionSeconds") ?? 0
      ),
      userId: user.id,
    })
  } catch (error) {
    return podcastEpisodeError(error)
  }

  revalidatePodcastHome()

  return {
    message: "Progress saved.",
    status: "success",
  }
}

export async function markPodcastEpisodePlayedAction(
  formData: FormData
): Promise<PodcastActionState> {
  const user = await getPodcastActionUser()

  if (!user) {
    return podcastEpisodeAuthError()
  }

  const episodeId = String(formData.get("episodeId") ?? "").trim()

  if (!episodeId) {
    return {
      message: "Choose a podcast episode.",
      status: "error",
    }
  }

  try {
    await markPodcastEpisodePlayed({
      episodeId,
      isPlayed: String(formData.get("isPlayed")) === "true",
      userId: user.id,
    })
  } catch (error) {
    return podcastEpisodeError(error)
  }

  revalidatePodcastHome()

  return {
    message: "Episode updated.",
    status: "success",
  }
}

export async function togglePodcastEpisodeStarAction(
  formData: FormData
): Promise<PodcastActionState> {
  const user = await getPodcastActionUser()

  if (!user) {
    return podcastEpisodeAuthError()
  }

  const episodeId = String(formData.get("episodeId") ?? "").trim()

  if (!episodeId) {
    return {
      message: "Choose a podcast episode.",
      status: "error",
    }
  }

  try {
    await togglePodcastEpisodeStar({
      episodeId,
      userId: user.id,
    })
  } catch (error) {
    return podcastEpisodeError(error)
  }

  revalidatePodcastHome()

  return {
    message: "Episode updated.",
    status: "success",
  }
}

function revalidatePodcastPaths() {
  const paths: Array<Parameters<typeof revalidatePath>> = [
    ["/app"],
    ["/app", "layout"],
    ["/app/podcasts"],
    ["/app/podcasts/discover"],
  ]

  for (const pathArgs of paths) {
    try {
      revalidatePath(...pathArgs)
    } catch {
      // The mutation is committed; each cache invalidation is best effort.
    }
  }
}

async function getPodcastActionUser() {
  const session = await auth()

  return session?.user?.id ? { id: session.user.id } : null
}

function podcastEpisodeAuthError(): PodcastActionState {
  return {
    message: "You need to sign in before updating podcast episodes.",
    status: "error",
  }
}

function podcastEpisodeError(error: unknown): PodcastActionState {
  return {
    message:
      error instanceof Error && error.message
        ? error.message
        : "We could not update that podcast episode right now.",
    status: "error",
  }
}

function revalidatePodcastHome() {
  try {
    revalidatePath("/app/podcasts")
  } catch {
    // The mutation is committed; cache invalidation is best effort.
  }
}

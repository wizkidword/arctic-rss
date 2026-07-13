import { Queue, type JobsOptions } from "bullmq"

import { redisConnectionOptions } from "./feed-refresh-queue"

export const PODCAST_REFRESH_QUEUE_NAME = "podcast-refresh"

export type PodcastRefreshJobData = {
  podcastId: string
}

let podcastRefreshQueue: Queue<PodcastRefreshJobData> | undefined

export function getPodcastRefreshQueue() {
  if (!podcastRefreshQueue) {
    podcastRefreshQueue = new Queue<PodcastRefreshJobData>(
      PODCAST_REFRESH_QUEUE_NAME,
      {
        connection: redisConnectionOptions(),
      }
    )
  }

  return podcastRefreshQueue
}

export async function enqueuePodcastRefresh(
  podcastId: string,
  options: JobsOptions = {}
) {
  return getPodcastRefreshQueue().add(
    "refresh-podcast",
    { podcastId },
    {
      attempts: 3,
      backoff: {
        delay: 30_000,
        type: "exponential",
      },
      jobId: podcastRefreshJobId(podcastId),
      removeOnComplete: true,
      removeOnFail: {
        age: 24 * 60 * 60,
        count: 1000,
      },
      ...options,
    }
  )
}

export function podcastRefreshJobId(podcastId: string) {
  return `podcast-${podcastId.replace(/[^a-zA-Z0-9_-]/g, "-")}`
}

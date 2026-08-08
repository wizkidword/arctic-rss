import { Queue, type JobsOptions } from "bullmq"

import { durableRedisConnectionOptions } from "./redis-config"
import type {
  SourceRefreshEnqueueResult,
  SourceRefreshTrigger,
} from "./source-refresh-queue"

export const PODCAST_REFRESH_QUEUE_NAME = "podcast-refresh"

export type PodcastRefreshJobData = {
  podcastId: string
  trigger?: SourceRefreshTrigger
}

let podcastRefreshQueue: Queue<PodcastRefreshJobData> | undefined

export function getPodcastRefreshQueue() {
  if (!podcastRefreshQueue) {
    podcastRefreshQueue = new Queue<PodcastRefreshJobData>(
      PODCAST_REFRESH_QUEUE_NAME,
      {
        connection: durableRedisConnectionOptions(),
      }
    )
  }

  return podcastRefreshQueue
}

export async function closePodcastRefreshQueue() {
  const queue = podcastRefreshQueue
  podcastRefreshQueue = undefined
  await queue?.close()
}

export async function enqueuePodcastRefresh(
  podcastId: string,
  { trigger = "scheduler", ...options }: JobsOptions & { trigger?: SourceRefreshTrigger } = {}
): Promise<SourceRefreshEnqueueResult> {
  const queue = getPodcastRefreshQueue()
  const jobId = options.jobId ?? podcastRefreshJobId(podcastId)

  if (await queue.getJob(jobId)) {
    return { jobId, outcome: "already-queued" }
  }

  await queue.add(
    "refresh-podcast",
    { podcastId, trigger },
    {
      attempts: 3,
      backoff: {
        delay: 30_000,
        type: "exponential",
      },
      jobId,
      removeOnComplete: true,
      removeOnFail: true,
      ...options,
    }
  )

  return { jobId, outcome: "queued" }
}

export function podcastRefreshJobId(podcastId: string) {
  return `podcast-${podcastId.replace(/[^a-zA-Z0-9_-]/g, "-")}`
}

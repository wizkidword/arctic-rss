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

const SOURCE_REFRESH_REQUEST_MARKER = "arcticSourceRefreshRequestId"

type PodcastRefreshEnqueueOptions = {
  priority?: number
  trigger?: SourceRefreshTrigger
}

type PodcastRefreshJobOptions = JobsOptions & {
  [SOURCE_REFRESH_REQUEST_MARKER]: string
}

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
  { priority, trigger = "scheduler" }: PodcastRefreshEnqueueOptions = {}
): Promise<SourceRefreshEnqueueResult> {
  const queue = getPodcastRefreshQueue()
  const jobId = podcastRefreshJobId(podcastId)
  const requestMarker = crypto.randomUUID()

  try {
    const options: PodcastRefreshJobOptions = {
      attempts: 3,
      backoff: {
        delay: 30_000,
        type: "exponential",
      },
      jobId,
      ...(priority === undefined ? {} : { priority }),
      removeOnComplete: true,
      removeOnFail: true,
      [SOURCE_REFRESH_REQUEST_MARKER]: requestMarker,
    }
    await queue.add(
      "refresh-podcast",
      { podcastId, trigger },
      options,
    )

    const stored = await queue.getJob(jobId)
    if (!stored) {
      return { jobId, outcome: "unavailable" }
    }

    return {
      jobId,
      outcome:
        (stored.opts as PodcastRefreshJobOptions)[SOURCE_REFRESH_REQUEST_MARKER] === requestMarker
          ? "queued"
          : "already-active",
    }
  } catch {
    return { jobId, outcome: "unavailable" }
  }
}

export function podcastRefreshJobId(podcastId: string) {
  return `podcast-${podcastId.replace(/[^a-zA-Z0-9_-]/g, "-")}`
}

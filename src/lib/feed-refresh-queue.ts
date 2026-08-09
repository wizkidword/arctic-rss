import { Queue, type JobsOptions } from "bullmq"

import { durableRedisConnectionOptions } from "./redis-config"
import type {
  SourceRefreshEnqueueResult,
  SourceRefreshTrigger,
} from "./source-refresh-queue"

export const FEED_REFRESH_QUEUE_NAME = "feed-refresh"

export type FeedRefreshJobData = {
  feedId: string
  trigger?: SourceRefreshTrigger
}

let feedRefreshQueue: Queue<FeedRefreshJobData> | undefined

export function getFeedRefreshQueue() {
  if (!feedRefreshQueue) {
    feedRefreshQueue = new Queue<FeedRefreshJobData>(FEED_REFRESH_QUEUE_NAME, {
      connection: durableRedisConnectionOptions(),
    })
  }

  return feedRefreshQueue
}

export async function closeFeedRefreshQueue() {
  const queue = feedRefreshQueue
  feedRefreshQueue = undefined
  await queue?.close()
}

export async function enqueueFeedRefresh(
  feedId: string,
  { trigger = "scheduler", ...options }: JobsOptions & { trigger?: SourceRefreshTrigger } = {}
): Promise<SourceRefreshEnqueueResult> {
  const queue = getFeedRefreshQueue()
  const jobId = options.jobId ?? feedRefreshJobId(feedId)

  if (await queue.getJob(jobId)) {
    return { jobId, outcome: "already-queued" }
  }

  await queue.add(
    "refresh-feed",
    { feedId, trigger },
    {
      attempts: 3,
      backoff: {
        delay: 10_000,
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

export function feedRefreshJobId(feedId: string) {
  return `feed-${feedId.replace(/[^a-zA-Z0-9_-]/g, "-")}`
}

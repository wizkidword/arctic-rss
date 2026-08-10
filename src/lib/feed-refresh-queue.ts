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

const SOURCE_REFRESH_REQUEST_MARKER = "arcticSourceRefreshRequestId"

type FeedRefreshEnqueueOptions = {
  priority?: number
  trigger?: SourceRefreshTrigger
}

type FeedRefreshJobOptions = JobsOptions & {
  [SOURCE_REFRESH_REQUEST_MARKER]: string
}

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
  { priority, trigger = "scheduler" }: FeedRefreshEnqueueOptions = {}
): Promise<SourceRefreshEnqueueResult> {
  const queue = getFeedRefreshQueue()
  const jobId = feedRefreshJobId(feedId)
  const requestMarker = crypto.randomUUID()

  try {
    const options: FeedRefreshJobOptions = {
      attempts: 3,
      backoff: {
        delay: 10_000,
        type: "exponential",
      },
      jobId,
      ...(priority === undefined ? {} : { priority }),
      removeOnComplete: true,
      removeOnFail: true,
      [SOURCE_REFRESH_REQUEST_MARKER]: requestMarker,
    }
    await queue.add(
      "refresh-feed",
      { feedId, trigger },
      options,
    )

    const stored = await queue.getJob(jobId)
    if (!stored) {
      return { jobId, outcome: "unavailable" }
    }

    return {
      jobId,
      outcome:
        (stored.opts as FeedRefreshJobOptions)[SOURCE_REFRESH_REQUEST_MARKER] === requestMarker
          ? "queued"
          : "already-active",
    }
  } catch {
    return { jobId, outcome: "unavailable" }
  }
}

export function feedRefreshJobId(feedId: string) {
  return `feed-${feedId.replace(/[^a-zA-Z0-9_-]/g, "-")}`
}

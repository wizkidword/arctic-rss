import { Queue, type JobsOptions } from "bullmq"

export const FEED_REFRESH_QUEUE_NAME = "feed-refresh"

export type FeedRefreshJobData = {
  feedId: string
}

let feedRefreshQueue: Queue<FeedRefreshJobData> | undefined

export function redisConnectionOptions() {
  return {
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
  }
}

export function getFeedRefreshQueue() {
  if (!feedRefreshQueue) {
    feedRefreshQueue = new Queue<FeedRefreshJobData>(FEED_REFRESH_QUEUE_NAME, {
      connection: redisConnectionOptions(),
    })
  }

  return feedRefreshQueue
}

export async function enqueueFeedRefresh(
  feedId: string,
  options: JobsOptions = {}
) {
  return getFeedRefreshQueue().add(
    "refresh-feed",
    { feedId },
    {
      attempts: 3,
      backoff: {
        delay: 10_000,
        type: "exponential",
      },
      jobId: feedRefreshJobId(feedId),
      removeOnComplete: true,
      removeOnFail: true,
      ...options,
    }
  )
}

export function feedRefreshJobId(feedId: string) {
  return `feed-${feedId.replace(/[^a-zA-Z0-9_-]/g, "-")}`
}

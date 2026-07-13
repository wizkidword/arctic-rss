import { Queue, type JobsOptions } from "bullmq"

import { redisConnectionOptions } from "./feed-refresh-queue"

export const BULK_READ_QUEUE_NAME = "bulk-read"

export type BulkReadJobData = {
  jobId: string
}

let bulkReadQueue: Queue<BulkReadJobData> | undefined

export function getBulkReadQueue() {
  if (!bulkReadQueue) {
    bulkReadQueue = new Queue<BulkReadJobData>(BULK_READ_QUEUE_NAME, {
      connection: redisConnectionOptions(),
    })
  }

  return bulkReadQueue
}

export async function enqueueBulkReadJob(
  jobId: string,
  options: JobsOptions = {}
) {
  return getBulkReadQueue().add(
    "mark-articles-read",
    { jobId },
    {
      attempts: 3,
      backoff: {
        delay: 10_000,
        type: "exponential",
      },
      jobId: bulkReadQueueJobId(jobId),
      removeOnComplete: true,
      removeOnFail: {
        age: 24 * 60 * 60,
        count: 1000,
      },
      ...options,
    }
  )
}

export function bulkReadQueueJobId(jobId: string) {
  return `bulk-read-${jobId.replace(/[^a-zA-Z0-9_-]/g, "-")}`
}

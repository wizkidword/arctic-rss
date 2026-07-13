import { Queue, type JobsOptions } from "bullmq"

import { redisConnectionOptions } from "./feed-refresh-queue"

export const OPML_IMPORT_QUEUE_NAME = "opml-import"

export type OpmlImportQueueData = {
  jobId: string
  run: number
}

let opmlImportQueue: Queue<OpmlImportQueueData> | undefined

export function getOpmlImportQueue() {
  if (!opmlImportQueue) {
    opmlImportQueue = new Queue<OpmlImportQueueData>(OPML_IMPORT_QUEUE_NAME, {
      connection: redisConnectionOptions(),
    })
  }

  return opmlImportQueue
}

export async function enqueueOpmlImportJob(
  jobId: string,
  run = Date.now(),
  options: JobsOptions = {}
) {
  return getOpmlImportQueue().add(
    "import-opml",
    { jobId, run },
    {
      attempts: 3,
      backoff: {
        delay: 10_000,
        type: "exponential",
      },
      jobId: opmlImportQueueJobId(jobId, run),
      removeOnComplete: true,
      removeOnFail: {
        age: 24 * 60 * 60,
        count: 1_000,
      },
      ...options,
    }
  )
}

export function opmlImportQueueJobId(jobId: string, run: number) {
  return `opml-import-${jobId.replace(/[^a-zA-Z0-9_-]/g, "-")}-${run}`
}

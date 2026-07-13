import { Queue, type JobsOptions } from "bullmq"

import { redisConnectionOptions } from "./feed-refresh-queue"

export const SMART_DIGEST_EMAIL_QUEUE_NAME = "smart-digest-email"

export type SmartDigestEmailJobData = {
  runId: string
}

let smartDigestEmailQueue: Queue<SmartDigestEmailJobData> | undefined

export function getSmartDigestEmailQueue() {
  if (!smartDigestEmailQueue) {
    smartDigestEmailQueue = new Queue<SmartDigestEmailJobData>(
      SMART_DIGEST_EMAIL_QUEUE_NAME,
      {
        connection: redisConnectionOptions(),
      }
    )
  }

  return smartDigestEmailQueue
}

/**
 * A delivery has a fixed job ID, so a scheduler and the digest worker may both
 * request it without creating parallel sends. Failed jobs remain inspectable
 * in BullMQ for one week after the bounded retry budget is exhausted.
 */
export async function enqueueSmartDigestEmail(
  runId: string,
  options: JobsOptions = {}
) {
  return getSmartDigestEmailQueue().add(
    "deliver-smart-digest-email",
    { runId },
    {
      attempts: 3,
      backoff: {
        delay: 30_000,
        type: "exponential",
      },
      jobId: smartDigestEmailJobId(runId),
      removeOnComplete: true,
      removeOnFail: {
        age: 7 * 24 * 60 * 60,
        count: 1000,
      },
      ...options,
    }
  )
}

export function smartDigestEmailJobId(runId: string) {
  return `smart-digest-email-${runId.replace(/[^a-zA-Z0-9_-]/g, "-")}`
}

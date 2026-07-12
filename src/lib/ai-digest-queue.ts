import { Queue, type JobsOptions } from "bullmq"

import { redisConnectionOptions } from "./feed-refresh-queue"

export const AI_DIGEST_QUEUE_NAME = "ai-digest"

export type AiDigestJobData = {
  digestId: string
}

let aiDigestQueue: Queue<AiDigestJobData> | undefined

export function getAiDigestQueue() {
  if (!aiDigestQueue) {
    aiDigestQueue = new Queue<AiDigestJobData>(AI_DIGEST_QUEUE_NAME, {
      connection: redisConnectionOptions(),
    })
  }

  return aiDigestQueue
}

export async function enqueueAiDigest(
  digestId: string,
  options: JobsOptions = {}
) {
  return getAiDigestQueue().add(
    "generate-digest",
    {
      digestId,
    },
    {
      attempts: 3,
      backoff: {
        delay: 10_000,
        type: "exponential",
      },
      jobId: aiDigestJobId(digestId),
      removeOnComplete: true,
      removeOnFail: {
        age: 24 * 60 * 60,
        count: 1000,
      },
      ...options,
    }
  )
}

export function aiDigestJobId(digestId: string) {
  return `digest-${digestId.replace(/[^a-zA-Z0-9_-]/g, "-")}`
}

import { Queue, type JobsOptions } from "bullmq"

import { redisConnectionOptions } from "./feed-refresh-queue"

export const SMART_DIGEST_QUEUE_NAME = "smart-digest"

export type SmartDigestJobData = {
  ruleId: string
  scheduledFor: string
}

let smartDigestQueue: Queue<SmartDigestJobData> | undefined

export function getSmartDigestQueue() {
  if (!smartDigestQueue) {
    smartDigestQueue = new Queue<SmartDigestJobData>(SMART_DIGEST_QUEUE_NAME, {
      connection: redisConnectionOptions(),
    })
  }

  return smartDigestQueue
}

export async function enqueueSmartDigestRule(
  data: SmartDigestJobData,
  options: JobsOptions = {}
) {
  return getSmartDigestQueue().add(
    "generate-smart-digest",
    data,
    {
      attempts: 3,
      backoff: {
        delay: 10_000,
        type: "exponential",
      },
      jobId: smartDigestJobId(data.ruleId, data.scheduledFor),
      removeOnComplete: true,
      removeOnFail: {
        age: 24 * 60 * 60,
        count: 1000,
      },
      ...options,
    }
  )
}

export function smartDigestJobId(ruleId: string, scheduledFor: string) {
  const scheduleId = Number.isNaN(new Date(scheduledFor).getTime())
    ? scheduledFor
    : new Date(scheduledFor).toISOString()

  return `smart-digest-${ruleId.replace(/[^a-zA-Z0-9_-]/g, "-")}-${scheduleId.replace(/[^a-zA-Z0-9_-]/g, "-")}`
}

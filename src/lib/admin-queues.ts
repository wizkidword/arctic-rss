import { Queue } from "bullmq"

import {
  AI_DIGEST_QUEUE_NAME,
  type AiDigestJobData,
} from "./ai-digest-queue"
import {
  FEED_REFRESH_QUEUE_NAME,
  redisConnectionOptions,
  type FeedRefreshJobData,
} from "./feed-refresh-queue"

type AdminQueueCounts = Record<string, number>

type AdminQueueJob = {
  attemptsMade: number
  failedReason?: string
  finishedOn?: number
  id?: string
  name: string
  timestamp: number
}

export type AdminQueueReader = {
  getJobCounts(
    ...types: Array<"waiting" | "active" | "delayed" | "failed">
  ): Promise<AdminQueueCounts>
  getJobs(
    types: Array<"failed">,
    start: number,
    end: number,
    asc: boolean
  ): Promise<AdminQueueJob[]>
}

type AvailableAdminQueueSnapshot = {
  available: true
  failedJobs: Array<{
    attemptsMade: number
    failedReason: string
    id: string
    jobName: string
    occurredAt: Date
    queueName: string
  }>
  queues: Array<{
    active: number
    delayed: number
    failed: number
    name: string
    waiting: number
  }>
}

type UnavailableAdminQueueSnapshot = {
  available: false
  error: string
  failedJobs: []
  queues: []
}

export type AdminQueueSnapshot =
  | AvailableAdminQueueSnapshot
  | UnavailableAdminQueueSnapshot

export async function inspectAdminQueues(): Promise<AdminQueueSnapshot> {
  const connection = {
    ...redisConnectionOptions(),
    connectTimeout: 2_000,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
  }
  const feedQueue = new Queue<FeedRefreshJobData>(FEED_REFRESH_QUEUE_NAME, {
    connection,
  })
  const digestQueue = new Queue<AiDigestJobData>(AI_DIGEST_QUEUE_NAME, {
    connection,
  })

  try {
    return await inspectAdminQueuesWithClients({
      digestQueue,
      feedQueue,
    })
  } finally {
    await Promise.allSettled([feedQueue.close(), digestQueue.close()])
  }
}

export async function inspectAdminQueuesWithClients({
  digestQueue,
  feedQueue,
}: {
  digestQueue: AdminQueueReader
  feedQueue: AdminQueueReader
}): Promise<AdminQueueSnapshot> {
  try {
    const [
      feedCounts,
      digestCounts,
      failedFeedJobs,
      failedDigestJobs,
    ] = await Promise.all([
      feedQueue.getJobCounts("waiting", "active", "delayed", "failed"),
      digestQueue.getJobCounts("waiting", "active", "delayed", "failed"),
      feedQueue.getJobs(["failed"], 0, 24, false),
      digestQueue.getJobs(["failed"], 0, 24, false),
    ])

    const failedJobs = [
      ...failedFeedJobs.map((job) => mapFailedJob("Feed refresh", job)),
      ...failedDigestJobs.map((job) => mapFailedJob("AI digest", job)),
    ]
      .sort(
        (left, right) =>
          right.occurredAt.getTime() - left.occurredAt.getTime()
      )
      .slice(0, 25)

    return {
      available: true,
      failedJobs,
      queues: [
        mapQueueCounts("Feed refresh", feedCounts),
        mapQueueCounts("AI digest", digestCounts),
      ],
    }
  } catch {
    return {
      available: false,
      error: "Queue status is temporarily unavailable.",
      failedJobs: [],
      queues: [],
    }
  }
}

function mapQueueCounts(name: string, counts: AdminQueueCounts) {
  return {
    active: counts.active ?? 0,
    delayed: counts.delayed ?? 0,
    failed: counts.failed ?? 0,
    name,
    waiting: counts.waiting ?? 0,
  }
}

function mapFailedJob(queueName: string, job: AdminQueueJob) {
  const occurredAt = new Date(job.finishedOn ?? job.timestamp)
  const failedReason = boundedFailureReason(job.failedReason)

  return {
    attemptsMade: job.attemptsMade,
    failedReason,
    id: job.id || job.name,
    jobName: job.name,
    occurredAt: Number.isNaN(occurredAt.getTime())
      ? new Date(0)
      : occurredAt,
    queueName,
  }
}

function boundedFailureReason(reason: string | undefined) {
  const message = reason?.trim() || "Queue job failed."

  return message.length > 500 ? `${message.slice(0, 497)}...` : message
}

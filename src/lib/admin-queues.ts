import { Queue } from "bullmq"

import {
  AI_DIGEST_QUEUE_NAME,
  type AiDigestJobData,
} from "./ai-digest-queue"
import {
  BULK_READ_QUEUE_NAME,
  type BulkReadJobData,
} from "./bulk-read-queue"
import {
  FEED_REFRESH_QUEUE_NAME,
  redisConnectionOptions,
  type FeedRefreshJobData,
} from "./feed-refresh-queue"
import {
  PODCAST_REFRESH_QUEUE_NAME,
  type PodcastRefreshJobData,
} from "./podcast-refresh-queue"
import {
  OPML_IMPORT_QUEUE_NAME,
  type OpmlImportQueueData,
} from "./opml-import-queue"
import {
  SMART_DIGEST_EMAIL_QUEUE_NAME,
  type SmartDigestEmailJobData,
} from "./smart-digest-email-queue"
import {
  SMART_DIGEST_QUEUE_NAME,
  type SmartDigestJobData,
} from "./smart-digest-queue"

type AdminQueueCounts = Record<string, number>

export const ADMIN_QUEUE_LABELS = {
  aiDigest: "AI digest",
  bulkRead: "Bulk mark read",
  feedRefresh: "Feed refresh",
  opmlImport: "OPML import",
  podcastRefresh: "Podcast refresh",
  smartDigest: "Smart Digest",
  smartDigestEmail: "Smart Digest email",
} as const

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

export type AdminQueueClient = {
  name: string
  reader: AdminQueueReader
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
  const bulkReadQueue = new Queue<BulkReadJobData>(BULK_READ_QUEUE_NAME, {
    connection,
  })
  const podcastQueue = new Queue<PodcastRefreshJobData>(
    PODCAST_REFRESH_QUEUE_NAME,
    { connection }
  )
  const smartDigestQueue = new Queue<SmartDigestJobData>(SMART_DIGEST_QUEUE_NAME, {
    connection,
  })
  const smartDigestEmailQueue = new Queue<SmartDigestEmailJobData>(
    SMART_DIGEST_EMAIL_QUEUE_NAME,
    { connection }
  )
  const opmlImportQueue = new Queue<OpmlImportQueueData>(OPML_IMPORT_QUEUE_NAME, {
    connection,
  })

  try {
    return await inspectAdminQueuesWithClients({
      queues: [
        { name: ADMIN_QUEUE_LABELS.feedRefresh, reader: feedQueue },
        { name: ADMIN_QUEUE_LABELS.podcastRefresh, reader: podcastQueue },
        { name: ADMIN_QUEUE_LABELS.aiDigest, reader: digestQueue },
        { name: ADMIN_QUEUE_LABELS.bulkRead, reader: bulkReadQueue },
        { name: ADMIN_QUEUE_LABELS.smartDigest, reader: smartDigestQueue },
        { name: ADMIN_QUEUE_LABELS.smartDigestEmail, reader: smartDigestEmailQueue },
        { name: ADMIN_QUEUE_LABELS.opmlImport, reader: opmlImportQueue },
      ],
    })
  } finally {
    await Promise.allSettled([
      feedQueue.close(),
      digestQueue.close(),
      bulkReadQueue.close(),
      podcastQueue.close(),
      smartDigestQueue.close(),
      smartDigestEmailQueue.close(),
      opmlImportQueue.close(),
    ])
  }
}

export async function inspectAdminQueuesWithClients({
  queues,
}: {
  queues: AdminQueueClient[]
}): Promise<AdminQueueSnapshot> {
  try {
    const snapshots = await Promise.all(
      queues.map(async ({ name, reader }) => {
        const [counts, failedJobs] = await Promise.all([
          reader.getJobCounts("waiting", "active", "delayed", "failed"),
          reader.getJobs(["failed"], 0, 24, false),
        ])

        return { counts, failedJobs, name }
      })
    )
    const failedJobs = snapshots
      .flatMap(({ failedJobs: jobs, name }) =>
        jobs.map((job) => mapFailedJob(name, job))
      )
      .sort(
        (left, right) =>
          right.occurredAt.getTime() - left.occurredAt.getTime()
      )
      .slice(0, 25)

    return {
      available: true,
      failedJobs,
      queues: snapshots.map(({ counts, name }) => mapQueueCounts(name, counts)),
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

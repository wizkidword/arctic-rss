import { Queue } from "bullmq"
import Redis from "ioredis"

import {
  AI_DIGEST_QUEUE_NAME,
  type AiDigestJobData,
} from "./ai-digest-queue"
import {
  BULK_READ_QUEUE_NAME,
  type BulkReadJobData,
} from "./bulk-read-queue"
import {
  CHAT_ARTICLE_INTEGRATION_QUEUE_NAME,
  type ChatArticleIntegrationJobData,
} from "./chat/bot-queue"
import {
  FEED_REFRESH_QUEUE_NAME,
  type FeedRefreshJobData,
} from "./feed-refresh-queue"
import {
  OPML_IMPORT_QUEUE_NAME,
  type OpmlImportQueueData,
} from "./opml-import-queue"
import {
  PODCAST_REFRESH_QUEUE_NAME,
  type PodcastRefreshJobData,
} from "./podcast-refresh-queue"
import { durableRedisConnectionOptions } from "./redis-config"
import {
  SMART_DIGEST_EMAIL_QUEUE_NAME,
  type SmartDigestEmailJobData,
} from "./smart-digest-email-queue"
import {
  SMART_DIGEST_QUEUE_NAME,
  type SmartDigestJobData,
} from "./smart-digest-queue"

export const MAX_QUEUE_ACTIVE_JOB_AGE_MS = 15 * 60_000
export const MAX_QUEUE_WAITING_JOB_AGE_MS = 15 * 60_000
export const MAX_RECENT_QUEUE_FAILURES = 5
export const RECENT_QUEUE_FAILURE_WINDOW_MS = 15 * 60_000

type QueueJob = {
  finishedOn?: number
  processedOn?: number
  timestamp: number
}

export type QueueReadinessReader = {
  getJobCounts(
    ...types: Array<"active" | "failed" | "waiting">
  ): Promise<Record<string, number>>
  getJobs(
    types: Array<"active" | "failed" | "waiting">,
    start: number,
    end: number,
    asc: boolean
  ): Promise<QueueJob[]>
}

export type QueueReadinessClient = {
  name: string
  reader: QueueReadinessReader
}

export type QueueReadinessReport = {
  available: boolean
  oldestActiveJobAgeMs: number | null
  oldestWaitingJobAgeMs: number | null
  recentFailureCount: number
  ready: boolean
  suspectedStalledJobCount: number
  totalActive: number
  totalWaiting: number
}

export async function inspectQueueReadiness(): Promise<QueueReadinessReport> {
  const redis = new Redis(durableRedisConnectionOptions().url, {
    connectTimeout: 2_000,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
  })
  redis.on("error", () => {
    // This bounded diagnostic returns a sanitized unavailable state instead.
  })

  try {
    await redis.ping()
    const queues = [
      new Queue<FeedRefreshJobData>(FEED_REFRESH_QUEUE_NAME, { connection: redis }),
      new Queue<PodcastRefreshJobData>(PODCAST_REFRESH_QUEUE_NAME, { connection: redis }),
      new Queue<AiDigestJobData>(AI_DIGEST_QUEUE_NAME, { connection: redis }),
      new Queue<BulkReadJobData>(BULK_READ_QUEUE_NAME, { connection: redis }),
      new Queue<ChatArticleIntegrationJobData>(CHAT_ARTICLE_INTEGRATION_QUEUE_NAME, { connection: redis }),
      new Queue<SmartDigestJobData>(SMART_DIGEST_QUEUE_NAME, { connection: redis }),
      new Queue<SmartDigestEmailJobData>(SMART_DIGEST_EMAIL_QUEUE_NAME, { connection: redis }),
      new Queue<OpmlImportQueueData>(OPML_IMPORT_QUEUE_NAME, { connection: redis }),
    ]

    try {
      return await inspectQueueReadinessWithClients({
        queues: queues.map((queue) => ({ name: queue.name, reader: queue })),
      })
    } finally {
      await Promise.allSettled(queues.map((queue) => queue.close()))
    }
  } catch {
    return unavailableQueueReadiness()
  } finally {
    redis.disconnect()
  }
}

export async function inspectQueueReadinessWithClients({
  maxActiveJobAgeMs = MAX_QUEUE_ACTIVE_JOB_AGE_MS,
  maxRecentFailures = MAX_RECENT_QUEUE_FAILURES,
  maxWaitingJobAgeMs = MAX_QUEUE_WAITING_JOB_AGE_MS,
  now = Date.now,
  queues,
  recentFailureWindowMs = RECENT_QUEUE_FAILURE_WINDOW_MS,
}: {
  maxActiveJobAgeMs?: number
  maxRecentFailures?: number
  maxWaitingJobAgeMs?: number
  now?: () => number
  queues: QueueReadinessClient[]
  recentFailureWindowMs?: number
}): Promise<QueueReadinessReport> {
  try {
    const currentTime = now()
    const snapshots = await Promise.all(
      queues.map(async ({ reader }) => {
        const [counts, waitingJobs, activeJobs, failedJobs] = await Promise.all([
          reader.getJobCounts("waiting", "active", "failed"),
          reader.getJobs(["waiting"], 0, 0, true),
          reader.getJobs(["active"], 0, 99, true),
          reader.getJobs(["failed"], 0, 24, false),
        ])

        return { activeJobs, counts, failedJobs, waitingJobs }
      })
    )
    const oldestWaitingTimestamp = oldestTimestamp(
      snapshots.flatMap(({ waitingJobs }) => waitingJobs.map((job) => job.timestamp))
    )
    const activeJobs = snapshots.flatMap(({ activeJobs }) => activeJobs)
    const oldestActiveTimestamp = oldestTimestamp(
      activeJobs.map((job) => job.processedOn ?? job.timestamp)
    )
    const oldestWaitingJobAgeMs = ageFromTimestamp(oldestWaitingTimestamp, currentTime)
    const oldestActiveJobAgeMs = ageFromTimestamp(oldestActiveTimestamp, currentTime)
    const recentFailureCount = snapshots
      .flatMap(({ failedJobs }) => failedJobs)
      .filter((job) => (job.finishedOn ?? job.timestamp) >= currentTime - recentFailureWindowMs)
      .length
    const suspectedStalledJobCount = activeJobs.filter((job) => {
      const timestamp = job.processedOn ?? job.timestamp
      return currentTime - timestamp > maxActiveJobAgeMs
    }).length
    const totalActive = snapshots.reduce(
      (total, { counts }) => total + Math.max(0, counts.active ?? 0),
      0
    )
    const totalWaiting = snapshots.reduce(
      (total, { counts }) => total + Math.max(0, counts.waiting ?? 0),
      0
    )

    return {
      available: true,
      oldestActiveJobAgeMs,
      oldestWaitingJobAgeMs,
      recentFailureCount,
      ready:
        (oldestWaitingJobAgeMs === null || oldestWaitingJobAgeMs <= maxWaitingJobAgeMs) &&
        suspectedStalledJobCount === 0 &&
        recentFailureCount <= maxRecentFailures,
      suspectedStalledJobCount,
      totalActive,
      totalWaiting,
    }
  } catch {
    return {
      available: false,
      oldestActiveJobAgeMs: null,
      oldestWaitingJobAgeMs: null,
      recentFailureCount: 0,
      ready: false,
      suspectedStalledJobCount: 0,
      totalActive: 0,
      totalWaiting: 0,
    }
  }
}

function ageFromTimestamp(timestamp: number | undefined, now: number) {
  if (!timestamp || !Number.isFinite(timestamp) || timestamp > now) {
    return null
  }

  return now - timestamp
}

function oldestTimestamp(timestamps: number[]) {
  const validTimestamps = timestamps.filter(Number.isFinite)

  return validTimestamps.length ? Math.min(...validTimestamps) : undefined
}

function unavailableQueueReadiness(): QueueReadinessReport {
  return {
    available: false,
    oldestActiveJobAgeMs: null,
    oldestWaitingJobAgeMs: null,
    recentFailureCount: 0,
    ready: false,
    suspectedStalledJobCount: 0,
    totalActive: 0,
    totalWaiting: 0,
  }
}

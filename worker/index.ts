import "dotenv/config"

import { Worker } from "bullmq"

import { cleanupExpiredAuthTokens } from "../src/lib/auth-token-maintenance"
import {
  failBulkReadJob,
  processBulkReadJob,
} from "../src/lib/bulk-read-jobs"
import {
  BULK_READ_QUEUE_NAME,
  type BulkReadJobData,
} from "../src/lib/bulk-read-queue"
import {
  failOpmlImportJob,
  processOpmlImportJob,
} from "../src/lib/opml-import-jobs"
import {
  enqueueOpmlImportJob,
  OPML_IMPORT_QUEUE_NAME,
  type OpmlImportQueueData,
} from "../src/lib/opml-import-queue"
import {
  AI_DIGEST_QUEUE_NAME,
  type AiDigestJobData,
} from "../src/lib/ai-digest-queue"
import { processAiDigest } from "../src/lib/ai-digests"
import { getPrisma } from "../src/lib/db"
import { refreshFeed } from "../src/lib/feed-refresh"
import {
  enqueueFeedRefresh,
  FEED_REFRESH_QUEUE_NAME,
  redisConnectionOptions,
  type FeedRefreshJobData,
} from "../src/lib/feed-refresh-queue"
import { refreshPodcast } from "../src/lib/podcast-refresh"
import {
  enqueuePodcastRefresh,
  PODCAST_REFRESH_QUEUE_NAME,
  type PodcastRefreshJobData,
} from "../src/lib/podcast-refresh-queue"
import {
  enqueueDueFeedRefreshes,
  enqueueDuePodcastRefreshes,
  schedulerSettings,
} from "../src/lib/refresh-scheduler"
import { assertSecureProductionConfiguration } from "../src/lib/production-security"
import { processSmartDigestEmailDelivery } from "../src/lib/smart-digest-delivery"
import {
  enqueueSmartDigestEmail,
  SMART_DIGEST_EMAIL_QUEUE_NAME,
  type SmartDigestEmailJobData,
} from "../src/lib/smart-digest-email-queue"
import {
  enqueueSmartDigestRule,
  SMART_DIGEST_QUEUE_NAME,
  type SmartDigestJobData,
} from "../src/lib/smart-digest-queue"
import { processSmartDigestRule } from "../src/lib/smart-digest-processing"
import {
  clearWorkerHeartbeat,
  writeWorkerHeartbeat,
} from "../src/lib/worker-health"

assertSecureProductionConfiguration()

const {
  aiDigestConcurrency,
  authTokenMaintenanceBatchSize,
  authTokenMaintenanceIntervalMs,
  feedRefreshConcurrency,
  podcastRefreshConcurrency,
  schedulerBatchSize,
  schedulerIntervalMs,
  smartDigestConcurrency,
  smartDigestEmailConcurrency,
} = schedulerSettings()
const prisma = getPrisma()
const WORKER_HEARTBEAT_INTERVAL_MS = 30_000

console.log("Arctic RSS worker online")
console.log(
  `Redis queue endpoint: ${redisConnectionOptions().url.replace(/\/\/.*@/, "//***@")}`
)

const worker = new Worker<FeedRefreshJobData>(
  FEED_REFRESH_QUEUE_NAME,
  async (job) => {
    return runTrackedRefresh({
      kind: "feed",
      refresh: () => refreshFeed(job.data.feedId),
      sourceId: job.data.feedId,
    })
  },
  {
    connection: redisConnectionOptions(),
    concurrency: feedRefreshConcurrency,
  }
)

const aiDigestWorker = new Worker<AiDigestJobData>(
  AI_DIGEST_QUEUE_NAME,
  async (job) => {
    const result = await processAiDigest({
      digestId: job.data.digestId,
    })
    console.log(
      `[worker] generated digest ${result.digestId} with ${result.articleCount} articles`
    )

    return result
  },
  {
    connection: redisConnectionOptions(),
    concurrency: aiDigestConcurrency,
  }
)

const smartDigestWorker = new Worker<SmartDigestJobData>(
  SMART_DIGEST_QUEUE_NAME,
  async (job) => {
    const result = await processSmartDigestRule({
      ruleId: job.data.ruleId,
      scheduledFor: job.data.scheduledFor,
    })
    console.log(
      `[worker] processed smart digest ${result.digestId ?? "pending"} with ${result.articleCount} articles`
    )

    return result
  },
  {
    connection: redisConnectionOptions(),
    concurrency: smartDigestConcurrency,
  }
)

const bulkReadWorker = new Worker<BulkReadJobData>(
  BULK_READ_QUEUE_NAME,
  async (job) => {
    return processBulkReadJob({
      jobId: job.data.jobId,
      onProgress: (progress) => job.updateProgress(progress),
    })
  },
  {
    connection: redisConnectionOptions(),
    concurrency: 1,
  }
)

const opmlImportWorker = new Worker<OpmlImportQueueData>(
  OPML_IMPORT_QUEUE_NAME,
  async (job) => {
    const result = await processOpmlImportJob({ jobId: job.data.jobId })

    if (result.status === "PROCESSING") {
      await enqueueOpmlImportJob(job.data.jobId, job.data.run + 1)
    }

    console.log(
      JSON.stringify({
        event: "opml_import",
        jobId: job.data.jobId,
        outcome: result.status.toLowerCase(),
      })
    )

    return result
  },
  {
    connection: redisConnectionOptions(),
    concurrency: 1,
  }
)

const smartDigestEmailWorker = new Worker<SmartDigestEmailJobData>(
  SMART_DIGEST_EMAIL_QUEUE_NAME,
  async (job) => {
    const result = await processSmartDigestEmailDelivery({
      runId: job.data.runId,
    })
    console.log(
      `[worker] smart digest email ${job.data.runId} ${result.status.toLowerCase()}`
    )

    return result
  },
  {
    connection: redisConnectionOptions(),
    concurrency: smartDigestEmailConcurrency,
  }
)

const podcastWorker = new Worker<PodcastRefreshJobData>(
  PODCAST_REFRESH_QUEUE_NAME,
  async (job) => {
    return runTrackedRefresh({
      kind: "podcast",
      refresh: () => refreshPodcast(job.data.podcastId),
      sourceId: job.data.podcastId,
    })
  },
  {
    connection: redisConnectionOptions(),
    concurrency: podcastRefreshConcurrency,
  }
)

worker.on("failed", (job, error) => {
  console.error(
    `[worker] refresh failed for ${job?.data.feedId ?? "unknown feed"}: ${error.message}`
  )
})

aiDigestWorker.on("failed", (job, error) => {
  console.error(
    `[worker] digest failed for ${job?.data.digestId ?? "unknown digest"}: ${error.message}`
  )
})

smartDigestWorker.on("failed", (job, error) => {
  console.error(
    `[worker] smart digest failed for ${job?.data.ruleId ?? "unknown rule"}: ${error.message}`
  )
})

bulkReadWorker.on("failed", (job, error) => {
  console.error(
    `[worker] bulk read failed for ${job?.data.jobId ?? "unknown job"}: ${error.message}`
  )

  if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    failBulkReadJob({
      error,
      jobId: job.data.jobId,
    }).catch((failureError) => {
      console.error(
        `[worker] could not record bulk read failure for ${job.data.jobId}: ${schedulerErrorMessage(failureError)}`
      )
    })
  }
})

opmlImportWorker.on("failed", (job, error) => {
  console.error(
    `[worker] OPML import failed for ${job?.data.jobId ?? "unknown job"}: ${error.message}`
  )

  if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    failOpmlImportJob({
      error,
      jobId: job.data.jobId,
    }).catch((failureError) => {
      console.error(
        `[worker] could not record OPML import failure for ${job.data.jobId}: ${schedulerErrorMessage(failureError)}`
      )
    })
  }
})

smartDigestEmailWorker.on("failed", (job, error) => {
  console.error(
    `[worker] smart digest email failed for ${job?.data.runId ?? "unknown run"}: ${error.message}`
  )
})

podcastWorker.on("failed", (job, error) => {
  console.error(
    `[worker] podcast refresh failed for ${job?.data.podcastId ?? "unknown podcast"}: ${error.message}`
  )
})

async function enqueueDueFeeds() {
  return enqueueDueFeedRefreshes({
    batchSize: schedulerBatchSize,
    enqueue: enqueueFeedRefresh,
    store: prisma as unknown as Parameters<typeof enqueueDueFeedRefreshes>[0]["store"],
  })
}

async function enqueueDuePodcasts() {
  return enqueueDuePodcastRefreshes({
    batchSize: schedulerBatchSize,
    enqueue: enqueuePodcastRefresh,
    store: prisma as unknown as Parameters<typeof enqueueDuePodcastRefreshes>[0]["store"],
  })
}

async function enqueueDueSmartDigests() {
  const now = new Date()
  const rules = await prisma.smartDigestRule.findMany({
    orderBy: [{ nextRunAt: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      nextRunAt: true,
    },
    take: schedulerBatchSize,
    where: {
      isEnabled: true,
      nextRunAt: {
        lte: now,
      },
    },
  })

  for (const rule of rules) {
    if (!rule.nextRunAt) {
      continue
    }

    await enqueueSmartDigestRule({
      ruleId: rule.id,
      scheduledFor: rule.nextRunAt.toISOString(),
    })
  }

  if (rules.length) {
    console.log(`[worker] enqueued ${rules.length} due smart digests`)
  }
}

let schedulerRunning = false
let nextAuthTokenMaintenanceAt = 0

function schedulerErrorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : "unknown error"
}

async function runTrackedRefresh<
  Result extends {
    articleCount?: number
    episodeCount?: number
    metrics?: Record<string, number | boolean>
  },
>({
  kind,
  refresh,
  sourceId,
}: {
  kind: "feed" | "podcast"
  refresh: () => Promise<Result>
  sourceId: string
}) {
  const startedAt = performance.now()

  try {
    const result = await refresh()

    console.log(
      JSON.stringify({
        ...(result.metrics ?? {}),
        event: "source_refresh",
        itemCount: result.articleCount ?? result.episodeCount ?? 0,
        kind,
        outcome: "success",
        sourceId,
      })
    )

    return result
  } catch (error) {
    console.error(
      JSON.stringify({
        durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
        event: "source_refresh",
        failed: true,
        kind,
        outcome: "failed",
        sourceId,
      })
    )

    throw error
  }
}

async function schedulerTick() {
  if (schedulerRunning) {
    return
  }

  schedulerRunning = true

  try {
    const [
      feedResult,
      podcastResult,
      smartDigestResult,
      smartDigestEmailResult,
      maintenanceResult,
    ] = await Promise.allSettled([
      enqueueDueFeeds(),
      enqueueDuePodcasts(),
      enqueueDueSmartDigests(),
      enqueuePendingSmartDigestEmails(),
      runAuthTokenMaintenance(),
    ])

    if (feedResult.status === "fulfilled") {
      console.log(
        JSON.stringify({
          event: "refresh_scheduler",
          kind: "feed",
          ...feedResult.value,
        })
      )
    }

    if (podcastResult.status === "fulfilled") {
      console.log(
        JSON.stringify({
          event: "refresh_scheduler",
          kind: "podcast",
          ...podcastResult.value,
        })
      )
    }

    if (smartDigestEmailResult.status === "fulfilled") {
      console.log(
        JSON.stringify({
          event: "smart_digest_email_scheduler",
          ...smartDigestEmailResult.value,
        })
      )
    }

    if (feedResult.status === "rejected") {
      console.error(
        `[worker] feed scheduler failed: ${schedulerErrorMessage(feedResult.reason)}`
      )
    }

    if (podcastResult.status === "rejected") {
      console.error(
        `[worker] podcast scheduler failed: ${schedulerErrorMessage(podcastResult.reason)}`
      )
    }

    if (smartDigestResult.status === "rejected") {
      console.error(
        `[worker] smart digest scheduler failed: ${schedulerErrorMessage(
          smartDigestResult.reason
        )}`
      )
    }

    if (smartDigestEmailResult.status === "rejected") {
      console.error(
        `[worker] smart digest email scheduler failed: ${schedulerErrorMessage(
          smartDigestEmailResult.reason
        )}`
      )
    }

    if (maintenanceResult.status === "rejected") {
      console.error(
        `[worker] auth token maintenance failed: ${schedulerErrorMessage(
          maintenanceResult.reason
        )}`
      )
    }
  } finally {
    schedulerRunning = false
  }
}

async function enqueuePendingSmartDigestEmails() {
  const runs = await prisma.digestRun.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
    },
    take: schedulerBatchSize,
    where: {
      emailStatus: "PENDING",
    },
  })

  for (const run of runs) {
    await enqueueSmartDigestEmail(run.id)
  }

  return { enqueued: runs.length }
}

async function runAuthTokenMaintenance() {
  const now = Date.now()

  if (now < nextAuthTokenMaintenanceAt) {
    return
  }

  nextAuthTokenMaintenanceAt = now + authTokenMaintenanceIntervalMs

  const result = await cleanupExpiredAuthTokens({
    batchSize: authTokenMaintenanceBatchSize,
    store: prisma,
  })
  const deleted =
    result.passwordResetTokensDeleted + result.emailVerificationTokensDeleted

  console.log(
    JSON.stringify({
      emailVerificationTokensDeleted: result.emailVerificationTokensDeleted,
      event: "auth_token_maintenance",
      outcome: "success",
      passwordResetTokensDeleted: result.passwordResetTokensDeleted,
      totalDeleted: deleted,
    })
  )
}

const scheduler = setInterval(() => {
  schedulerTick().catch(() => undefined)
}, schedulerIntervalMs)

schedulerTick().catch(() => undefined)

function recordWorkerHeartbeat() {
  writeWorkerHeartbeat().catch((error) => {
    console.error(
      `[worker] could not update health heartbeat: ${schedulerErrorMessage(error)}`
    )
  })
}

const heartbeat = setInterval(recordWorkerHeartbeat, WORKER_HEARTBEAT_INTERVAL_MS)
recordWorkerHeartbeat()

let shuttingDown = false

async function shutdown() {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  clearInterval(scheduler)
  try {
    await Promise.all([
      worker.close(),
      podcastWorker.close(),
      aiDigestWorker.close(),
      smartDigestWorker.close(),
      smartDigestEmailWorker.close(),
      opmlImportWorker.close(),
    ])
  } finally {
    clearInterval(heartbeat)
    await clearWorkerHeartbeat().catch((error) => {
      console.error(
        `[worker] could not clear health heartbeat: ${schedulerErrorMessage(error)}`
      )
    })
    await prisma.$disconnect()
  }
  process.exit(0)
}

process.on("SIGINT", () => {
  shutdown().catch((error) => {
    console.error(error)
    process.exit(1)
  })
})
process.on("SIGTERM", () => {
  shutdown().catch((error) => {
    console.error(error)
    process.exit(1)
  })
})

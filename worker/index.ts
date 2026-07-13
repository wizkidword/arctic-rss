import "dotenv/config"

import { Worker } from "bullmq"

import { cleanupExpiredAuthTokens } from "../src/lib/auth-token-maintenance"
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

assertSecureProductionConfiguration()

const {
  authTokenMaintenanceBatchSize,
  authTokenMaintenanceIntervalMs,
  feedRefreshConcurrency,
  podcastRefreshConcurrency,
  schedulerBatchSize,
  schedulerIntervalMs,
} = schedulerSettings()
const prisma = getPrisma()

console.log("Arctic RSS worker online")
console.log(
  `Redis queue endpoint: ${redisConnectionOptions().url.replace(/\/\/.*@/, "//***@")}`
)

const worker = new Worker<FeedRefreshJobData>(
  FEED_REFRESH_QUEUE_NAME,
  async (job) => {
    const result = await refreshFeed(job.data.feedId)
    console.log(
      `[worker] refreshed ${result.feedId} with ${result.articleCount} articles`
    )

    return result
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
    concurrency: Number(process.env.AI_DIGEST_CONCURRENCY ?? 2),
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
    concurrency: Number(process.env.SMART_DIGEST_CONCURRENCY ?? 2),
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
    concurrency: Number(process.env.SMART_DIGEST_EMAIL_CONCURRENCY ?? 2),
  }
)

const podcastWorker = new Worker<PodcastRefreshJobData>(
  PODCAST_REFRESH_QUEUE_NAME,
  async (job) => {
    const result = await refreshPodcast(job.data.podcastId)
    console.log(
      `[worker] refreshed podcast ${result.podcastId} with ${result.episodeCount} episodes`
    )

    return result
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

async function shutdown() {
  clearInterval(scheduler)
  await Promise.all([
    worker.close(),
    podcastWorker.close(),
    aiDigestWorker.close(),
    smartDigestWorker.close(),
    smartDigestEmailWorker.close(),
  ])
  await prisma.$disconnect()
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

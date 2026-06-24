import "dotenv/config"

import { Worker } from "bullmq"

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

const schedulerIntervalMs = Number(
  process.env.FEED_SCHEDULER_INTERVAL_MS ?? 60_000
)
const schedulerBatchSize = Number(process.env.FEED_SCHEDULER_BATCH_SIZE ?? 100)
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
    concurrency: Number(process.env.FEED_REFRESH_CONCURRENCY ?? 3),
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

async function enqueueDueFeeds() {
  const now = new Date()
  const feeds = await prisma.feed.findMany({
    orderBy: [{ lastFetchedAt: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      lastFetchedAt: true,
      refreshIntervalMinutes: true,
    },
    take: schedulerBatchSize,
    where: {
      subscriptions: {
        some: {
          isPaused: false,
        },
      },
    },
  })

  const dueFeeds = feeds.filter((feed) => {
    if (!feed.lastFetchedAt) {
      return true
    }

    const refreshAfterMs = feed.refreshIntervalMinutes * 60_000

    return now.getTime() - feed.lastFetchedAt.getTime() >= refreshAfterMs
  })

  for (const feed of dueFeeds) {
    await enqueueFeedRefresh(feed.id)
  }

  if (dueFeeds.length) {
    console.log(`[worker] enqueued ${dueFeeds.length} due feed refreshes`)
  }
}

let schedulerRunning = false

async function schedulerTick() {
  if (schedulerRunning) {
    return
  }

  schedulerRunning = true

  try {
    await enqueueDueFeeds()
  } catch (error) {
    console.error(
      `[worker] scheduler failed: ${
        error instanceof Error ? error.message : "unknown error"
      }`
    )
  } finally {
    schedulerRunning = false
  }
}

const scheduler = setInterval(() => {
  schedulerTick().catch(() => undefined)
}, schedulerIntervalMs)

schedulerTick().catch(() => undefined)

async function shutdown() {
  clearInterval(scheduler)
  await Promise.all([worker.close(), aiDigestWorker.close()])
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

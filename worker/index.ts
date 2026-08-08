import "dotenv/config"

import { Worker } from "bullmq"
import Redis from "ioredis"

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
  closeOpmlImportQueue,
  OPML_IMPORT_QUEUE_NAME,
  type OpmlImportQueueData,
} from "../src/lib/opml-import-queue"
import {
  AI_DIGEST_QUEUE_NAME,
  type AiDigestJobData,
} from "../src/lib/ai-digest-queue"
import { processAiDigest } from "../src/lib/ai-digests"
import { reconcileExpiredAiUsageOperations } from "../src/lib/ai-usage"
import { getPrisma } from "../src/lib/db"
import { refreshFeed } from "../src/lib/feed-refresh"
import {
  processChatArticleIntegration,
  processPendingChatBotDeliveries,
} from "../src/lib/chat/bot"
import {
  CHAT_ARTICLE_INTEGRATION_QUEUE_NAME,
  closeChatArticleIntegrationQueue,
  enqueueChatArticleIntegration,
  type ChatArticleIntegrationJobData,
} from "../src/lib/chat/bot-queue"
import { getChatFeatureFlags } from "../src/lib/chat/feature-flags"
import {
  getChatRetentionSettings,
  purgeExpiredChatRecords,
  type ChatRetentionContinuation,
} from "../src/lib/chat/retention"
import { processChatEventOutbox } from "../src/lib/chat/event-outbox"
import { closeChatRoomEventPublisher } from "../src/lib/chat/room-events"
import {
  closeFeedRefreshQueue,
  enqueueFeedRefresh,
  FEED_REFRESH_QUEUE_NAME,
  type FeedRefreshJobData,
} from "../src/lib/feed-refresh-queue"
import { durableRedisConnectionOptions } from "../src/lib/redis-config"
import { refreshPodcast } from "../src/lib/podcast-refresh"
import {
  closePodcastRefreshQueue,
  enqueuePodcastRefresh,
  PODCAST_REFRESH_QUEUE_NAME,
  type PodcastRefreshJobData,
} from "../src/lib/podcast-refresh-queue"
import {
  enqueueDueFeedRefreshes,
  enqueueDuePodcastRefreshes,
  schedulerSettings,
} from "../src/lib/refresh-scheduler"
import { readClampedPositiveInteger } from "../src/lib/refresh-schedule"
import {
  processDueSavedMonitors,
  savedMonitorSettings,
} from "../src/lib/saved-monitors"
import { assertSecureProductionConfiguration } from "../src/lib/production-security"
import { cleanupExpiredSecurityEvents } from "../src/lib/security-event-maintenance"
import { processSmartDigestEmailDelivery } from "../src/lib/smart-digest-delivery"
import {
  closeSmartDigestEmailQueue,
  enqueueSmartDigestEmail,
  SMART_DIGEST_EMAIL_QUEUE_NAME,
  type SmartDigestEmailJobData,
} from "../src/lib/smart-digest-email-queue"
import {
  closeSmartDigestQueue,
  enqueueSmartDigestRule,
  SMART_DIGEST_QUEUE_NAME,
  type SmartDigestJobData,
} from "../src/lib/smart-digest-queue"
import { processSmartDigestRule } from "../src/lib/smart-digest-processing"
import {
  clearWorkerHeartbeat,
  maintenanceTickMaxAgeMs,
  writeDurableMaintenanceTick,
} from "../src/lib/worker-health"
import {
  getWorkerShutdownTimeoutMs,
  installWorkerSignalHandlers,
  shutdownWorkerRuntime,
} from "./shutdown"
import {
  getWorkerMode,
  runsWorkerResponsibility,
  workerHeartbeatPath,
} from "./mode"
import { createMaintenanceLock, type MaintenanceLease } from "./maintenance-lock"
import { logWorkerMemory } from "./memory-log"
import { startWorkerHeartbeat } from "./heartbeat"
import { createManagedWorkerTargets } from "./managed-workers"

const workerMode = getWorkerMode()
assertSecureProductionConfiguration(process.env, `worker-${workerMode}`)
const heartbeatPath = workerHeartbeatPath(workerMode)
const heartbeatInstanceId = process.env.HOSTNAME?.trim() || `worker-${process.pid}`
const heartbeatVersion = process.env.ARCTIC_RSS_BUILD_SHA?.trim() || "unknown"
const durableHeartbeatStore = new Redis(durableRedisConnectionOptions().url, {
  connectTimeout: 2_000,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 0,
  retryStrategy: () => null,
})
durableHeartbeatStore.on("error", () => {
  // The retry loop below records a redacted operational error without secrets.
})
const maintenanceLock = runsWorkerResponsibility(workerMode, "maintenance")
  ? createMaintenanceLock()
  : undefined

const {
  aiDigestConcurrency,
  authTokenMaintenanceBatchSize,
  authTokenMaintenanceIntervalMs,
  feedRefreshConcurrency,
  podcastRefreshConcurrency,
  schedulerBatchSize,
  schedulerIntervalMs,
  securityEventMaintenanceBatchSize,
  securityEventMaintenanceIntervalMs,
  smartDigestConcurrency,
  smartDigestEmailConcurrency,
} = schedulerSettings()
const savedMonitorSchedulerSettings = savedMonitorSettings()
const chatRetentionSettings = getChatRetentionSettings()
const { intervalMs: chatRetentionIntervalMs } = chatRetentionSettings
const prisma = getPrisma()
const chatEventOutboxIntervalMs = readClampedPositiveInteger({
  fallback: 1_000,
  maximum: 10_000,
  minimum: 250,
  value: process.env.CHAT_EVENT_OUTBOX_PUBLISH_INTERVAL_MS,
})
const WORKER_HEARTBEAT_INTERVAL_MS = 30_000
const WORKER_MEMORY_LOG_INTERVAL_MS = 5 * 60_000

console.log(`Arctic RSS ${workerMode} worker online`)
console.log(
  `Redis queue endpoint: ${durableRedisConnectionOptions().url.replace(/\/\/.*@/, "//***@")}`
)
logWorkerMemory({ trigger: "startup" })

const worker = runsWorkerResponsibility(workerMode, "ingestion")
  ? new Worker<FeedRefreshJobData>(
  FEED_REFRESH_QUEUE_NAME,
  async (job) => {
    return runTrackedRefresh({
      kind: "feed",
      refresh: () => refreshFeedAndQueueChatIntegration(job.data.feedId),
      sourceId: job.data.feedId,
    })
  },
  {
    connection: durableRedisConnectionOptions(),
    concurrency: feedRefreshConcurrency,
  }
  )
  : undefined

const aiDigestWorker = runsWorkerResponsibility(workerMode, "ai-mail")
  ? new Worker<AiDigestJobData>(
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
    connection: durableRedisConnectionOptions(),
    concurrency: aiDigestConcurrency,
  }
  )
  : undefined

const smartDigestWorker = runsWorkerResponsibility(workerMode, "ai-mail")
  ? new Worker<SmartDigestJobData>(
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
    connection: durableRedisConnectionOptions(),
    concurrency: smartDigestConcurrency,
  }
  )
  : undefined

const chatArticleIntegrationWorker = runsWorkerResponsibility(workerMode, "chat-events")
  ? new Worker<ChatArticleIntegrationJobData>(
  CHAT_ARTICLE_INTEGRATION_QUEUE_NAME,
  async (job) => {
    return processChatArticleIntegration({
      articleId: job.data.articleId,
    })
  },
  {
    connection: durableRedisConnectionOptions(),
    concurrency: 1,
  }
  )
  : undefined

const bulkReadWorker = runsWorkerResponsibility(workerMode, "imports")
  ? new Worker<BulkReadJobData>(
  BULK_READ_QUEUE_NAME,
  async (job) => {
    return processBulkReadJob({
      jobId: job.data.jobId,
      onProgress: (progress) => job.updateProgress(progress),
    })
  },
  {
    connection: durableRedisConnectionOptions(),
    concurrency: 1,
  }
  )
  : undefined

const opmlImportWorker = runsWorkerResponsibility(workerMode, "imports")
  ? new Worker<OpmlImportQueueData>(
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
    logWorkerMemory({
      jobId: job.data.jobId,
      outcome: result.status.toLowerCase(),
      trigger: "opml_import",
    })

    return result
  },
  {
    connection: durableRedisConnectionOptions(),
    concurrency: 1,
  }
  )
  : undefined

const smartDigestEmailWorker = runsWorkerResponsibility(workerMode, "ai-mail")
  ? new Worker<SmartDigestEmailJobData>(
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
    connection: durableRedisConnectionOptions(),
    concurrency: smartDigestEmailConcurrency,
  }
  )
  : undefined

const podcastWorker = runsWorkerResponsibility(workerMode, "ingestion")
  ? new Worker<PodcastRefreshJobData>(
  PODCAST_REFRESH_QUEUE_NAME,
  async (job) => {
    return runTrackedRefresh({
      kind: "podcast",
      refresh: () => refreshPodcast(job.data.podcastId),
      sourceId: job.data.podcastId,
    })
  },
  {
    connection: durableRedisConnectionOptions(),
    concurrency: podcastRefreshConcurrency,
  }
  )
  : undefined

const managedWorkers = createManagedWorkerTargets([
  { name: "feed-refresh", worker },
  { name: "podcast-refresh", worker: podcastWorker },
  { name: "ai-digest", worker: aiDigestWorker },
  { name: "smart-digest", worker: smartDigestWorker },
  { name: "smart-digest-email", worker: smartDigestEmailWorker },
  { name: "opml-import", worker: opmlImportWorker },
  { name: "bulk-read", worker: bulkReadWorker },
  { name: "chat-article-integration", worker: chatArticleIntegrationWorker },
])

worker?.on("failed", (job, error) => {
  console.error(
    `[worker] refresh failed for ${job?.data.feedId ?? "unknown feed"}: ${error.message}`
  )
})

aiDigestWorker?.on("failed", (job, error) => {
  console.error(
    `[worker] digest failed for ${job?.data.digestId ?? "unknown digest"}: ${error.message}`
  )
})

smartDigestWorker?.on("failed", (job, error) => {
  console.error(
    `[worker] smart digest failed for ${job?.data.ruleId ?? "unknown rule"}: ${error.message}`
  )
})

chatArticleIntegrationWorker?.on("failed", (job, error) => {
  console.error(
    `[worker] chat article integration failed for ${job?.data.articleId ?? "unknown article"}: ${error.message}`
  )
})

bulkReadWorker?.on("failed", (job, error) => {
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

opmlImportWorker?.on("failed", (job, error) => {
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

smartDigestEmailWorker?.on("failed", (job, error) => {
  console.error(
    `[worker] smart digest email failed for ${job?.data.runId ?? "unknown run"}: ${error.message}`
  )
})

podcastWorker?.on("failed", (job, error) => {
  console.error(
    `[worker] podcast refresh failed for ${job?.data.podcastId ?? "unknown podcast"}: ${error.message}`
  )
})

async function enqueueDueFeeds(lease?: MaintenanceLease) {
  return enqueueDueFeedRefreshes({
    assertLeaseHeld: lease?.assertHeld,
    batchSize: schedulerBatchSize,
    enqueue: enqueueFeedRefresh,
    store: prisma as unknown as Parameters<typeof enqueueDueFeedRefreshes>[0]["store"],
  })
}

async function refreshFeedAndQueueChatIntegration(feedId: string) {
  const result = await refreshFeed(feedId)

  if (!getChatFeatureFlags().botEnabled || !result.newArticleIds?.length) {
    return result
  }

  const queued = await Promise.allSettled(
    result.newArticleIds.map((articleId) => enqueueChatArticleIntegration(articleId))
  )
  const failed = queued.filter((entry) => entry.status === "rejected").length
  if (failed) {
    console.error(
      JSON.stringify({
        event: "chat_article_integration_enqueue",
        failed,
        outcome: "deferred",
      })
    )
  }

  return result
}

async function processPendingChatBotMessages(lease?: MaintenanceLease) {
  return processPendingChatBotDeliveries({
    assertLeaseHeld: lease?.assertHeld,
    limit: schedulerBatchSize,
  })
}

async function enqueueDuePodcasts(lease?: MaintenanceLease) {
  return enqueueDuePodcastRefreshes({
    assertLeaseHeld: lease?.assertHeld,
    batchSize: schedulerBatchSize,
    enqueue: enqueuePodcastRefresh,
    store: prisma as unknown as Parameters<typeof enqueueDuePodcastRefreshes>[0]["store"],
  })
}

async function enqueueDueSmartDigests(lease?: MaintenanceLease) {
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
    lease?.assertHeld()
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
let schedulerTickPromise: Promise<void> | undefined
let nextAuthTokenMaintenanceAt = 0
let nextChatRetentionAt = 0
let nextSecurityEventMaintenanceAt = 0
let chatRetentionContinuation: ChatRetentionContinuation | undefined
let chatRetentionFailureCount = 0

function schedulerErrorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : "unknown error"
}

async function runLeaseAwareMaintenance<T>(
  lease: MaintenanceLease | undefined,
  operation: () => Promise<T>
) {
  lease?.assertHeld()
  const result = await operation()
  lease?.assertHeld()
  return result
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

async function schedulerTick(lease?: MaintenanceLease) {
  if (schedulerRunning) {
    return false
  }

  schedulerRunning = true

  try {
    const [
      feedResult,
      podcastResult,
      smartDigestResult,
      smartDigestEmailResult,
      chatBotResult,
      chatRetentionResult,
      maintenanceResult,
      securityEventMaintenanceResult,
      aiOperationReconciliationResult,
      savedMonitorResult,
    ] = await Promise.allSettled([
      runLeaseAwareMaintenance(lease, () => enqueueDueFeeds(lease)),
      runLeaseAwareMaintenance(lease, () => enqueueDuePodcasts(lease)),
      runLeaseAwareMaintenance(lease, () => enqueueDueSmartDigests(lease)),
      runLeaseAwareMaintenance(lease, () => enqueuePendingSmartDigestEmails(lease)),
      runLeaseAwareMaintenance(lease, () => processPendingChatBotMessages(lease)),
      runLeaseAwareMaintenance(lease, () => runChatRetention(lease)),
      runLeaseAwareMaintenance(lease, runAuthTokenMaintenance),
      runLeaseAwareMaintenance(lease, runSecurityEventMaintenance),
      runLeaseAwareMaintenance(lease, () => runAiOperationReconciliation(lease)),
      runLeaseAwareMaintenance(lease, () => runSavedMonitors(lease)),
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

    if (chatBotResult.status === "fulfilled" && !chatBotResult.value.disabled) {
      console.log(
        JSON.stringify({
          event: "chat_bot_scheduler",
          posted: chatBotResult.value.messages.length,
          roomFeedCount: chatBotResult.value.roomFeedCount,
        })
      )
    }

    if (
      chatRetentionResult.status === "fulfilled" &&
      !("disabled" in chatRetentionResult.value && chatRetentionResult.value.disabled)
    ) {
      chatRetentionFailureCount = 0
      console.log(
        JSON.stringify({
          event: "chat_retention",
          ...chatRetentionResult.value,
          outcome: "success",
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

    if (chatBotResult.status === "rejected") {
      console.error(
        `[worker] chat bot scheduler failed: ${schedulerErrorMessage(chatBotResult.reason)}`
      )
    }

    if (chatRetentionResult.status === "rejected") {
      chatRetentionFailureCount += 1
      console.error(
        JSON.stringify({
          event: "chat_retention",
          failureCount: chatRetentionFailureCount,
          outcome: "failure",
          reason: schedulerErrorMessage(chatRetentionResult.reason),
        })
      )
    }

    if (maintenanceResult.status === "rejected") {
      console.error(
        `[worker] auth token maintenance failed: ${schedulerErrorMessage(
          maintenanceResult.reason
        )}`
      )
    }

    if (securityEventMaintenanceResult.status === "fulfilled") {
      console.log(
        JSON.stringify({
          event: "security_event_maintenance",
          outcome: "success",
          ...securityEventMaintenanceResult.value,
        })
      )
    }

    if (securityEventMaintenanceResult.status === "rejected") {
      console.error(
        `[worker] security event maintenance failed: ${schedulerErrorMessage(
          securityEventMaintenanceResult.reason
        )}`
      )
    }

    if (aiOperationReconciliationResult.status === "fulfilled") {
      console.log(
        JSON.stringify({
          event: "ai_operation_reconciliation",
          outcome: "success",
          ...aiOperationReconciliationResult.value,
        })
      )
    }

    if (aiOperationReconciliationResult.status === "rejected") {
      console.error(
        `[worker] AI operation reconciliation failed: ${schedulerErrorMessage(
          aiOperationReconciliationResult.reason
        )}`
      )
    }

    if (savedMonitorResult.status === "fulfilled") {
      console.log(
        JSON.stringify({
          event: "saved_monitor_scheduler",
          outcome: "success",
          ...savedMonitorResult.value,
        })
      )
    }

    if (savedMonitorResult.status === "rejected") {
      console.error(
        `[worker] saved monitor scheduler failed: ${schedulerErrorMessage(
          savedMonitorResult.reason
        )}`
      )
    }

    return [
      feedResult,
      podcastResult,
      smartDigestResult,
      smartDigestEmailResult,
      chatBotResult,
      chatRetentionResult,
      maintenanceResult,
      securityEventMaintenanceResult,
      aiOperationReconciliationResult,
      savedMonitorResult,
    ].every((result) => result.status === "fulfilled")
  } finally {
    schedulerRunning = false
  }
}

function runSchedulerTick() {
  if (schedulerTickPromise) {
    return schedulerTickPromise
  }

  schedulerTickPromise = (maintenanceLock
    ? maintenanceLock.run((lease) => schedulerTick(lease)).then(async (result) => {
        if (!result.acquired) {
          console.warn(
            JSON.stringify({
              event: "worker_maintenance_lock",
              outcome: "skipped",
            })
          )
          return
        }

        if (!result.value) {
          console.error("[worker] maintenance tick completed with failed operations")
          return
        }

        await writeDurableMaintenanceTick({
          client: durableHeartbeatStore,
          instanceId: heartbeatInstanceId,
          mode: workerMode,
          timestamp: Date.now(),
          ttlMs: maintenanceTickMaxAgeMs({
            FEED_SCHEDULER_INTERVAL_MS: String(schedulerIntervalMs),
          }),
          version: heartbeatVersion,
        })
      })
    : schedulerTick().then(async (succeeded) => {
        if (!succeeded) {
          return
        }

        await writeDurableMaintenanceTick({
          client: durableHeartbeatStore,
          instanceId: heartbeatInstanceId,
          mode: workerMode,
          timestamp: Date.now(),
          ttlMs: maintenanceTickMaxAgeMs({
            FEED_SCHEDULER_INTERVAL_MS: String(schedulerIntervalMs),
          }),
          version: heartbeatVersion,
        })
      }))
    .catch((error) => {
      console.error(`[worker] scheduler tick failed: ${schedulerErrorMessage(error)}`)
    })
    .finally(() => {
      schedulerTickPromise = undefined
    })

  return schedulerTickPromise
}

async function runChatRetention(lease?: MaintenanceLease) {
  if (!getChatFeatureFlags().enabled) {
    return { disabled: true }
  }

  const now = Date.now()

  if (now < nextChatRetentionAt) {
    return { disabled: true }
  }

  nextChatRetentionAt = now + chatRetentionIntervalMs
  const result = await purgeExpiredChatRecords({
    assertLeaseHeld: lease?.assertHeld,
    batchSize: chatRetentionSettings.batchSize,
    continuation: chatRetentionContinuation,
    maxBatches: chatRetentionSettings.maxBatches,
    maxRuntimeMs: chatRetentionSettings.maxRuntimeMs,
    store: prisma,
  })
  // Another worker may own the distributed lock. Preserve our local cursor in
  // that case so a skipped pass cannot make the next successful pass rescan
  // from the beginning.
  if (!result.skipped) {
    chatRetentionContinuation = result.continuation ?? undefined
  }

  return result
}

async function enqueuePendingSmartDigestEmails(lease?: MaintenanceLease) {
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
    lease?.assertHeld()
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
    result.passwordResetTokensDeleted +
    result.emailVerificationTokensDeleted +
    result.accountDeletionConfirmationTokensDeleted

  console.log(
    JSON.stringify({
      accountDeletionConfirmationTokensDeleted: result.accountDeletionConfirmationTokensDeleted,
      emailVerificationTokensDeleted: result.emailVerificationTokensDeleted,
      event: "auth_token_maintenance",
      outcome: "success",
      passwordResetTokensDeleted: result.passwordResetTokensDeleted,
      totalDeleted: deleted,
    })
  )
}

async function runSecurityEventMaintenance() {
  const now = Date.now()

  if (now < nextSecurityEventMaintenanceAt) {
    return { securityEventsDeleted: 0 }
  }

  nextSecurityEventMaintenanceAt = now + securityEventMaintenanceIntervalMs
  return cleanupExpiredSecurityEvents({
    batchSize: securityEventMaintenanceBatchSize,
    store: prisma,
  })
}

async function runAiOperationReconciliation(lease?: MaintenanceLease) {
  return reconcileExpiredAiUsageOperations({
    assertLeaseHeld: lease?.assertHeld,
    batchSize: schedulerBatchSize,
    store: prisma as unknown as Parameters<typeof reconcileExpiredAiUsageOperations>[0]["store"],
  })
}

async function runSavedMonitors(lease?: MaintenanceLease) {
  return processDueSavedMonitors({
    assertLeaseHeld: lease?.assertHeld,
    settings: savedMonitorSchedulerSettings,
    store: prisma as unknown as Parameters<typeof processDueSavedMonitors>[0]["store"],
  })
}

let chatOutboxPublishPromise: Promise<void> | undefined

function publishPendingChatEvents() {
  if (chatOutboxPublishPromise) {
    return chatOutboxPublishPromise
  }

  chatOutboxPublishPromise = processChatEventOutbox({
    owner: `chat-outbox:worker:${process.pid}`,
  })
    .then((result) => {
      if (result.claimed) {
        console.log(
          JSON.stringify({
            event: "chat_event_outbox",
            outcome: "success",
            ...result,
          })
        )
      }
    })
    .catch((error) => {
      console.error(
        `[worker] chat event outbox failed: ${schedulerErrorMessage(error)}`
      )
    })
    .finally(() => {
      chatOutboxPublishPromise = undefined
    })

  return chatOutboxPublishPromise
}

const scheduler = runsWorkerResponsibility(workerMode, "maintenance")
  ? setInterval(() => {
      void runSchedulerTick()
    }, schedulerIntervalMs)
  : undefined
const chatOutboxPublisher = runsWorkerResponsibility(workerMode, "chat-events")
  ? setInterval(() => {
      void publishPendingChatEvents()
    }, chatEventOutboxIntervalMs)
  : undefined

if (scheduler) {
  void runSchedulerTick()
}
if (chatOutboxPublisher) {
  void publishPendingChatEvents()
}

const heartbeat = startWorkerHeartbeat({
  instanceId: heartbeatInstanceId,
  intervalMs: WORKER_HEARTBEAT_INTERVAL_MS,
  mode: workerMode,
  path: heartbeatPath,
  store: durableHeartbeatStore,
  version: heartbeatVersion,
})
const memoryTelemetry = setInterval(
  () => logWorkerMemory({ trigger: "interval" }),
  WORKER_MEMORY_LOG_INTERVAL_MS
)

let shutdownPromise: ReturnType<typeof shutdownWorkerRuntime> | undefined

function shutdown() {
  if (!shutdownPromise) {
    shutdownPromise = shutdownWorkerRuntime({
      closeResources: async () => {
        await Promise.all([
          closeFeedRefreshQueue(),
          closePodcastRefreshQueue(),
          closeSmartDigestQueue(),
          closeSmartDigestEmailQueue(),
          closeOpmlImportQueue(),
          closeChatArticleIntegrationQueue(),
          closeChatRoomEventPublisher(),
          maintenanceLock?.close() ?? Promise.resolve(),
          closeDurableHeartbeatStore(),
        ])
        await clearWorkerHeartbeat({ path: heartbeatPath }).catch((error) => {
          console.error(
            `[worker] could not clear health heartbeat: ${schedulerErrorMessage(error)}`
          )
        })
      },
      disconnectDatabase: () => prisma.$disconnect(),
      getPendingWork: () =>
        [schedulerTickPromise, chatOutboxPublishPromise].filter(
          (work): work is Promise<void> => Boolean(work)
        ),
      stopScheduling: () => {
        if (scheduler) {
          clearInterval(scheduler)
        }
        if (chatOutboxPublisher) {
          clearInterval(chatOutboxPublisher)
        }
        heartbeat.stop()
        clearInterval(memoryTelemetry)
      },
      timeoutMs: getWorkerShutdownTimeoutMs(),
      workers: managedWorkers,
    })
  }

  return shutdownPromise
}

async function closeDurableHeartbeatStore() {
  try {
    await durableHeartbeatStore.quit()
  } catch {
    durableHeartbeatStore.disconnect()
  }
}

installWorkerSignalHandlers({
  exit: (code) => process.exit(code),
  onError: (error) => console.error(error),
  shutdown,
})

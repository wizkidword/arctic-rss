import "dotenv/config"

import { Worker } from "bullmq"

import { cleanupExpiredAuthTokens } from "../src/lib/auth-token-maintenance"
import { failBulkReadJob, processBulkReadJob } from "../src/lib/bulk-read-jobs"
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
import { writeHealthSnapshot } from "../src/lib/health-snapshot"
import {
  getMobileSyncRetentionSettings,
  type MobileSyncRetentionStore,
  pruneMobileSyncEvents,
} from "../src/lib/mobile-sync-retention"
import { recordMobileJournalRetention } from "../src/lib/mobile-telemetry"
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
import type { SourceRefreshTrigger } from "../src/lib/source-refresh-queue"
import { durableRedisConnectionOptions } from "../src/lib/redis-config"
import { refreshPodcast } from "../src/lib/podcast-refresh"
import {
  closePodcastRefreshQueue,
  enqueuePodcastRefresh,
  PODCAST_REFRESH_QUEUE_NAME,
  type PodcastRefreshJobData,
} from "../src/lib/podcast-refresh-queue"
import {
  recordSourceRefreshFailure,
  recordSourceRefreshSuccess,
  sourceHostFromUrl,
  sourceRefreshErrorCategory,
} from "../src/lib/source-refresh-failures"
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
import { getRuntimeTopology } from "../src/lib/runtime-topology"
import { cleanupExpiredSecurityEvents } from "../src/lib/security-event-maintenance"
import { reportSourceOrphanRetention } from "../src/lib/source-orphan-retention"
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
  checkSystemHealth,
  type SystemHealthResult,
} from "../src/lib/system-health"
import { unavailableSourceRefreshReliability } from "../src/lib/source-refresh-reliability"
import {
  clearWorkerHeartbeat,
  maintenanceTickMaxAgeMs,
  writeDurableMaintenanceTick,
  writeDurableResponsibilityTick,
  type ScheduledResponsibility,
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
import {
  createMaintenanceLock,
  type MaintenanceLease,
} from "./maintenance-lock"
import { MaintenanceSchedule } from "./maintenance-schedule"
import { createWorkerControlPlaneRedis } from "./control-plane-redis"
import { logWorkerMemory } from "./memory-log"
import { startWorkerHeartbeat } from "./heartbeat"
import { createManagedWorkerTargets } from "./managed-workers"

const workerMode = getWorkerMode()
assertSecureProductionConfiguration(process.env, `worker-${workerMode}`)
const heartbeatPath = workerHeartbeatPath(workerMode)
const heartbeatInstanceId =
  process.env.HOSTNAME?.trim() || `worker-${process.pid}`
const heartbeatVersion = process.env.ARCTIC_RSS_BUILD_SHA?.trim() || "unknown"
const runsHealthSnapshotProducer = workerMode === "health"
let controlPlaneRestartRequested = false

function requestControlPlaneRestart() {
  if (controlPlaneRestartRequested) {
    return
  }

  controlPlaneRestartRequested = true
  console.error(
    JSON.stringify({
      event: "worker_control_plane_redis",
      outcome: "recovery_grace_expired",
    })
  )
  void shutdown()
    .catch((error) => {
      console.error(
        `[worker] control-plane shutdown failed: ${schedulerErrorMessage(error)}`
      )
    })
    .finally(() => process.exit(1))
}

const durableHeartbeatControl = createWorkerControlPlaneRedis({
  name: "durable-heartbeat",
  onGraceExpired: requestControlPlaneRestart,
})
const durableHeartbeatStore = durableHeartbeatControl.client
const maintenanceLock = runsWorkerResponsibility(workerMode, "maintenance")
  ? createMaintenanceLock({
      onRecoveryGraceExpired: requestControlPlaneRestart,
    })
  : undefined
const healthSnapshotLock = runsHealthSnapshotProducer
  ? createMaintenanceLock({
      key: "arctic-rss:worker:health-snapshot-lock:v1",
      name: "health_snapshot",
      onRecoveryGraceExpired: requestControlPlaneRestart,
    })
  : undefined
const orphanReportingLock = runsWorkerResponsibility(workerMode, "maintenance")
  ? createMaintenanceLock({
      key: "arctic-rss:worker:orphan-reporting-lock:v1",
      name: "orphan_reporting",
      onRecoveryGraceExpired: requestControlPlaneRestart,
    })
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
const mobileSyncRetentionSettings = getMobileSyncRetentionSettings()
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
const HEALTH_SNAPSHOT_INTERVAL_MS = 20_000
const HEALTH_SNAPSHOT_INITIAL_DELAY_MS = 5_000
const SOURCE_ORPHAN_REPORT_INTERVAL_MS = 24 * 60 * 60_000
const SOURCE_ORPHAN_REPORT_POLL_INTERVAL_MS = 60_000
const authTokenMaintenanceSchedule = new MaintenanceSchedule({
  normalIntervalMs: authTokenMaintenanceIntervalMs,
})
const chatRetentionMaintenanceSchedule = new MaintenanceSchedule({
  normalIntervalMs: chatRetentionIntervalMs,
})
const securityEventMaintenanceSchedule = new MaintenanceSchedule({
  normalIntervalMs: securityEventMaintenanceIntervalMs,
})
const mobileSyncRetentionSchedule = new MaintenanceSchedule({
  normalIntervalMs: mobileSyncRetentionSettings.intervalMs,
})
const aiOperationReconciliationSchedule = new MaintenanceSchedule({
  normalIntervalMs: schedulerIntervalMs,
})
const savedMonitorMaintenanceSchedule = new MaintenanceSchedule({
  normalIntervalMs: schedulerIntervalMs,
})
const sourceOrphanReportSchedule = new MaintenanceSchedule({
  normalIntervalMs: SOURCE_ORPHAN_REPORT_INTERVAL_MS,
})
const healthSnapshotSchedule = new MaintenanceSchedule({
  normalIntervalMs: HEALTH_SNAPSHOT_INTERVAL_MS,
})

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
          trigger: job.data.trigger ?? "scheduler",
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

const chatArticleIntegrationWorker = runsWorkerResponsibility(
  workerMode,
  "chat-events"
)
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
          trigger: job.data.trigger ?? "scheduler",
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
  void recordTerminalSourceRefreshFailure("feed", job, error)
})

worker?.on("completed", () => {
  recordTerminalSourceRefreshSuccess("feed")
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
  void recordTerminalSourceRefreshFailure("podcast", job, error)
})

podcastWorker?.on("completed", () => {
  recordTerminalSourceRefreshSuccess("podcast")
})

async function enqueueDueFeeds(lease?: MaintenanceLease) {
  return enqueueDueFeedRefreshes({
    assertLeaseHeld: lease?.assertHeld,
    batchSize: schedulerBatchSize,
    enqueue: enqueueFeedRefresh,
    store: prisma as unknown as Parameters<
      typeof enqueueDueFeedRefreshes
    >[0]["store"],
  })
}

async function refreshFeedAndQueueChatIntegration(feedId: string) {
  const result = await refreshFeed(feedId)

  if (!getChatFeatureFlags().botEnabled || !result.newArticleIds?.length) {
    return result
  }

  const queued = await Promise.allSettled(
    result.newArticleIds.map((articleId) =>
      enqueueChatArticleIntegration(articleId)
    )
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
    store: prisma as unknown as Parameters<
      typeof enqueueDuePodcastRefreshes
    >[0]["store"],
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
      user: {
        disabledAt: null,
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

  return { enqueued: rules.length }
}

let schedulerRunning = false
let schedulerTickPromise: Promise<void> | undefined
let healthSnapshotPromise: Promise<void> | undefined
let orphanReportingPromise: Promise<void> | undefined
let chatRetentionContinuation: ChatRetentionContinuation | undefined

function schedulerErrorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : "unknown error"
}

function maintenanceScheduleMetrics(schedule: MaintenanceSchedule) {
  const snapshot = schedule.snapshot(Date.now())

  return {
    failureCount: snapshot.failureCount,
    lastSuccessAgeMs: snapshot.lastSuccessAgeMs,
    nextEligibleAt: new Date(snapshot.nextEligibleAt).toISOString(),
  }
}

async function publishSuccessfulResponsibilityTicks(
  results: Array<[ScheduledResponsibility, PromiseSettledResult<unknown>]>
) {
  const timestamp = Date.now()
  const ttlMs = maintenanceTickMaxAgeMs({
    FEED_SCHEDULER_INTERVAL_MS: String(schedulerIntervalMs),
  })

  await Promise.all(
    results.map(async ([responsibility, result]) => {
      if (result.status !== "fulfilled" || result.value === undefined) {
        return
      }

      await writeDurableResponsibilityTick({
        client: durableHeartbeatStore,
        instanceId: heartbeatInstanceId,
        responsibility,
        timestamp,
        ttlMs,
        version: heartbeatVersion,
      })
    })
  )
}

async function recordTerminalSourceRefreshFailure(
  kind: "feed" | "podcast",
  job:
    | {
        attemptsMade: number
        data: { feedId?: string; podcastId?: string }
        opts: { attempts?: number }
      }
    | undefined,
  error: unknown
) {
  if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) {
    return
  }

  const sourceId = kind === "feed" ? job.data.feedId : job.data.podcastId
  const source = sourceId
    ? kind === "feed"
      ? await prisma.feed.findUnique({
          select: { feedUrl: true },
          where: { id: sourceId },
        })
      : await prisma.podcast.findUnique({
          select: { feedUrl: true },
          where: { id: sourceId },
        })
    : null

  await recordSourceRefreshFailure({
    client: durableHeartbeatStore,
    errorCategory: sourceRefreshErrorCategory(error),
    host: sourceHostFromUrl(source?.feedUrl),
    kind,
  })
}

function recordTerminalSourceRefreshSuccess(kind: "feed" | "podcast") {
  void recordSourceRefreshSuccess({
    client: durableHeartbeatStore,
    kind,
  }).catch(() => {
    console.error(`[worker] could not record ${kind} refresh success evidence`)
  })
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
  trigger,
}: {
  kind: "feed" | "podcast"
  refresh: () => Promise<Result>
  sourceId: string
  trigger: SourceRefreshTrigger
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
        trigger,
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
        trigger,
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
      mobileSyncRetentionResult,
      aiOperationReconciliationResult,
      savedMonitorResult,
    ] = await Promise.allSettled([
      runLeaseAwareMaintenance(lease, () => enqueueDueFeeds(lease)),
      runLeaseAwareMaintenance(lease, () => enqueueDuePodcasts(lease)),
      runLeaseAwareMaintenance(lease, () => enqueueDueSmartDigests(lease)),
      runLeaseAwareMaintenance(lease, () =>
        enqueuePendingSmartDigestEmails(lease)
      ),
      runLeaseAwareMaintenance(lease, () =>
        processPendingChatBotMessages(lease)
      ),
      runLeaseAwareMaintenance(lease, () => runChatRetention(lease)),
      runLeaseAwareMaintenance(lease, runAuthTokenMaintenance),
      runLeaseAwareMaintenance(lease, runSecurityEventMaintenance),
      runLeaseAwareMaintenance(lease, runMobileSyncRetention),
      runLeaseAwareMaintenance(lease, () =>
        runAiOperationReconciliation(lease)
      ),
      runLeaseAwareMaintenance(lease, () => runSavedMonitors(lease)),
    ])

    await publishSuccessfulResponsibilityTicks([
      ["feed-scheduling", feedResult],
      ["podcast-scheduling", podcastResult],
      ["smart-digest-scheduling", smartDigestResult],
      ["smart-digest-email-scheduling", smartDigestEmailResult],
      ["chat-retention", chatRetentionResult],
      ["auth-token-cleanup", maintenanceResult],
      ["security-event-cleanup", securityEventMaintenanceResult],
      ["ai-operation-reconciliation", aiOperationReconciliationResult],
      ["saved-monitors", savedMonitorResult],
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
        `[worker] smart digest scheduler failed: ${schedulerErrorMessage(smartDigestResult.reason)}`
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
      console.error(
        JSON.stringify({
          event: "chat_retention",
          ...maintenanceScheduleMetrics(chatRetentionMaintenanceSchedule),
          outcome: "failure",
          reason: schedulerErrorMessage(chatRetentionResult.reason),
        })
      )
    }

    if (maintenanceResult.status === "rejected") {
      console.error(
        JSON.stringify({
          event: "auth_token_maintenance",
          ...maintenanceScheduleMetrics(authTokenMaintenanceSchedule),
          outcome: "failure",
          reason: schedulerErrorMessage(maintenanceResult.reason),
        })
      )
    }

    if (securityEventMaintenanceResult.status === "rejected") {
      console.error(
        JSON.stringify({
          event: "security_event_maintenance",
          ...maintenanceScheduleMetrics(securityEventMaintenanceSchedule),
          outcome: "failure",
          reason: schedulerErrorMessage(securityEventMaintenanceResult.reason),
        })
      )
    }

    if (mobileSyncRetentionResult.status === "rejected") {
      console.error(
        JSON.stringify({
          event: "mobile_sync_retention",
          ...maintenanceScheduleMetrics(mobileSyncRetentionSchedule),
          outcome: "failure",
          reason: schedulerErrorMessage(mobileSyncRetentionResult.reason),
        })
      )
    }

    if (aiOperationReconciliationResult.status === "rejected") {
      console.error(
        JSON.stringify({
          event: "ai_operation_reconciliation",
          ...maintenanceScheduleMetrics(aiOperationReconciliationSchedule),
          outcome: "failure",
          reason: schedulerErrorMessage(aiOperationReconciliationResult.reason),
        })
      )
    }

    if (savedMonitorResult.status === "rejected") {
      console.error(
        JSON.stringify({
          event: "saved_monitor_scheduler",
          ...maintenanceScheduleMetrics(savedMonitorMaintenanceSchedule),
          outcome: "failure",
          reason: schedulerErrorMessage(savedMonitorResult.reason),
        })
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
      mobileSyncRetentionResult,
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

  schedulerTickPromise = (
    maintenanceLock
      ? maintenanceLock
          .run((lease) => schedulerTick(lease))
          .then(async (result) => {
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
              console.error(
                "[worker] maintenance tick completed with failed operations"
              )
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
        })
  )
    .catch((error) => {
      console.error(
        `[worker] scheduler tick failed: ${schedulerErrorMessage(error)}`
      )
    })
    .finally(() => {
      schedulerTickPromise = undefined
    })

  return schedulerTickPromise
}

function failedSystemHealthResult(): SystemHealthResult {
  const topology = getRuntimeTopology()

  return {
    checks: {
      chatGateway: topology.chatEnabled ? "failed" : "disabled",
      database: "failed",
      durableRedis: "failed",
      ephemeralRedis: "failed",
      maintenance: "failed",
      maintenanceResponsibilities: {
        "feed-scheduling": "failed",
        "podcast-scheduling": "failed",
      },
      queues: "failed",
      workers: Object.fromEntries(
        topology.workerModes.map((mode) => [mode, "failed" as const])
      ),
    },
    sourceReliability: unavailableSourceRefreshReliability(),
    status: "degraded",
  }
}

function runHealthSnapshot() {
  if (
    healthSnapshotPromise ||
    !healthSnapshotLock ||
    !healthSnapshotSchedule.isDue(Date.now())
  ) {
    return healthSnapshotPromise
  }

  const topology = getRuntimeTopology()
  healthSnapshotPromise = healthSnapshotLock
    .run(async (lease) => {
      const startedAt = Date.now()
      let checkFailed = false
      const result = await checkSystemHealth().catch(() => {
        checkFailed = true
        return failedSystemHealthResult()
      })

      lease.assertHeld()
      const snapshot = await writeHealthSnapshot({
        checkedAt: Date.now(),
        result,
        store: durableHeartbeatStore,
        topology: topology.name,
      })
      lease.assertHeld()
      await writeDurableResponsibilityTick({
        client: durableHeartbeatStore,
        instanceId: heartbeatInstanceId,
        responsibility: "health-snapshot",
        timestamp: Date.now(),
        ttlMs: maintenanceTickMaxAgeMs({
          FEED_SCHEDULER_INTERVAL_MS: String(HEALTH_SNAPSHOT_INTERVAL_MS),
        }),
        version: heartbeatVersion,
      })
      lease.assertHeld()

      if (checkFailed) {
        healthSnapshotSchedule.recordFailure(Date.now())
      } else {
        healthSnapshotSchedule.recordSuccess(Date.now())
      }

      console.info(
        JSON.stringify({
          checkFailed,
          durationMs: Math.max(0, Date.now() - startedAt),
          event: "health_snapshot",
          outcome: checkFailed ? "failure" : "success",
          ...maintenanceScheduleMetrics(healthSnapshotSchedule),
          status: snapshot.status,
          topology: snapshot.topology,
        })
      )
    })
    .then((leaseResult) => {
      if (!leaseResult.acquired) {
        console.warn(
          JSON.stringify({
            event: "health_snapshot",
            outcome: "lease_unavailable",
          })
        )
      }
    })
    .catch((error) => {
      healthSnapshotSchedule.recordFailure(Date.now())
      console.error(
        JSON.stringify({
          event: "health_snapshot",
          ...maintenanceScheduleMetrics(healthSnapshotSchedule),
          outcome: "failure",
          reason: schedulerErrorMessage(error),
        })
      )
    })
    .finally(() => {
      healthSnapshotPromise = undefined
    })

  return healthSnapshotPromise
}

async function runChatRetention(lease?: MaintenanceLease) {
  if (!chatRetentionMaintenanceSchedule.isDue(Date.now())) {
    return
  }

  try {
    if (!getChatFeatureFlags().enabled) {
      return
    }

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
      chatRetentionMaintenanceSchedule.recordSuccess(Date.now())
    } else {
      chatRetentionMaintenanceSchedule.recordDeferred(Date.now())
    }

    console.log(
      JSON.stringify({
        event: "chat_retention",
        ...result,
        outcome: result.skipped ? "skipped" : "success",
        ...maintenanceScheduleMetrics(chatRetentionMaintenanceSchedule),
      })
    )

    return result
  } catch (error) {
    chatRetentionMaintenanceSchedule.recordFailure(Date.now())
    throw error
  }
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
      rule: {
        user: {
          disabledAt: null,
        },
      },
    },
  })

  for (const run of runs) {
    lease?.assertHeld()
    await enqueueSmartDigestEmail(run.id)
  }

  return { enqueued: runs.length }
}

async function runAuthTokenMaintenance() {
  if (!authTokenMaintenanceSchedule.isDue(Date.now())) {
    return
  }

  try {
    const result = await cleanupExpiredAuthTokens({
      batchSize: authTokenMaintenanceBatchSize,
      store: prisma,
    })
    const deleted =
      result.passwordResetTokensDeleted +
      result.emailVerificationTokensDeleted +
      result.accountDeletionConfirmationTokensDeleted +
      result.authorizationCodesDeleted +
      result.authorizationRequestsDeleted +
      result.expiredSessionsDeleted +
      result.expiredMutationReceiptsDeleted

    authTokenMaintenanceSchedule.recordSuccess(Date.now())
    console.log(
      JSON.stringify({
        accountDeletionConfirmationTokensDeleted:
          result.accountDeletionConfirmationTokensDeleted,
        authorizationCodesDeleted: result.authorizationCodesDeleted,
        authorizationRequestsDeleted: result.authorizationRequestsDeleted,
        emailVerificationTokensDeleted: result.emailVerificationTokensDeleted,
        event: "auth_token_maintenance",
        expiredMutationReceiptsDeleted: result.expiredMutationReceiptsDeleted,
        expiredSessionsDeleted: result.expiredSessionsDeleted,
        outcome: "success",
        passwordResetTokensDeleted: result.passwordResetTokensDeleted,
        totalDeleted: deleted,
        ...maintenanceScheduleMetrics(authTokenMaintenanceSchedule),
      })
    )

    return result
  } catch (error) {
    authTokenMaintenanceSchedule.recordFailure(Date.now())
    throw error
  }
}

async function runSecurityEventMaintenance() {
  if (!securityEventMaintenanceSchedule.isDue(Date.now())) {
    return
  }

  try {
    const result = await cleanupExpiredSecurityEvents({
      batchSize: securityEventMaintenanceBatchSize,
      store: prisma,
    })
    securityEventMaintenanceSchedule.recordSuccess(Date.now())
    console.log(
      JSON.stringify({
        event: "security_event_maintenance",
        outcome: "success",
        ...result,
        ...maintenanceScheduleMetrics(securityEventMaintenanceSchedule),
      })
    )

    return result
  } catch (error) {
    securityEventMaintenanceSchedule.recordFailure(Date.now())
    throw error
  }
}

async function runMobileSyncRetention() {
  if (!mobileSyncRetentionSchedule.isDue(Date.now())) {
    return
  }

  try {
    const result = await pruneMobileSyncEvents({
      batchSize: mobileSyncRetentionSettings.batchSize,
      store: prisma as MobileSyncRetentionStore,
    })
    mobileSyncRetentionSchedule.recordSuccess(Date.now())
    recordMobileJournalRetention(result)
    console.log(
      JSON.stringify({
        event: "mobile_sync_retention",
        outcome: "success",
        ...result,
        ...maintenanceScheduleMetrics(mobileSyncRetentionSchedule),
      })
    )

    return result
  } catch (error) {
    mobileSyncRetentionSchedule.recordFailure(Date.now())
    throw error
  }
}

async function runAiOperationReconciliation(lease?: MaintenanceLease) {
  if (!aiOperationReconciliationSchedule.isDue(Date.now())) {
    return
  }

  try {
    const result = await reconcileExpiredAiUsageOperations({
      assertLeaseHeld: lease?.assertHeld,
      batchSize: schedulerBatchSize,
      store: prisma as unknown as Parameters<
        typeof reconcileExpiredAiUsageOperations
      >[0]["store"],
    })
    aiOperationReconciliationSchedule.recordSuccess(Date.now())
    console.log(
      JSON.stringify({
        event: "ai_operation_reconciliation",
        outcome: "success",
        ...result,
        ...maintenanceScheduleMetrics(aiOperationReconciliationSchedule),
      })
    )

    return result
  } catch (error) {
    aiOperationReconciliationSchedule.recordFailure(Date.now())
    throw error
  }
}

async function runSavedMonitors(lease?: MaintenanceLease) {
  if (!savedMonitorMaintenanceSchedule.isDue(Date.now())) {
    return
  }

  try {
    const result = await processDueSavedMonitors({
      assertLeaseHeld: lease?.assertHeld,
      settings: savedMonitorSchedulerSettings,
      store: prisma as unknown as Parameters<
        typeof processDueSavedMonitors
      >[0]["store"],
    })
    if (result.failed) {
      savedMonitorMaintenanceSchedule.recordFailure(Date.now())
      console.error(
        JSON.stringify({
          event: "saved_monitor_scheduler",
          outcome: "partial_failure",
          ...result,
          ...maintenanceScheduleMetrics(savedMonitorMaintenanceSchedule),
        })
      )
    } else {
      savedMonitorMaintenanceSchedule.recordSuccess(Date.now())
      console.log(
        JSON.stringify({
          event: "saved_monitor_scheduler",
          outcome: "success",
          ...result,
          ...maintenanceScheduleMetrics(savedMonitorMaintenanceSchedule),
        })
      )
    }

    return result
  } catch (error) {
    savedMonitorMaintenanceSchedule.recordFailure(Date.now())
    throw error
  }
}

async function runSourceOrphanReporting(lease?: MaintenanceLease) {
  if (!sourceOrphanReportSchedule.isDue(Date.now())) {
    return
  }

  try {
    lease?.assertHeld()
    const report = await reportSourceOrphanRetention({ store: prisma })
    lease?.assertHeld()
    sourceOrphanReportSchedule.recordSuccess(Date.now())
    console.info(
      JSON.stringify({
        event: "source_orphan_retention_report",
        outcome: "success",
        ...report,
        ...maintenanceScheduleMetrics(sourceOrphanReportSchedule),
      })
    )

    return report
  } catch (error) {
    sourceOrphanReportSchedule.recordFailure(Date.now())
    throw error
  }
}

function runOrphanReportingTick() {
  if (
    orphanReportingPromise ||
    !orphanReportingLock ||
    !sourceOrphanReportSchedule.isDue(Date.now())
  ) {
    return orphanReportingPromise
  }

  orphanReportingPromise = orphanReportingLock
    .run((lease) => runSourceOrphanReporting(lease))
    .then(async (result) => {
      if (!result.acquired) {
        console.warn(
          JSON.stringify({
            event: "source_orphan_retention_report",
            outcome: "lease_unavailable",
          })
        )
        return
      }

      if (result.value === undefined) {
        return
      }

      await writeDurableResponsibilityTick({
        client: durableHeartbeatStore,
        instanceId: heartbeatInstanceId,
        responsibility: "orphan-reporting",
        timestamp: Date.now(),
        ttlMs: maintenanceTickMaxAgeMs({
          FEED_SCHEDULER_INTERVAL_MS: String(SOURCE_ORPHAN_REPORT_INTERVAL_MS),
        }),
        version: heartbeatVersion,
      })
    })
    .catch((error) => {
      console.error(
        JSON.stringify({
          event: "source_orphan_retention_report",
          ...maintenanceScheduleMetrics(sourceOrphanReportSchedule),
          outcome: "failure",
          reason: schedulerErrorMessage(error),
        })
      )
    })
    .finally(() => {
      orphanReportingPromise = undefined
    })

  return orphanReportingPromise
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
const orphanReportingPublisher = runsWorkerResponsibility(
  workerMode,
  "maintenance"
)
  ? setInterval(() => {
      void runOrphanReportingTick()
    }, SOURCE_ORPHAN_REPORT_POLL_INTERVAL_MS)
  : undefined
const chatOutboxPublisher = runsWorkerResponsibility(workerMode, "chat-events")
  ? setInterval(() => {
      void publishPendingChatEvents()
    }, chatEventOutboxIntervalMs)
  : undefined
const healthSnapshotPublisher = runsHealthSnapshotProducer
  ? setInterval(() => {
      void runHealthSnapshot()
    }, HEALTH_SNAPSHOT_INTERVAL_MS)
  : undefined

const heartbeat = startWorkerHeartbeat({
  instanceId: heartbeatInstanceId,
  intervalMs: WORKER_HEARTBEAT_INTERVAL_MS,
  isControlPlaneReady: durableHeartbeatControl.isReady,
  mode: workerMode,
  path: heartbeatPath,
  store: durableHeartbeatStore,
  version: heartbeatVersion,
})
const memoryTelemetry = setInterval(
  () => logWorkerMemory({ trigger: "interval" }),
  WORKER_MEMORY_LOG_INTERVAL_MS
)

if (scheduler) {
  void runSchedulerTick()
}
if (chatOutboxPublisher) {
  void publishPendingChatEvents()
}
if (healthSnapshotPublisher) {
  setTimeout(() => {
    void runHealthSnapshot()
  }, HEALTH_SNAPSHOT_INITIAL_DELAY_MS)
}
if (orphanReportingPublisher) {
  setTimeout(() => {
    void runOrphanReportingTick()
  }, HEALTH_SNAPSHOT_INITIAL_DELAY_MS)
}

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
          healthSnapshotLock?.close() ?? Promise.resolve(),
          orphanReportingLock?.close() ?? Promise.resolve(),
          durableHeartbeatControl.close(),
        ])
        await clearWorkerHeartbeat({ path: heartbeatPath }).catch((error) => {
          console.error(
            `[worker] could not clear health heartbeat: ${schedulerErrorMessage(error)}`
          )
        })
      },
      disconnectDatabase: () => prisma.$disconnect(),
      getPendingWork: () =>
        [
          schedulerTickPromise,
          chatOutboxPublishPromise,
          healthSnapshotPromise,
          orphanReportingPromise,
        ].filter((work): work is Promise<void> => Boolean(work)),
      stopScheduling: () => {
        if (scheduler) {
          clearInterval(scheduler)
        }
        if (chatOutboxPublisher) {
          clearInterval(chatOutboxPublisher)
        }
        if (healthSnapshotPublisher) {
          clearInterval(healthSnapshotPublisher)
        }
        if (orphanReportingPublisher) {
          clearInterval(orphanReportingPublisher)
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

installWorkerSignalHandlers({
  exit: (code) => process.exit(code),
  onError: (error) => console.error(error),
  shutdown,
})

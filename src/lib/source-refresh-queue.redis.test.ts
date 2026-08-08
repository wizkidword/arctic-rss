import { Queue, type QueueOptions, Worker } from "bullmq"
import { afterEach, describe, expect, it, vi } from "vitest"

const redisUrl = process.env.ARCTIC_RSS_TEST_REDIS_URL ?? ""
const redisDescribe = redisUrl ? describe : describe.skip

type SourceKind = "feed" | "podcast"

type SourceQueueSubject = {
  close(): Promise<void>
  enqueue(sourceId: string, options?: Record<string, unknown>): Promise<{ id?: string }>
  name: string
  sourceKey: "feedId" | "podcastId"
}

redisDescribe("source refresh queues with real Redis", () => {
  let priorDurableRedisUrl: string | undefined

  afterEach(async () => {
    if (priorDurableRedisUrl === undefined) {
      delete process.env.DURABLE_REDIS_URL
    } else {
      process.env.DURABLE_REDIS_URL = priorDurableRedisUrl
    }
    vi.resetModules()
  })

  it.each<SourceKind>(["feed", "podcast"])(
    "removes a terminal %s refresh before re-enqueueing and still deduplicates active work",
    async (kind) => {
      priorDurableRedisUrl = process.env.DURABLE_REDIS_URL
      process.env.DURABLE_REDIS_URL = redisUrl
      const subject = await loadSourceQueueSubject(kind)
      const connection: QueueOptions["connection"] = {
        maxRetriesPerRequest: null,
        url: redisUrl,
      }
      const inspector = new Queue(subject.name, { connection })
      const failedSourceId = `${kind}-failed`
      const concurrentSourceId = `${kind}-concurrent`
      let failureWorker: Worker<Record<string, string>, void> | undefined
      let restartedWorker: Worker<Record<string, string>, void> | undefined

      try {
        await inspector.obliterate({ force: true })
        const failingWorker = new Worker<Record<string, string>, void>(
          subject.name,
          async (): Promise<void> => {
            throw new Error("expected terminal source refresh failure")
          },
          { connection }
        )
        failureWorker = failingWorker
        await failingWorker.waitUntilReady()

        const failed = await subject.enqueue(failedSourceId, {
          attempts: 1,
          backoff: { delay: 1, type: "fixed" },
        })
        const failedJobId = requiredJobId(failed)
        await waitForWorkerEvent(failingWorker, "failed", failedJobId)

        expect(await inspector.getJob(failedJobId)).toBeUndefined()
        await failingWorker.close()
        failureWorker = undefined

        let concurrentStarted: (() => void) | undefined
        const concurrentActive = new Promise<void>((resolve) => {
          concurrentStarted = resolve
        })
        let releaseConcurrent: (() => void) | undefined
        const concurrentRelease = new Promise<void>((resolve) => {
          releaseConcurrent = resolve
        })
        let concurrentProcessed = 0
        const restarted = new Worker<Record<string, string>, void>(
          subject.name,
          async (job) => {
            if (job.data[subject.sourceKey] === concurrentSourceId) {
              concurrentProcessed += 1
              concurrentStarted?.()
              await concurrentRelease
            }
          },
          { connection }
        )
        restartedWorker = restarted
        await restarted.waitUntilReady()

        const reenqueueCompleted = waitForWorkerEvent(
          restarted,
          "completed",
          failedJobId
        )
        const requeued = await subject.enqueue(failedSourceId)
        expect(requiredJobId(requeued)).toBe(failedJobId)
        await reenqueueCompleted
        expect(await inspector.getJob(failedJobId)).toBeUndefined()

        const [firstConcurrentJob, secondConcurrentJob] = await Promise.all([
          subject.enqueue(concurrentSourceId),
          subject.enqueue(concurrentSourceId),
        ])
        expect(requiredJobId(firstConcurrentJob)).toBe(
          requiredJobId(secondConcurrentJob)
        )
        await concurrentActive
        const counts = await inspector.getJobCounts("active", "waiting")
        expect((counts.active ?? 0) + (counts.waiting ?? 0)).toBe(1)

        const concurrentCompleted = waitForWorkerEvent(
          restarted,
          "completed",
          requiredJobId(firstConcurrentJob)
        )
        releaseConcurrent?.()
        await concurrentCompleted
        expect(concurrentProcessed).toBe(1)
      } finally {
        await Promise.allSettled([
          failureWorker?.close() ?? Promise.resolve(),
          restartedWorker?.close() ?? Promise.resolve(),
          inspector.obliterate({ force: true }),
          inspector.close(),
          subject.close(),
        ])
      }
    }
  )
})

async function loadSourceQueueSubject(kind: SourceKind): Promise<SourceQueueSubject> {
  if (kind === "feed") {
    const queue = await import("./feed-refresh-queue")
    return {
      close: queue.closeFeedRefreshQueue,
      enqueue: (sourceId, options) => queue.enqueueFeedRefresh(sourceId, options),
      name: queue.FEED_REFRESH_QUEUE_NAME,
      sourceKey: "feedId",
    }
  }

  const queue = await import("./podcast-refresh-queue")
  return {
    close: queue.closePodcastRefreshQueue,
    enqueue: (sourceId, options) => queue.enqueuePodcastRefresh(sourceId, options),
    name: queue.PODCAST_REFRESH_QUEUE_NAME,
    sourceKey: "podcastId",
  }
}

function requiredJobId(job: { id?: string }) {
  if (!job.id) {
    throw new Error("Expected BullMQ to return a job ID.")
  }

  return job.id
}

function waitForWorkerEvent<Data, Result>(
  worker: Worker<Data, Result>,
  event: "completed" | "failed",
  jobId: string
) {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for ${event} on ${jobId}.`))
    }, 10_000)
    const onMatchingJob = (job: { id?: string } | undefined) => {
      if (job?.id !== jobId) {
        return
      }

      clearTimeout(timeout)
      resolve()
    }
    if (event === "completed") {
      worker.on("completed", onMatchingJob)
    } else {
      worker.on("failed", onMatchingJob)
    }
  })
}

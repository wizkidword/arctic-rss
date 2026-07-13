import { type Prisma } from "../generated/prisma/client"
import {
  articleReadScopeWhere,
  type ArticleReadScope,
} from "./articles"
import {
  ARTICLE_READ_BATCH_SIZE,
  writeArticleReadStateBatches,
} from "./article-read-batch"
import { enqueueBulkReadJob } from "./bulk-read-queue"
import { getPrisma } from "./db"

export const BULK_READ_SYNC_ARTICLE_LIMIT = 500

export type BulkReadJobStatus =
  | "CANCELED"
  | "COMPLETED"
  | "FAILED"
  | "PROCESSING"
  | "QUEUED"

export type BulkReadJobProgress = {
  id: string
  markedArticles: number
  processedArticles: number
  status: BulkReadJobStatus
  totalArticles: number
}

type BulkReadJobRecord = BulkReadJobProgress & {
  feedId: string | null
  folderId: string | null
  lastArticleId: string | null
  scopeType: string
  userId: string
}

type BulkReadJobStore = {
  article: {
    count(args: { where: Prisma.ArticleWhereInput }): Promise<number>
    findMany(args: {
      select: { id: true }
      where: Prisma.ArticleWhereInput
      orderBy?: { id: "asc" }
      take?: number
    }): Promise<Array<{ id: string }>>
  }
  articleState: {
    createMany(args: {
      data: Array<{
        articleId: string
        isRead: boolean
        readAt: Date
        userId: string
      }>
      skipDuplicates: true
    }): Promise<{ count: number }>
    updateMany(args: {
      data: { isRead: boolean; readAt: Date }
      where: { articleId: { in: string[] }; userId: string }
    }): Promise<{ count: number }>
  }
  bulkReadJob: {
    create(args: {
      data: {
        feedId?: string
        folderId?: string
        scopeType: string
        totalArticles: number
        userId: string
      }
      select: { id: true }
    }): Promise<{ id: string }>
    findFirst(args: Record<string, unknown>): Promise<{ id: string } | null>
    findUnique(args: Record<string, unknown>): Promise<BulkReadJobRecord | null>
    update(args: Record<string, unknown>): Promise<unknown>
    updateMany(args: Record<string, unknown>): Promise<{ count: number }>
  }
}

export type StartBulkReadResult =
  | { markedCount: number; status: "completed" }
  | { jobId: string; status: "queued"; totalArticles: number }

export class BulkReadJobError extends Error {
  constructor(message: string) {
    super(message)
  }
}

/**
 * Keeps normal-sized requests immediate while moving large libraries to the
 * worker. The worker persists its cursor after each bounded batch, so retrying
 * a job is safe after a restart or transient database failure.
 */
export async function startBulkRead({
  enqueue = enqueueBulkReadJob,
  scope,
  store = getBulkReadJobStore(),
  userId,
}: {
  enqueue?: (jobId: string) => Promise<unknown>
  scope: ArticleReadScope
  store?: BulkReadJobStore
  userId: string
}): Promise<StartBulkReadResult> {
  const totalArticles = await store.article.count({
    where: articleReadScopeWhere(userId, scope),
  })

  if (totalArticles <= BULK_READ_SYNC_ARTICLE_LIMIT) {
    const articles = await store.article.findMany({
      select: { id: true },
      where: articleReadScopeWhere(userId, scope),
    })
    const result = await writeArticleReadStateBatches({
      articleIds: articles.map((article) => article.id),
      readAt: new Date(),
      store,
      userId,
    })

    return {
      markedCount: result.markedCount,
      status: "completed",
    }
  }

  const existing = await store.bulkReadJob.findFirst({
    orderBy: { createdAt: "desc" },
    select: { id: true },
    where: {
      ...bulkReadScopeWhere(scope),
      status: {
        in: ["QUEUED", "PROCESSING"],
      },
      userId,
    },
  })

  if (existing) {
    return {
      jobId: existing.id,
      status: "queued",
      totalArticles,
    }
  }

  const job = await store.bulkReadJob.create({
    data: {
      ...bulkReadScopeData(scope),
      totalArticles,
      userId,
    },
    select: { id: true },
  })

  try {
    await enqueue(job.id)
  } catch {
    await store.bulkReadJob.update({
      data: {
        errorMessage: "The background worker could not be reached. Please try again.",
        status: "FAILED",
      },
      where: { id: job.id },
    })
    throw new BulkReadJobError("Arctic RSS could not start that background job.")
  }

  return {
    jobId: job.id,
    status: "queued",
    totalArticles,
  }
}

export async function processBulkReadJob({
  jobId,
  now = () => new Date(),
  onProgress,
  store = getBulkReadJobStore(),
}: {
  jobId: string
  now?: () => Date
  onProgress?: (progress: number) => Promise<unknown> | unknown
  store?: BulkReadJobStore
}) {
  let job = await findBulkReadJob(store, jobId)

  if (!job || isTerminal(job.status)) {
    return { status: job?.status ?? "missing" }
  }

  const scope = readScopeFromJob(job)
  await store.bulkReadJob.update({
    data: {
      startedAt: now(),
      status: "PROCESSING",
    },
    where: { id: job.id },
  })

  while (true) {
    job = await findBulkReadJob(store, jobId)

    if (!job || job.status === "CANCELED") {
      return { status: job?.status ?? "missing" }
    }

    const articles = await store.article.findMany({
      orderBy: { id: "asc" },
      select: { id: true },
      take: ARTICLE_READ_BATCH_SIZE,
      where: {
        AND: [
          articleReadScopeWhere(job.userId, scope),
          ...(job.lastArticleId
            ? [
                {
                  id: {
                    gt: job.lastArticleId,
                  },
                },
              ]
            : []),
        ],
      },
    })

    if (articles.length === 0) {
      await store.bulkReadJob.update({
        data: {
          completedAt: now(),
          status: "COMPLETED",
        },
        where: { id: job.id },
      })
      await onProgress?.(100)

      return {
        markedArticles: job.markedArticles,
        processedArticles: job.processedArticles,
        status: "COMPLETED",
      }
    }

    const readAt = now()
    await writeArticleReadStateBatches({
      articleIds: articles.map((article) => article.id),
      readAt,
      store,
      userId: job.userId,
    })

    const processedArticles = Math.min(
      job.totalArticles,
      job.processedArticles + articles.length
    )
    const markedArticles = Math.min(
      processedArticles,
      job.markedArticles + articles.length
    )
    await store.bulkReadJob.update({
      data: {
        lastArticleId: articles.at(-1)?.id,
        markedArticles,
        processedArticles,
        status: "PROCESSING",
      },
      where: { id: job.id },
    })
    await onProgress?.(progressPercent(processedArticles, job.totalArticles))
  }
}

export async function cancelBulkReadJob({
  jobId,
  store = getBulkReadJobStore(),
  userId,
}: {
  jobId: string
  store?: BulkReadJobStore
  userId: string
}) {
  const result = await store.bulkReadJob.updateMany({
    data: {
      canceledAt: new Date(),
      status: "CANCELED",
    },
    where: {
      id: jobId,
      status: {
        in: ["QUEUED", "PROCESSING"],
      },
      userId,
    },
  })

  return result.count === 1
}

export async function getCurrentBulkReadJobForUser(
  userId: string,
  store = getBulkReadJobStore()
): Promise<BulkReadJobProgress | null> {
  return store.bulkReadJob.findFirst({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      markedArticles: true,
      processedArticles: true,
      status: true,
      totalArticles: true,
    },
    where: {
      status: {
        in: ["QUEUED", "PROCESSING"],
      },
      userId,
    },
  }) as Promise<BulkReadJobProgress | null>
}

export async function failBulkReadJob({
  error,
  jobId,
  store = getBulkReadJobStore(),
}: {
  error: unknown
  jobId: string
  store?: BulkReadJobStore
}) {
  await store.bulkReadJob.updateMany({
    data: {
      errorMessage: errorMessage(error),
      status: "FAILED",
    },
    where: {
      id: jobId,
      status: {
        in: ["QUEUED", "PROCESSING"],
      },
    },
  })
}

function bulkReadScopeData(scope: ArticleReadScope) {
  if (scope.type === "feed") {
    return {
      feedId: scope.feedId,
      scopeType: scope.type,
    }
  }

  if (scope.type === "folder") {
    return {
      folderId: scope.folderId,
      scopeType: scope.type,
    }
  }

  return { scopeType: scope.type }
}

function bulkReadScopeWhere(scope: ArticleReadScope) {
  if (scope.type === "feed") {
    return {
      feedId: scope.feedId,
      folderId: null,
      scopeType: scope.type,
    }
  }

  if (scope.type === "folder") {
    return {
      feedId: null,
      folderId: scope.folderId,
      scopeType: scope.type,
    }
  }

  return {
    feedId: null,
    folderId: null,
    scopeType: scope.type,
  }
}

function readScopeFromJob(job: BulkReadJobRecord): ArticleReadScope {
  if (job.scopeType === "feed" && job.feedId) {
    return { feedId: job.feedId, type: "feed" }
  }

  if (job.scopeType === "folder" && job.folderId) {
    return { folderId: job.folderId, type: "folder" }
  }

  return { type: "all" }
}

async function findBulkReadJob(store: BulkReadJobStore, jobId: string) {
  return store.bulkReadJob.findUnique({
    select: {
      feedId: true,
      folderId: true,
      id: true,
      lastArticleId: true,
      markedArticles: true,
      processedArticles: true,
      scopeType: true,
      status: true,
      totalArticles: true,
      userId: true,
    },
    where: { id: jobId },
  })
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown background job failure."
}

function isTerminal(status: BulkReadJobStatus) {
  return status === "CANCELED" || status === "COMPLETED" || status === "FAILED"
}

function progressPercent(processedArticles: number, totalArticles: number) {
  if (totalArticles === 0) {
    return 100
  }

  return Math.min(100, Math.round((processedArticles / totalArticles) * 100))
}

function getBulkReadJobStore() {
  return getPrisma() as unknown as BulkReadJobStore
}

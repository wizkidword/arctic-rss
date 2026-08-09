import { getPrisma } from "./db"
import { getBackgroundEligibility } from "./background-eligibility"
import { enqueueFeedRefresh } from "./feed-refresh-queue"
import {
  FeedSubscriptionError,
  subscribeToFeed,
} from "./feed-subscriptions"
import {
  claimOpmlImportEntry,
  finalizeOpmlImportEntry,
  runWithOpmlImportEntryLeaseHeartbeat,
} from "./opml-import-leases"
import { enqueueOpmlImportJob } from "./opml-import-queue"
import { parseOpmlSubscriptions } from "./opml"

export const OPML_IMPORT_BATCH_SIZE = 20
export const OPML_IMPORT_BATCH_DEADLINE_MS = 2 * 60 * 1_000
export const OPML_IMPORT_OPERATION_DEADLINE_MS = 10 * 60 * 1_000

export type OpmlImportJobListItem = {
  addedFeeds: number
  cancelRequested: boolean
  createdAt: Date
  failedFeeds: number
  folderCount: number
  id: string
  lastError: string | null
  processedFeeds: number
  skippedFeeds: number
  status: "CANCELED" | "COMPLETED" | "FAILED" | "PENDING" | "PROCESSING"
  totalFeeds: number
}

export class OpmlImportJobError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "OpmlImportJobError"
  }
}

export async function createOpmlImportJob({
  opmlXml,
  userId,
}: {
  opmlXml: string
  userId: string
}) {
  const entries = parseOpmlSubscriptions(opmlXml)
  const prisma = getPrisma()
  const folderCount = new Set(
    entries.flatMap((entry) => (entry.folderName ? [entry.folderName] : []))
  ).size
  let job: { id: string }

  try {
    job = await prisma.$transaction(async (transaction) => {
      const createdJob = await transaction.importJob.create({
        data: {
          folderCount,
          status: "PENDING",
          totalFeeds: entries.length,
          userId,
        },
        select: { id: true },
      })

      await transaction.importJobEntry.createMany({
        data: entries.map((entry, sequence) => ({
          folderName: entry.folderName,
          importJobId: createdJob.id,
          sequence,
          title: entry.title,
          xmlUrl: entry.xmlUrl,
        })),
      })

      return createdJob
    })
  } catch (error) {
    if (isActiveOpmlImportConflict(error)) {
      throw activeOpmlImportError()
    }
    throw error
  }

  try {
    await enqueueOpmlImportJob(job.id)
  } catch {
    await prisma.importJob.update({
      data: {
        completedAt: new Date(),
        lastError:
          "The background worker could not be reached. Retry this import after it is available.",
        status: "FAILED",
      },
      where: { id: job.id },
    })
    throw new OpmlImportJobError("Arctic RSS could not start that import.")
  }

  return {
    jobId: job.id,
    totalFeeds: entries.length,
  }
}

export async function processOpmlImportJob({
  jobId,
  now = () => new Date(),
}: {
  jobId: string
  now?: () => Date
}) {
  const prisma = getPrisma()
  let job = await prisma.importJob.findUnique({
    select: {
      cancelRequestedAt: true,
      id: true,
      startedAt: true,
      status: true,
      userId: true,
    },
    where: { id: jobId },
  })

  if (!job || isTerminalStatus(job.status)) {
    return { status: job?.status ?? "missing" }
  }

  if (job.cancelRequestedAt) {
    await markOpmlImportCanceled(job.id, now())
    return { status: "CANCELED" as const }
  }

  if (
    !(await getBackgroundEligibility({
      store: prisma,
      userId: job.userId,
    })).active
  ) {
    await markOpmlImportCanceled(job.id, now())
    return { status: "CANCELED" as const }
  }

  const startedAt = job.startedAt ?? now()

  if (now().getTime() - startedAt.getTime() >= OPML_IMPORT_OPERATION_DEADLINE_MS) {
    await markOpmlImportFailed({
      jobId: job.id,
      message:
        "This import exceeded its 10-minute processing limit. Retry it to continue from the saved checkpoint.",
      now: now(),
    })
    return { status: "FAILED" as const }
  }

  await prisma.importJob.update({
    data: {
      startedAt,
      status: "PROCESSING",
    },
    where: { id: job.id },
  })

  const batchDeadline = Date.now() + OPML_IMPORT_BATCH_DEADLINE_MS
  const folderIdsByName = new Map<string, string>()

  for (let processedInBatch = 0; processedInBatch < OPML_IMPORT_BATCH_SIZE; processedInBatch += 1) {
    job = await prisma.importJob.findUnique({
      select: {
        cancelRequestedAt: true,
        id: true,
        startedAt: true,
        status: true,
        userId: true,
      },
      where: { id: job.id },
    })

    if (!job || job.cancelRequestedAt || job.status === "CANCELED") {
      if (job) {
        await markOpmlImportCanceled(job.id, now())
      }
      return { status: job ? ("CANCELED" as const) : "missing" }
    }

    if (
      !(await getBackgroundEligibility({
        store: prisma,
        userId: job.userId,
      })).active
    ) {
      await markOpmlImportCanceled(job.id, now())
      return { status: "CANCELED" as const }
    }

    if (Date.now() >= batchDeadline) {
      return { status: "PROCESSING" as const }
    }

    const userId = job.userId
    const entry = await claimOpmlImportEntry({
      importJobId: job.id,
      now: now(),
      store: prisma,
    })

    if (!entry) {
      break
    }

    const processed = await runWithOpmlImportEntryLeaseHeartbeat({
      lease: entry,
      now,
      store: prisma,
      work: () =>
        importOpmlEntry({
          entry,
          folderIdsByName,
          userId,
        }),
    })

    if (!processed.leaseHeld) {
      return { status: "PROCESSING" as const }
    }

    const finalized = await finalizeOpmlImportEntry({
      errorMessage: processed.result.errorMessage,
      lease: entry,
      now: now(),
      status: processed.result.status,
      store: prisma,
    })

    if (!finalized) {
      return { status: "PROCESSING" as const }
    }
  }

  const pendingEntry = await prisma.importJobEntry.findFirst({
    select: { id: true },
    where: {
      importJobId: job.id,
      status: { in: ["PENDING", "PROCESSING"] },
    },
  })

  if (pendingEntry) {
    return { status: "PROCESSING" as const }
  }

  await completeOpmlImportJob(job.id, now())
  return { status: "COMPLETED" as const }
}

export async function failOpmlImportJob({
  error,
  jobId,
}: {
  error: unknown
  jobId: string
}) {
  await markOpmlImportFailed({
    jobId,
    message: errorMessage(error),
    now: new Date(),
  })
}

export async function cancelOpmlImportJob({
  jobId,
  userId,
}: {
  jobId: string
  userId: string
}) {
  const result = await getPrisma().importJob.updateMany({
    data: { cancelRequestedAt: new Date() },
    where: {
      id: jobId,
      status: { in: ["PENDING", "PROCESSING"] },
      userId,
    },
  })

  return result.count === 1
}

export async function retryOpmlImportJob({
  jobId,
  userId,
}: {
  jobId: string
  userId: string
}) {
  const prisma = getPrisma()
  const job = await prisma.importJob.findFirst({
    select: { id: true },
    where: {
      id: jobId,
      status: { in: ["CANCELED", "COMPLETED", "FAILED"] },
      userId,
    },
  })

  if (!job) {
    return false
  }

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.importJobEntry.updateMany({
        data: {
          errorMessage: null,
          leaseExpiresAt: null,
          leaseOwner: null,
          processedAt: null,
          processingStartedAt: null,
          status: "PENDING",
        },
        where: {
          importJobId: job.id,
          status: { in: ["FAILED", "PROCESSING"] },
        },
      })

      const [addedFeeds, skippedFeeds] = await Promise.all([
        transaction.importJobEntry.count({
          where: { importJobId: job.id, status: "ADDED" },
        }),
        transaction.importJobEntry.count({
          where: { importJobId: job.id, status: "SKIPPED" },
        }),
      ])

      await transaction.importJob.update({
        data: {
          addedFeeds,
          cancelRequestedAt: null,
          completedAt: null,
          failedFeeds: 0,
          lastError: null,
          processedFeeds: addedFeeds + skippedFeeds,
          skippedFeeds,
          startedAt: null,
          status: "PENDING",
        },
        where: { id: job.id },
      })
    })
  } catch (error) {
    if (isActiveOpmlImportConflict(error)) {
      throw activeOpmlImportError()
    }
    throw error
  }

  try {
    await enqueueOpmlImportJob(job.id)
  } catch {
    await markOpmlImportFailed({
      jobId: job.id,
      message:
        "The background worker could not be reached. Retry this import after it is available.",
      now: new Date(),
    })
    throw new OpmlImportJobError("Arctic RSS could not restart that import.")
  }

  return true
}

export async function listUserOpmlImportJobs(
  userId: string
): Promise<OpmlImportJobListItem[]> {
  const jobs = await getPrisma().importJob.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      addedFeeds: true,
      cancelRequestedAt: true,
      createdAt: true,
      failedFeeds: true,
      folderCount: true,
      id: true,
      lastError: true,
      processedFeeds: true,
      skippedFeeds: true,
      status: true,
      totalFeeds: true,
    },
    take: 5,
    where: { userId },
  })

  return jobs.map((job) => ({
    ...job,
    cancelRequested: Boolean(job.cancelRequestedAt),
  }))
}

async function importOpmlEntry({
  entry,
  folderIdsByName,
  userId,
}: {
  entry: {
    folderName: string | null
    id: string
    sequence: number
    title: string
    xmlUrl: string
  }
  folderIdsByName: Map<string, string>
  userId: string
}): Promise<{
  errorMessage: string | null
  status: "ADDED" | "FAILED" | "SKIPPED"
}> {
  try {
    const folderId = entry.folderName
      ? await getOrCreateImportFolderId({
          folderIdsByName,
          folderName: entry.folderName,
          userId,
        })
      : undefined
    const subscription = await subscribeToFeed({
      folderId,
      url: entry.xmlUrl,
      userId,
    })

    if (typeof subscription.initialArticleCount !== "number") {
      try {
        await enqueueFeedRefresh(subscription.feedId, { trigger: "opml-retry" })
      } catch {
        // The subscription is complete; the normal scheduler will retry later.
      }
    }
    return { errorMessage: null, status: "ADDED" }
  } catch (error) {
    if (isDuplicateSubscriptionError(error)) {
      return { errorMessage: null, status: "SKIPPED" }
    }

    return {
      errorMessage: errorMessage(error),
      status: "FAILED",
    }
  }
}

async function getOrCreateImportFolderId({
  folderIdsByName,
  folderName,
  userId,
}: {
  folderIdsByName: Map<string, string>
  folderName: string
  userId: string
}) {
  const cachedFolderId = folderIdsByName.get(folderName)

  if (cachedFolderId) {
    return cachedFolderId
  }

  const prisma = getPrisma()
  const existingFolder = await prisma.folder.findFirst({
    select: { id: true },
    where: {
      name: folderName,
      userId,
    },
  })

  if (existingFolder) {
    folderIdsByName.set(folderName, existingFolder.id)
    return existingFolder.id
  }

  const folder = await prisma.folder.create({
    data: {
      name: folderName,
      userId,
    },
    select: { id: true },
  })
  folderIdsByName.set(folderName, folder.id)
  return folder.id
}

async function completeOpmlImportJob(jobId: string, completedAt: Date) {
  await getPrisma().importJob.updateMany({
    data: {
      completedAt,
      status: "COMPLETED",
    },
    where: {
      id: jobId,
      cancelRequestedAt: null,
      entries: {
        none: {
          status: { in: ["PENDING", "PROCESSING"] },
        },
      },
      status: { in: ["PENDING", "PROCESSING"] },
    },
  })
}

async function markOpmlImportCanceled(jobId: string, completedAt: Date) {
  await getPrisma().importJob.updateMany({
    data: {
      completedAt,
      status: "CANCELED",
    },
    where: {
      id: jobId,
      status: { in: ["PENDING", "PROCESSING"] },
    },
  })
}

async function markOpmlImportFailed({
  jobId,
  message,
  now,
}: {
  jobId: string
  message: string
  now: Date
}) {
  await getPrisma().importJob.updateMany({
    data: {
      completedAt: now,
      lastError: message,
      status: "FAILED",
    },
    where: {
      id: jobId,
      status: { in: ["PENDING", "PROCESSING"] },
    },
  })
}

function isDuplicateSubscriptionError(error: unknown) {
  return (
    error instanceof FeedSubscriptionError &&
    error.message.toLowerCase().includes("already subscribed")
  )
}

function activeOpmlImportError() {
  return new OpmlImportJobError(
    "An OPML import is already running. Wait for it to finish or cancel it before starting another."
  )
}

function isActiveOpmlImportConflict(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  )
}

function isTerminalStatus(status: string) {
  return status === "CANCELED" || status === "COMPLETED" || status === "FAILED"
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message.slice(0, 500)
    : "OPML import failed for this feed."
}

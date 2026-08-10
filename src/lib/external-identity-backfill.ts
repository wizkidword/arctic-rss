import {
  countExternalIdentityHashCollisionCandidates,
  externalIdentityHash,
} from "./external-identity"

export const EXTERNAL_IDENTITY_BACKFILL_CONFIRMATION = "disposable"
export const EXTERNAL_IDENTITY_BACKFILL_BATCH_SIZE = 100

type BackfillScope = "article" | "podcastEpisode"

type BackfillRecord = {
  externalId: string
  externalIdHash: string | null
  feedId?: string
  id: string
  podcastId?: string
}

type BackfillProgress = {
  collisionCandidateCount: number
  cursorId: string | null
  processedCount: number
}

type BackfillModel = {
  findMany(args: Record<string, unknown>): Promise<BackfillRecord[]>
  updateMany(args: {
    data: { externalIdHash: string }
    where: { externalIdHash: null; id: string }
  }): Promise<{ count: number }>
}

type ExternalIdentityBackfillStore = {
  $transaction<T>(callback: (transaction: ExternalIdentityBackfillStore) => Promise<T>): Promise<T>
  article: BackfillModel
  externalIdentityHashBackfillProgress: {
    findUnique(args: { where: { scope: BackfillScope } }): Promise<BackfillProgress | null>
    upsert(args: {
      create: {
        collisionCandidateCount: number
        completedAt?: Date
        cursorId: string | null
        processedCount: number
        scope: BackfillScope
      }
      update: {
        collisionCandidateCount: number
        completedAt?: Date
        cursorId: string | null
        processedCount: number
      }
      where: { scope: BackfillScope }
    }): Promise<unknown>
  }
  podcastEpisode: BackfillModel
}

export type ExternalIdentityBackfillResult = {
  article: ScopeBackfillResult
  podcastEpisode: ScopeBackfillResult
}

type ScopeBackfillResult = {
  collisionCandidateCount: number
  completed: boolean
  processedCount: number
}

export async function backfillExternalIdentityHashes({
  batchSize = EXTERNAL_IDENTITY_BACKFILL_BATCH_SIZE,
  maxBatches = 1,
  now = () => new Date(),
  store,
}: {
  batchSize?: number
  maxBatches?: number
  now?: () => Date
  store: ExternalIdentityBackfillStore
}): Promise<ExternalIdentityBackfillResult> {
  const boundedBatchSize = Math.max(1, Math.min(1_000, Math.floor(batchSize)))
  const boundedMaxBatches = Math.max(1, Math.min(10_000, Math.floor(maxBatches)))

  return {
    article: await backfillScope({
      batchSize: boundedBatchSize,
      maxBatches: boundedMaxBatches,
      now,
      scope: "article",
      store,
    }),
    podcastEpisode: await backfillScope({
      batchSize: boundedBatchSize,
      maxBatches: boundedMaxBatches,
      now,
      scope: "podcastEpisode",
      store,
    }),
  }
}

export function assertExternalIdentityBackfillIsDisposable({
  confirmation,
  databaseUrl,
}: {
  confirmation: string | undefined
  databaseUrl: string | undefined
}) {
  if (confirmation !== EXTERNAL_IDENTITY_BACKFILL_CONFIRMATION) {
    throw new Error("External identity backfill requires disposable confirmation.")
  }

  if (!databaseUrl) {
    throw new Error("External identity backfill requires an explicit disposable database URL.")
  }

  let url: URL

  try {
    url = new URL(databaseUrl)
  } catch {
    throw new Error("External identity backfill database URL is invalid.")
  }

  if (!new Set(["127.0.0.1", "::1", "localhost"]).has(url.hostname)) {
    throw new Error("External identity backfill is limited to a loopback database.")
  }
}

async function backfillScope({
  batchSize,
  maxBatches,
  now,
  scope,
  store,
}: {
  batchSize: number
  maxBatches: number
  now: () => Date
  scope: BackfillScope
  store: ExternalIdentityBackfillStore
}): Promise<ScopeBackfillResult> {
  let collisionCandidateCount = 0
  let completed = false
  let processedCount = 0

  for (let batch = 0; batch < maxBatches && !completed; batch += 1) {
    const result = await store.$transaction((transaction) =>
      backfillScopeBatch({ batchSize, now, scope, store: transaction })
    )
    collisionCandidateCount += result.collisionCandidateCount
    processedCount += result.processedCount
    completed = result.completed
  }

  return { collisionCandidateCount, completed, processedCount }
}

async function backfillScopeBatch({
  batchSize,
  now,
  scope,
  store,
}: {
  batchSize: number
  now: () => Date
  scope: BackfillScope
  store: ExternalIdentityBackfillStore
}): Promise<ScopeBackfillResult> {
  const progress = await store.externalIdentityHashBackfillProgress.findUnique({
    where: { scope },
  })
  const model = scope === "article" ? store.article : store.podcastEpisode
  const sourceField = scope === "article" ? "feedId" : "podcastId"
  const records = await model.findMany({
    orderBy: { id: "asc" },
    select: {
      externalId: true,
      externalIdHash: true,
      [sourceField]: true,
      id: true,
    },
    take: batchSize,
    where: {
      externalIdHash: null,
      ...(progress?.cursorId ? { id: { gt: progress.cursorId } } : {}),
    },
  })

  if (!records.length) {
    await saveProgress({
      completed: true,
      collisionCandidateCount: progress?.collisionCandidateCount ?? 0,
      cursorId: progress?.cursorId ?? null,
      now: now(),
      processedCount: progress?.processedCount ?? 0,
      scope,
      store,
    })

    return { collisionCandidateCount: 0, completed: true, processedCount: 0 }
  }

  const hashesById = new Map(records.map((record) => [record.id, externalIdentityHash(record.externalId)]))
  await Promise.all(
    records.map((record) =>
      model.updateMany({
        data: { externalIdHash: hashesById.get(record.id)! },
        where: { externalIdHash: null, id: record.id },
      })
    )
  )

  const sourceIds = unique(records.map((record) => record[sourceField] as string | undefined))
  const hashes = unique([...hashesById.values()])
  const persisted = await model.findMany({
    select: {
      externalId: true,
      externalIdHash: true,
      [sourceField]: true,
      id: true,
    },
    where: {
      externalIdHash: { in: hashes },
      [sourceField]: { in: sourceIds },
    },
  })
  const collisionCandidateCount = countExternalIdentityHashCollisionCandidates(
    persisted.flatMap((record) => {
      const scopeId = record[sourceField]

      return typeof scopeId === "string" && record.externalIdHash
        ? [{ externalId: record.externalId, hash: record.externalIdHash, scopeId }]
        : []
    })
  )
  const cursorId = records.at(-1)?.id ?? progress?.cursorId ?? null

  await saveProgress({
    collisionCandidateCount: (progress?.collisionCandidateCount ?? 0) + collisionCandidateCount,
    cursorId,
    now: now(),
    processedCount: (progress?.processedCount ?? 0) + records.length,
    scope,
    store,
  })

  return { collisionCandidateCount, completed: false, processedCount: records.length }
}

async function saveProgress({
  completed,
  collisionCandidateCount,
  cursorId,
  now,
  processedCount,
  scope,
  store,
}: {
  completed?: boolean
  collisionCandidateCount: number
  cursorId: string | null
  now: Date
  processedCount: number
  scope: BackfillScope
  store: ExternalIdentityBackfillStore
}) {
  const data = {
    collisionCandidateCount,
    ...(completed ? { completedAt: now } : {}),
    cursorId,
    processedCount,
  }

  await store.externalIdentityHashBackfillProgress.upsert({
    create: { ...data, scope },
    update: data,
    where: { scope },
  })
}

function unique(values: Array<string | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

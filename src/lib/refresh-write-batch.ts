export const REFRESH_WRITE_BATCH_SIZE = 100

export type RefreshWriteStats = {
  changedCount: number
  duplicateInputCount: number
  insertedCount: number
  unchangedCount: number
}

type RefreshItem = {
  externalId: string
  ingestionFingerprint: string
  sourceGeneration?: number
}

type RefreshWriteBatchOptions<Item extends RefreshItem> = {
  batchSize?: number
  beforeWriteBatch?: () => Promise<void>
  createMany: (items: Item[]) => Promise<{ count: number }>
  findExistingItems: (externalIds: string[]) => Promise<
    Array<{
      externalId: string
      ingestionFingerprint: string | null
      sourceGeneration?: number | null
    }>
  >
  items: Item[]
  runUpdateBatch?: (operations: Array<Promise<unknown>>) => Promise<unknown>
  shouldUpdateExisting?: (
    existing: { ingestionFingerprint: string | null; sourceGeneration?: number | null },
    item: Item,
  ) => boolean
  update: (item: Item) => Promise<unknown>
}

/**
 * Writes parsed feed items in small, bounded database batches. New items use a
 * single createMany statement per batch. Existing items only update when their
 * mutable-source fingerprint differs; legacy rows without a fingerprint get a
 * single normal update to populate it. This avoids serial per-item upserts and
 * prevents identical refreshes from changing stored rows.
 */
export async function writeRefreshItems<Item extends RefreshItem>({
  batchSize = REFRESH_WRITE_BATCH_SIZE,
  beforeWriteBatch,
  createMany,
  findExistingItems,
  items,
  runUpdateBatch,
  shouldUpdateExisting,
  update,
}: RefreshWriteBatchOptions<Item>): Promise<RefreshWriteStats> {
  const uniqueItems = deduplicateByExternalId(items)

  if (uniqueItems.length === 0) {
    return {
      changedCount: 0,
      duplicateInputCount: items.length,
      insertedCount: 0,
      unchangedCount: 0,
    }
  }

  const existingByExternalId = new Map(
    (
      await findExistingItems(uniqueItems.map((item) => item.externalId))
    ).map((item) => [item.externalId, item])
  )
  const newItems = uniqueItems.filter(
    (item) => !existingByExternalId.has(item.externalId)
  )
  const changedItems = uniqueItems.filter((item) => {
    const existing = existingByExternalId.get(item.externalId)

    return (
      existing !== undefined &&
      (existing.ingestionFingerprint !== item.ingestionFingerprint ||
        Boolean(shouldUpdateExisting?.(existing, item)))
    )
  })
  const unchangedCount = uniqueItems.length - newItems.length - changedItems.length
  let insertedCount = 0

  for (const batch of chunk(newItems, batchSize)) {
    await beforeWriteBatch?.()
    const result = await createMany(batch)
    insertedCount += result.count
  }

  for (const batch of chunk(changedItems, batchSize)) {
    await beforeWriteBatch?.()
    const operations = batch.map((item) => update(item))

    if (runUpdateBatch) {
      await runUpdateBatch(operations)
    } else {
      await Promise.all(operations)
    }
  }

  return {
    changedCount: changedItems.length,
    duplicateInputCount: items.length - uniqueItems.length,
    insertedCount,
    unchangedCount,
  }
}

function deduplicateByExternalId<Item extends RefreshItem>(items: Item[]) {
  return [...new Map(items.map((item) => [item.externalId, item])).values()]
}

function chunk<Item>(items: Item[], size: number) {
  const chunks: Item[][] = []
  const boundedSize = Math.max(1, Math.floor(size))

  for (let index = 0; index < items.length; index += boundedSize) {
    chunks.push(items.slice(index, index + boundedSize))
  }

  return chunks
}

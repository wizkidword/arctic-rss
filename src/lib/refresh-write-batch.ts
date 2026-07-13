export const REFRESH_WRITE_BATCH_SIZE = 100

export type RefreshWriteStats = {
  insertedCount: number
  skippedCount: number
  updatedCount: number
}

type RefreshItem = {
  externalId: string
}

type RefreshWriteBatchOptions<Item extends RefreshItem> = {
  batchSize?: number
  createMany: (items: Item[]) => Promise<{ count: number }>
  findExistingExternalIds: (externalIds: string[]) => Promise<Array<{ externalId: string }>>
  items: Item[]
  runUpdateBatch?: (operations: Array<Promise<unknown>>) => Promise<unknown>
  update: (item: Item) => Promise<unknown>
}

/**
 * Writes parsed feed items in small, bounded database batches. New items use a
 * single createMany statement per batch; existing items retain their mutable
 * fields through a transaction batch. This avoids serial per-item upserts
 * while retaining the correction behavior of the former upsert path.
 */
export async function writeRefreshItems<Item extends RefreshItem>({
  batchSize = REFRESH_WRITE_BATCH_SIZE,
  createMany,
  findExistingExternalIds,
  items,
  runUpdateBatch,
  update,
}: RefreshWriteBatchOptions<Item>): Promise<RefreshWriteStats> {
  const uniqueItems = deduplicateByExternalId(items)

  if (uniqueItems.length === 0) {
    return {
      insertedCount: 0,
      skippedCount: items.length,
      updatedCount: 0,
    }
  }

  const existingExternalIds = new Set(
    (
      await findExistingExternalIds(uniqueItems.map((item) => item.externalId))
    ).map((item) => item.externalId)
  )
  const existingItems = uniqueItems.filter((item) =>
    existingExternalIds.has(item.externalId)
  )
  let insertedCount = 0

  for (const batch of chunk(uniqueItems, batchSize)) {
    const result = await createMany(batch)
    insertedCount += result.count
  }

  for (const batch of chunk(existingItems, batchSize)) {
    const operations = batch.map((item) => update(item))

    if (runUpdateBatch) {
      await runUpdateBatch(operations)
    } else {
      await Promise.all(operations)
    }
  }

  return {
    insertedCount,
    skippedCount: Math.max(0, items.length - insertedCount - existingItems.length),
    updatedCount: existingItems.length,
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

import { describe, expect, it, vi } from "vitest"

import { writeRefreshItems } from "./refresh-write-batch"

describe("writeRefreshItems", () => {
  it("creates new records in bounded bulk batches and updates existing records together", async () => {
    const createMany = vi.fn(async (items: Array<{ externalId: string }>) => ({
      count: items.filter((item) => item.externalId !== "existing").length,
    }))
    const update = vi.fn().mockResolvedValue({})
    const runUpdateBatch = vi.fn(async (operations: Array<Promise<unknown>>) =>
      Promise.all(operations)
    )

    const result = await writeRefreshItems({
      batchSize: 2,
      createMany,
      findExistingExternalIds: vi.fn().mockResolvedValue([{ externalId: "existing" }]),
      items: [
        { externalId: "new-1" },
        { externalId: "existing" },
        { externalId: "new-2" },
      ],
      runUpdateBatch,
      update,
    })

    expect(createMany).toHaveBeenCalledTimes(2)
    expect(createMany).toHaveBeenNthCalledWith(1, [
      { externalId: "new-1" },
      { externalId: "existing" },
    ])
    expect(createMany).toHaveBeenNthCalledWith(2, [{ externalId: "new-2" }])
    expect(update).toHaveBeenCalledWith({ externalId: "existing" })
    expect(runUpdateBatch).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      insertedCount: 2,
      skippedCount: 0,
      updatedCount: 1,
    })
  })

  it("deduplicates repeated external IDs and records them as skipped", async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 })

    const result = await writeRefreshItems({
      createMany,
      findExistingExternalIds: vi.fn().mockResolvedValue([]),
      items: [
        { externalId: "same", value: "old" },
        { externalId: "same", value: "new" },
      ],
      update: vi.fn(),
    })

    expect(createMany).toHaveBeenCalledWith([
      { externalId: "same", value: "new" },
    ])
    expect(result).toEqual({
      insertedCount: 1,
      skippedCount: 1,
      updatedCount: 0,
    })
  })
})

import { describe, expect, it, vi } from "vitest"

import { writeRefreshItems } from "./refresh-write-batch"

describe("writeRefreshItems", () => {
  it("creates only new records and updates changed records in bounded batches", async () => {
    const createMany = vi.fn(async (items: Array<{ externalId: string }>) => ({ count: items.length }))
    const update = vi.fn().mockResolvedValue({})
    const runUpdateBatch = vi.fn(async (operations: Array<Promise<unknown>>) =>
      Promise.all(operations)
    )

    const result = await writeRefreshItems({
      batchSize: 2,
      createMany,
      findExistingItems: vi.fn().mockResolvedValue([
        { externalId: "existing", ingestionFingerprint: "old" },
      ]),
      items: [
        { externalId: "new-1", ingestionFingerprint: "new-1" },
        { externalId: "existing", ingestionFingerprint: "new" },
        { externalId: "new-2", ingestionFingerprint: "new-2" },
      ],
      runUpdateBatch,
      update,
    })

    expect(createMany).toHaveBeenCalledTimes(1)
    expect(createMany).toHaveBeenNthCalledWith(1, [
      { externalId: "new-1", ingestionFingerprint: "new-1" },
      { externalId: "new-2", ingestionFingerprint: "new-2" },
    ])
    expect(update).toHaveBeenCalledWith({ externalId: "existing", ingestionFingerprint: "new" })
    expect(runUpdateBatch).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      changedCount: 1,
      duplicateInputCount: 0,
      insertedCount: 2,
      unchangedCount: 0,
    })
  })

  it("skips identical existing data and reports duplicate input separately", async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 })
    const update = vi.fn()

    const result = await writeRefreshItems({
      createMany,
      findExistingItems: vi.fn().mockResolvedValue([
        { externalId: "same", ingestionFingerprint: "new" },
      ]),
      items: [
        { externalId: "same", ingestionFingerprint: "old", value: "old" },
        { externalId: "same", ingestionFingerprint: "new", value: "new" },
      ],
      update,
    })

    expect(createMany).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
    expect(result).toEqual({
      changedCount: 0,
      duplicateInputCount: 1,
      insertedCount: 0,
      unchangedCount: 1,
    })
  })

  it("updates a legacy item once so it gains a fingerprint", async () => {
    const update = vi.fn().mockResolvedValue({})

    const result = await writeRefreshItems({
      createMany: vi.fn(),
      findExistingItems: vi.fn().mockResolvedValue([
        { externalId: "legacy", ingestionFingerprint: null },
      ]),
      items: [{ externalId: "legacy", ingestionFingerprint: "current" }],
      update,
    })

    expect(update).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      changedCount: 1,
      duplicateInputCount: 0,
      insertedCount: 0,
      unchangedCount: 0,
    })
  })

  it("checks ownership before each bounded persistence batch", async () => {
    const beforeWriteBatch = vi.fn().mockResolvedValue(undefined)

    await writeRefreshItems({
      batchSize: 2,
      beforeWriteBatch,
      createMany: vi.fn(async (items: Array<{ externalId: string }>) => ({ count: items.length })),
      findExistingItems: vi.fn().mockResolvedValue([
        { externalId: "existing", ingestionFingerprint: "old" },
      ]),
      items: [
        { externalId: "new-1", ingestionFingerprint: "new-1" },
        { externalId: "existing", ingestionFingerprint: "new" },
        { externalId: "new-2", ingestionFingerprint: "new-2" },
        { externalId: "new-3", ingestionFingerprint: "new-3" },
      ],
      update: vi.fn().mockResolvedValue({}),
    })

    expect(beforeWriteBatch).toHaveBeenCalledTimes(3)
  })
})

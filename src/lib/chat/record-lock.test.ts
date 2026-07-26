import { describe, expect, it, vi } from "vitest"

import { withChatRecordLock } from "./record-lock"

describe("chat record locks", () => {
  it("acquires a bounded transaction lock using a stable scope and record ID", async () => {
    const executeRaw = vi.fn().mockResolvedValue(0)
    const transaction = vi.fn(async (work) => work({ $executeRaw: executeRaw }))
    const work = vi.fn().mockResolvedValue("locked")

    await expect(
      withChatRecordLock({
        recordId: "report-1",
        scope: "CHAT_REPORT",
        store: { $executeRaw: executeRaw, $transaction: transaction },
        work,
      })
    ).resolves.toBe("locked")

    expect(transaction).toHaveBeenCalledTimes(1)
    expect(executeRaw).toHaveBeenCalledTimes(2)
    expect(work).toHaveBeenCalledTimes(1)
  })
})

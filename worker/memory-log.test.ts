import { describe, expect, it, vi } from "vitest"

import { logWorkerMemory } from "./memory-log"

describe("worker memory logging", () => {
  it("emits only bounded numeric memory fields and the caller context", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined)

    logWorkerMemory({ jobId: "job-1", trigger: "opml_import" })

    expect(JSON.parse(String(log.mock.calls[0][0]))).toMatchObject({
      event: "worker_memory",
      jobId: "job-1",
      trigger: "opml_import",
    })
    expect(JSON.parse(String(log.mock.calls[0][0])).heapUsedMb).toEqual(expect.any(Number))
    log.mockRestore()
  })
})

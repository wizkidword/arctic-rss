import { EventEmitter } from "node:events"

import { describe, expect, it } from "vitest"

import { createManagedWorkerTargets } from "./managed-workers"

describe("managed workers", () => {
  it("tracks only active jobs for configured workers", () => {
    const worker = new EventEmitter()
    const [target] = createManagedWorkerTargets([
      { name: "feed-refresh", worker: worker as never },
      { name: "disabled", worker: undefined },
    ])

    worker.emit("active", { id: "job-1" })
    worker.emit("active", { id: "job-2" })
    worker.emit("completed", { id: "job-1" })

    expect(target).toMatchObject({ name: "feed-refresh" })
    expect(target.activeJobs()).toEqual(["job-2"])
  })
})

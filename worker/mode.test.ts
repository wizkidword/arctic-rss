import { describe, expect, it } from "vitest"

import {
  getWorkerMode,
  runsWorkerResponsibility,
  workerHeartbeatPath,
} from "./mode"

describe("worker mode", () => {
  it("keeps the existing all-responsibilities worker as the default", () => {
    expect(getWorkerMode({})).toBe("all")
    expect(workerHeartbeatPath("all")).toBe("/tmp/arctic-rss-worker-heartbeat")
  })

  it("parses explicit isolated modes and their independent heartbeat paths", () => {
    expect(getWorkerMode({ WORKER_MODE: "ai-mail" })).toBe("ai-mail")
    expect(workerHeartbeatPath("maintenance")).toBe(
      "/tmp/arctic-rss-worker-heartbeat-maintenance"
    )
  })

  it("rejects an unknown mode instead of starting with ambiguous ownership", () => {
    expect(() => getWorkerMode({ WORKER_MODE: "everything" })).toThrow(
      "WORKER_MODE must be one of"
    )
  })

  it("assigns each responsibility to all or its isolated mode", () => {
    expect(runsWorkerResponsibility("all", "imports")).toBe(true)
    expect(runsWorkerResponsibility("imports", "imports")).toBe(true)
    expect(runsWorkerResponsibility("imports", "ingestion")).toBe(false)
  })
})

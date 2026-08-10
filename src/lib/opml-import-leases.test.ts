import { describe, expect, it, vi } from "vitest"

import {
  claimOpmlImportEntry,
  finalizeOpmlImportEntry,
  renewOpmlImportEntryLease,
  runWithOpmlImportEntryLeaseHeartbeat,
} from "./opml-import-leases"

function createStore() {
  return {
    $queryRaw: vi.fn(),
    importJobEntry: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  }
}

describe("OPML import entry leases", () => {
  it("claims the next pending or expired entry through a skip-locked update", async () => {
    const store = createStore()
    store.$queryRaw.mockResolvedValue([
      {
        attempt: 2,
        folderName: "Technology",
        id: "entry-1",
        importJobId: "job-1",
        leaseExpiresAt: new Date("2026-08-09T12:01:00.000Z"),
        leaseOwner: "worker-1",
        sequence: 0,
        title: "Example Feed",
        xmlUrl: "https://example.test/feed.xml",
      },
    ])

    await expect(
      claimOpmlImportEntry({
        importJobId: "job-1",
        leaseOwner: "worker-1",
        now: new Date("2026-08-09T12:00:00.000Z"),
        store,
      }),
    ).resolves.toMatchObject({
      attempt: 2,
      id: "entry-1",
      leaseOwner: "worker-1",
    })

    expect(store.$queryRaw).toHaveBeenCalledTimes(1)
    const query = store.$queryRaw.mock.calls[0]?.[0].join("?")
    expect(query).toContain("FOR UPDATE OF entry SKIP LOCKED")
    expect(query).toContain('entry."status" = \'PENDING\'')
    expect(query).toContain('entry."status" = \'PROCESSING\'')
    expect(query).toContain('"attempt" = entry."attempt" + 1')
  })

  it("does not let a stale owner finalize the entry or advance parent counters", async () => {
    const store = createStore()
    store.$queryRaw.mockResolvedValue([])

    await expect(
      finalizeOpmlImportEntry({
        errorMessage: null,
        lease: {
          attempt: 1,
          id: "entry-1",
          leaseOwner: "worker-a",
        },
        now: new Date("2026-08-09T12:01:00.000Z"),
        status: "ADDED",
        store,
      }),
    ).resolves.toBe(false)

    const query = store.$queryRaw.mock.calls[0]?.[0].join("?")
    expect(query).toContain('entry."attempt" = ?')
    expect(query).toContain('entry."leaseOwner" = ?')
    expect(query).toContain('entry."leaseExpiresAt" > ?')
    expect(query).toContain('"processedFeeds" = job."processedFeeds" + 1')
  })

  it("requires the current fence when renewing a lease", async () => {
    const store = createStore()
    const now = new Date("2026-08-09T12:00:00.000Z")

    await expect(
      renewOpmlImportEntryLease({
        lease: {
          attempt: 3,
          id: "entry-1",
          leaseOwner: "worker-a",
        },
        now,
        store,
      }),
    ).resolves.toBe(true)

    expect(store.importJobEntry.updateMany).toHaveBeenCalledWith({
      data: {
        leaseExpiresAt: new Date("2026-08-09T12:01:00.000Z"),
      },
      where: {
        attempt: 3,
        id: "entry-1",
        leaseExpiresAt: { gt: now },
        leaseOwner: "worker-a",
        status: "PROCESSING",
      },
    })
  })

  it("does not allow finalization after a heartbeat loses its fence", async () => {
    const store = createStore()
    store.importJobEntry.updateMany.mockResolvedValue({ count: 0 })

    await expect(
      runWithOpmlImportEntryLeaseHeartbeat({
        lease: {
          attempt: 1,
          id: "entry-1",
          leaseOwner: "worker-a",
        },
        store,
        work: async () => "subscription-attempted",
      }),
    ).resolves.toEqual({
      leaseHeld: false,
      result: "subscription-attempted",
    })
  })
})

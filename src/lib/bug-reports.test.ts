import { describe, expect, it, vi } from "vitest"

import {
  BugReportError,
  createBugReportForUserWithClient,
  type BugReportStore,
} from "./bug-reports"

function createStore(): BugReportStore {
  return {
    bugReport: {
      create: vi.fn().mockResolvedValue({
        id: "bug-1",
      }),
      findFirst: vi.fn().mockResolvedValue(null),
    },
  }
}

describe("bug report creation", () => {
  it("stores a trimmed reader report with bounded metadata", async () => {
    const store = createStore()

    const report = await createBugReportForUserWithClient({
      contactEmail: "reader@example.com",
      description: "  The podcast player stopped after I changed routes.  ",
      pageUrl: "https://arcticrss.com/app/podcasts",
      store,
      title: "  Podcast player stops  ",
      userAgent: "Brave on Windows".repeat(80),
      userId: "user-1",
    })

    expect(store.bugReport.create).toHaveBeenCalledWith({
      data: {
        contactEmail: "reader@example.com",
        description: "The podcast player stopped after I changed routes.",
        pageUrl: "https://arcticrss.com/app/podcasts",
        title: "Podcast player stops",
        userAgent: expect.stringMatching(/^Brave on Windows/),
        userId: "user-1",
      },
      select: {
        id: true,
      },
    })
    expect(
      vi.mocked(store.bugReport.create).mock.calls[0]?.[0].data.userAgent
    ).toHaveLength(500)
    expect(report).toEqual({
      id: "bug-1",
    })
  })

  it("coalesces an identical report from the same reader", async () => {
    const store = createStore()
    vi.mocked(store.bugReport.findFirst).mockResolvedValue({ id: "bug-1" })

    await expect(
      createBugReportForUserWithClient({
        description: " The player stopped. ",
        store,
        title: " Podcast issue ",
        userId: "user-1",
      })
    ).resolves.toEqual({ id: "bug-1" })

    expect(store.bugReport.create).not.toHaveBeenCalled()
  })

  it("requires a title and description", async () => {
    const store = createStore()

    await expect(
      createBugReportForUserWithClient({
        description: "   ",
        store,
        title: "",
        userId: "user-1",
      })
    ).rejects.toEqual(new BugReportError("Describe the bug before sending it."))
    expect(store.bugReport.create).not.toHaveBeenCalled()
  })
})

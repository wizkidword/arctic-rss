import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  handleApiV1DeviceSession: vi.fn(),
  listMobileSync: vi.fn(),
  parseApiV1Query: vi.fn(),
  parseMobileProductMilestone: vi.fn(),
  recordMobileProductMilestone: vi.fn(),
}))

vi.mock("@/lib/api-v1/route", () => ({
  handleApiV1DeviceSession: mocks.handleApiV1DeviceSession,
  parseApiV1Query: mocks.parseApiV1Query,
}))

vi.mock("@/lib/api-v1/telemetry", () => ({
  parseMobileProductMilestone: mocks.parseMobileProductMilestone,
  recordMobileProductMilestone: mocks.recordMobileProductMilestone,
}))

vi.mock("@/lib/mobile-sync", () => ({
  listMobileSync: mocks.listMobileSync,
}))

import { GET } from "./route"

describe("GET /api/v1/sync product milestones", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.handleApiV1DeviceSession.mockImplementation(
      async ({ run }: { run: (context: { deviceSessionId: string; userId: string }) => Promise<unknown> }) =>
        run({ deviceSessionId: "device-1", userId: "user-1" })
    )
    mocks.parseApiV1Query.mockReturnValue({ limit: 100 })
    mocks.listMobileSync.mockResolvedValue({ events: [], hasMore: false, nextCursor: "2" })
  })

  it("records a valid Android milestone only after successful sync work", async () => {
    mocks.parseMobileProductMilestone.mockReturnValue("first_mobile_sync")

    const result = await GET(new Request("https://arcticrss.example/api/v1/sync"))

    expect(mocks.listMobileSync).toHaveBeenCalledWith({ limit: 100, userId: "user-1" })
    expect(result).toMatchObject({ data: { hasMore: false } })
    expect(mocks.recordMobileProductMilestone).toHaveBeenCalledWith(
      "first_mobile_sync"
    )
  })

  it("does not record when the header does not contain a fixed milestone", async () => {
    mocks.parseMobileProductMilestone.mockReturnValue(undefined)

    const result = await GET(new Request("https://arcticrss.example/api/v1/sync"))

    expect(mocks.recordMobileProductMilestone).not.toHaveBeenCalled()
    expect(result).toMatchObject({ data: { hasMore: false } })
  })
})

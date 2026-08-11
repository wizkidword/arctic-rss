import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  handleApiV1DeviceSession: vi.fn(),
  listMobileSync: vi.fn(),
  parseApiV1Query: vi.fn(),
}))

vi.mock("@/lib/api-v1/route", () => ({
  handleApiV1DeviceSession: mocks.handleApiV1DeviceSession,
  parseApiV1Query: mocks.parseApiV1Query,
}))

vi.mock("@/lib/mobile-sync", () => ({
  listMobileSync: mocks.listMobileSync,
}))

import { GET } from "./route"

describe("GET /api/v1/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.handleApiV1DeviceSession.mockImplementation(
      async ({ run }: { run: (context: { deviceSessionId: string; userId: string }) => Promise<unknown> }) =>
        run({ deviceSessionId: "device-1", userId: "user-1" })
    )
    mocks.parseApiV1Query.mockReturnValue({ limit: 100 })
    mocks.listMobileSync.mockResolvedValue({ events: [], hasMore: false, nextCursor: "2" })
  })

  it("returns the explicit pagination state", async () => {
    const result = await GET(new Request("https://arcticrss.example/api/v1/sync"))

    expect(mocks.listMobileSync).toHaveBeenCalledWith({ limit: 100, userId: "user-1" })
    expect(result).toMatchObject({ data: { hasMore: false } })
  })

  it("does not turn an untrusted request header into a product event", async () => {
    const result = await GET(new Request("https://arcticrss.example/api/v1/sync"))

    expect(result).toMatchObject({ data: { hasMore: false } })
  })
})

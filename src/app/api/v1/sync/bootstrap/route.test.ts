import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getMobileSyncBootstrap: vi.fn(),
  handleApiV1DeviceSession: vi.fn(),
}))

vi.mock("@/lib/api-v1/route", () => ({
  handleApiV1DeviceSession: mocks.handleApiV1DeviceSession,
}))

vi.mock("@/lib/mobile-sync", () => ({
  getMobileSyncBootstrap: mocks.getMobileSyncBootstrap,
}))

import { GET } from "./route"

describe("GET /api/v1/sync/bootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.handleApiV1DeviceSession.mockImplementation(
      async ({ run }: { run: (context: { userId: string }) => Promise<unknown> }) => run({ userId: "user-1" })
    )
    mocks.getMobileSyncBootstrap.mockResolvedValue({ highWaterCursor: "42" })
  })

  it("returns the current user's high-water cursor", async () => {
    await expect(GET(new Request("https://arcticrss.example/api/v1/sync/bootstrap"))).resolves.toEqual({
      data: { highWaterCursor: "42" },
    })
    expect(mocks.getMobileSyncBootstrap).toHaveBeenCalledWith("user-1")
  })
})

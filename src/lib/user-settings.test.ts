import { beforeEach, describe, expect, it, vi } from "vitest"

import { Prisma } from "../generated/prisma/client"

const mocks = vi.hoisted(() => ({
  getPrisma: vi.fn(),
}))

vi.mock("./db", () => ({
  getPrisma: mocks.getPrisma,
}))

import { getOrCreateUserSettings } from "./user-settings"

describe("getOrCreateUserSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns defaults from an upsert when no concurrent request exists", async () => {
    const settings = { displayMode: "THREE_PANE", userId: "user-1" }
    const upsert = vi.fn().mockResolvedValue(settings)
    mocks.getPrisma.mockReturnValue({ userSettings: { upsert } })

    await expect(getOrCreateUserSettings("user-1")).resolves.toEqual(settings)
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ userId: "user-1" }),
        update: {},
        where: { userId: "user-1" },
      })
    )
  })

  it("returns the row created by a concurrent first render", async () => {
    const duplicate = new Prisma.PrismaClientKnownRequestError("duplicate", {
      clientVersion: "7.8.0",
      code: "P2002",
    })
    const settings = { displayMode: "THREE_PANE", userId: "user-1" }
    const findUnique = vi.fn().mockResolvedValue(settings)
    const upsert = vi.fn().mockRejectedValue(duplicate)
    mocks.getPrisma.mockReturnValue({ userSettings: { findUnique, upsert } })

    await expect(getOrCreateUserSettings("user-1")).resolves.toEqual(settings)
    expect(findUnique).toHaveBeenCalledWith({ where: { userId: "user-1" } })
  })
})

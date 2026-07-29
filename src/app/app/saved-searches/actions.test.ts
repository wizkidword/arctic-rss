import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  class MockSavedSearchError extends Error {
    constructor(message: string) {
      super(message)
      this.name = "SavedSearchError"
    }
  }

  return {
    acknowledgeSavedSearchMonitorForUser: vi.fn(),
    auth: vi.fn(),
    createSavedSearchForUser: vi.fn(),
    deleteSavedSearchForUser: vi.fn(),
    MockSavedSearchError,
    redirect: vi.fn((path: string) => {
      throw new Error(`REDIRECT:${path}`)
    }),
    revalidatePath: vi.fn(),
    setSavedSearchMonitorEnabledForUser: vi.fn(),
  }
})

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}))

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}))

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}))

vi.mock("@/lib/saved-searches", () => ({
  acknowledgeSavedSearchMonitorForUser: mocks.acknowledgeSavedSearchMonitorForUser,
  createSavedSearchForUser: mocks.createSavedSearchForUser,
  deleteSavedSearchForUser: mocks.deleteSavedSearchForUser,
  SavedSearchError: mocks.MockSavedSearchError,
  setSavedSearchMonitorEnabledForUser: mocks.setSavedSearchMonitorEnabledForUser,
}))

import {
  acknowledgeSavedSearchMonitorAction,
  createSavedSearchAction,
  deleteSavedSearchAction,
  setSavedSearchMonitorEnabledAction,
} from "./actions"

describe("saved search actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } })
  })

  it("does not accept a create request without an authenticated user", async () => {
    mocks.auth.mockResolvedValue(null)

    await expect(
      createSavedSearchAction(
        { message: "", status: "idle" },
        new FormData()
      )
    ).resolves.toEqual({
      message: "You need to sign in before saving a search.",
      status: "error",
    })

    expect(mocks.createSavedSearchForUser).not.toHaveBeenCalled()
  })

  it("uses only the authenticated user and parsed filter fields when creating a saved search", async () => {
    const formData = new FormData()
    formData.set("name", "Sea ice")
    formData.set("description", "Research")
    formData.set("q", " sea ice ")
    formData.set("source", "subscription-1")
    formData.set("state", "starred")
    formData.set("from", "2026-07-01")
    formData.set("to", "2026-07-31")

    await expect(
      createSavedSearchAction({ message: "", status: "idle" }, formData)
    ).rejects.toThrow("REDIRECT:/app/saved-searches")

    expect(mocks.createSavedSearchForUser).toHaveBeenCalledWith({
      input: {
        description: "Research",
        filters: expect.objectContaining({
          query: "sea ice",
          state: "starred",
          subscriptionId: "subscription-1",
        }),
        name: "Sea ice",
      },
      userId: "user-1",
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/saved-searches")
  })

  it("does not reveal missing saved searches through the delete action", async () => {
    mocks.deleteSavedSearchForUser.mockRejectedValue(
      new mocks.MockSavedSearchError("Saved search not found.")
    )
    const formData = new FormData()
    formData.set("savedSearchId", "another-users-search")

    await expect(deleteSavedSearchAction(formData)).resolves.toBeUndefined()
    expect(mocks.deleteSavedSearchForUser).toHaveBeenCalledWith({
      savedSearchId: "another-users-search",
      userId: "user-1",
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/saved-searches")
  })

  it("uses only the authenticated user when enabling a saved monitor", async () => {
    const formData = new FormData()
    formData.set("enabled", "true")
    formData.set("savedSearchId", "saved-search-1")

    await expect(setSavedSearchMonitorEnabledAction(formData)).resolves.toBeUndefined()

    expect(mocks.setSavedSearchMonitorEnabledForUser).toHaveBeenCalledWith({
      enabled: true,
      savedSearchId: "saved-search-1",
      userId: "user-1",
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/saved-searches")
  })

  it("does not reveal a missing monitor when marking results seen", async () => {
    mocks.acknowledgeSavedSearchMonitorForUser.mockRejectedValue(
      new mocks.MockSavedSearchError("Saved search not found.")
    )
    const formData = new FormData()
    formData.set("savedSearchId", "another-users-search")

    await expect(acknowledgeSavedSearchMonitorAction(formData)).resolves.toBeUndefined()
    expect(mocks.acknowledgeSavedSearchMonitorForUser).toHaveBeenCalledWith({
      savedSearchId: "another-users-search",
      userId: "user-1",
    })
  })
})

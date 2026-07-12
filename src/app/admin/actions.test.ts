import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  addDiscoverSubredditToRedditTopic: vi.fn(),
  auth: vi.fn(),
  importDiscoverOpml: vi.fn(),
  refresh: vi.fn(),
  revalidatePath: vi.fn(),
  updateDiscoverCategoryMetadata: vi.fn(),
}))

vi.mock("next/cache", () => ({
  refresh: mocks.refresh,
  revalidatePath: mocks.revalidatePath,
}))

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}))

vi.mock("@/lib/discover-directory-import", () => ({
  importDiscoverOpml: mocks.importDiscoverOpml,
}))

vi.mock("@/lib/discover-category-customizations", () => ({
  DiscoverCategoryMetadataError: class DiscoverCategoryMetadataError extends Error {},
  updateDiscoverCategoryMetadata: mocks.updateDiscoverCategoryMetadata,
}))

vi.mock("@/lib/discover-subreddits", () => ({
  DiscoverSubredditError: class DiscoverSubredditError extends Error {},
  addDiscoverSubredditToRedditTopic: mocks.addDiscoverSubredditToRedditTopic,
}))

import {
  addDiscoverSubredditAction,
  importDiscoverOpmlAction,
  updateDiscoverCategoryMetadataAction,
} from "./actions"

describe("importDiscoverOpmlAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("requires an administrator session", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
        role: "USER",
      },
    })
    const formData = new FormData()
    formData.set(
      "opmlFile",
      new File(["<opml></opml>"], "feeds.opml", { type: "text/xml" })
    )

    const result = await importDiscoverOpmlAction(
      {
        message: "",
        status: "idle",
      },
      formData
    )

    expect(result).toEqual({
      message: "Only administrators can import Discover OPML files.",
      status: "error",
    })
    expect(mocks.importDiscoverOpml).not.toHaveBeenCalled()
  })

  it("requires an OPML file", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "admin-1",
        role: "ADMIN",
      },
    })

    const result = await importDiscoverOpmlAction(
      {
        message: "",
        status: "idle",
      },
      new FormData()
    )

    expect(result).toEqual({
      message: "Choose an OPML file to add to Discover.",
      status: "error",
    })
    expect(mocks.importDiscoverOpml).not.toHaveBeenCalled()
  })

  it("imports the uploaded OPML with optional category metadata", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "admin-1",
        role: "ADMIN",
      },
    })
    mocks.importDiscoverOpml.mockResolvedValue({
      categoriesCreated: 1,
      categoriesUpdated: 0,
      errors: [],
      failedFeeds: 0,
      importedFeeds: 2,
      totalFeeds: 2,
    })
    const formData = new FormData()
    formData.set(
      "opmlFile",
      new File(["<opml><body /></opml>"], "bangladesh.opml", {
        type: "text/xml",
      })
    )
    formData.set("categoryName", "General")
    formData.set("countryCode", "BD")
    formData.set("description", "Bangladesh news feeds.")

    const result = await importDiscoverOpmlAction(
      {
        message: "",
        status: "idle",
      },
      formData
    )

    expect(mocks.importDiscoverOpml).toHaveBeenCalledWith({
      adminUserId: "admin-1",
      categoryName: "General",
      countryCode: "BD",
      description: "Bangladesh news feeds.",
      fileName: "bangladesh.opml",
      opmlXml: "<opml><body /></opml>",
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/discover")
    expect(mocks.refresh).toHaveBeenCalled()
    expect(result).toEqual({
      message: "Imported 2 feeds across 1 category. Failed 0.",
      status: "success",
      summary: {
        categoriesCreated: 1,
        categoriesUpdated: 0,
        failedFeeds: 0,
        importedFeeds: 2,
        totalFeeds: 2,
      },
    })
  })
})

describe("updateDiscoverCategoryMetadataAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("requires an administrator session", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
        role: "USER",
      },
    })
    const formData = new FormData()
    formData.set("categoryId", "us-general")
    formData.set("description", "Edited description.")
    formData.set("iconKey", "world")

    const result = await updateDiscoverCategoryMetadataAction(
      {
        message: "",
        status: "idle",
      },
      formData
    )

    expect(result).toEqual({
      message: "Only administrators can edit Discover cards.",
      status: "error",
    })
    expect(mocks.updateDiscoverCategoryMetadata).not.toHaveBeenCalled()
  })

  it("updates Discover card metadata and refreshes Discover", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "admin-1",
        role: "ADMIN",
      },
    })
    mocks.updateDiscoverCategoryMetadata.mockResolvedValue({
      categoryId: "us-general",
      description: "Edited national news description.",
      iconKey: "world",
      label: "US General",
    })
    const formData = new FormData()
    formData.set("categoryId", "us-general")
    formData.set("description", "Edited national news description.")
    formData.set("iconKey", "world")

    const result = await updateDiscoverCategoryMetadataAction(
      {
        message: "",
        status: "idle",
      },
      formData
    )

    expect(mocks.updateDiscoverCategoryMetadata).toHaveBeenCalledWith({
      adminUserId: "admin-1",
      categoryId: "us-general",
      description: "Edited national news description.",
      iconKey: "world",
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin")
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/discover")
    expect(mocks.refresh).toHaveBeenCalled()
    expect(result).toEqual({
      message: "Updated US General.",
      status: "success",
    })
  })
})

describe("addDiscoverSubredditAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("requires an administrator session", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
        role: "USER",
      },
    })
    const formData = new FormData()
    formData.set("subredditName", "localhistory")

    const result = await addDiscoverSubredditAction(
      {
        message: "",
        status: "idle",
      },
      formData
    )

    expect(result).toEqual({
      message: "Only administrators can add subreddits to Discover.",
      status: "error",
    })
    expect(mocks.addDiscoverSubredditToRedditTopic).not.toHaveBeenCalled()
  })

  it("adds a subreddit to Discover and refreshes the admin and reader pages", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "admin-1",
        role: "ADMIN",
      },
    })
    mocks.addDiscoverSubredditToRedditTopic.mockResolvedValue({
      feedId: "reddit-localhistory",
      label: "r/localhistory",
      subredditName: "localhistory",
      url: "https://www.reddit.com/r/localhistory/.rss",
    })
    const formData = new FormData()
    formData.set("subredditName", "r/localhistory")

    const result = await addDiscoverSubredditAction(
      {
        message: "",
        status: "idle",
      },
      formData
    )

    expect(mocks.addDiscoverSubredditToRedditTopic).toHaveBeenCalledWith({
      adminUserId: "admin-1",
      subredditName: "r/localhistory",
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin")
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/discover")
    expect(mocks.refresh).toHaveBeenCalled()
    expect(result).toEqual({
      message: "Added r/localhistory to Reddit.",
      status: "success",
    })
  })
})

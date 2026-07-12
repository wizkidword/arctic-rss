import { describe, expect, it, vi } from "vitest"

import {
  FeatureSuggestionError,
  createFeatureSuggestionForUserWithClient,
  type FeatureSuggestionStore,
} from "./feature-suggestions"

function createStore(): FeatureSuggestionStore {
  return {
    featureSuggestion: {
      create: vi.fn().mockResolvedValue({
        id: "feature-1",
      }),
    },
  }
}

describe("feature suggestion creation", () => {
  it("stores a trimmed reader suggestion with bounded metadata", async () => {
    const store = createStore()

    const suggestion = await createFeatureSuggestionForUserWithClient({
      contactEmail: "reader@example.com",
      description: "  I want a keyboard shortcut palette for power readers.  ",
      pageUrl: "https://arcticrss.com/app",
      store,
      title: "  Command palette  ",
      userAgent: "Brave on Windows".repeat(80),
      userId: "user-1",
    })

    expect(store.featureSuggestion.create).toHaveBeenCalledWith({
      data: {
        contactEmail: "reader@example.com",
        description: "I want a keyboard shortcut palette for power readers.",
        pageUrl: "https://arcticrss.com/app",
        title: "Command palette",
        userAgent: expect.stringMatching(/^Brave on Windows/),
        userId: "user-1",
      },
      select: {
        id: true,
      },
    })
    expect(
      vi.mocked(store.featureSuggestion.create).mock.calls[0]?.[0].data
        .userAgent
    ).toHaveLength(500)
    expect(suggestion).toEqual({
      id: "feature-1",
    })
  })

  it("requires a title and description", async () => {
    const store = createStore()

    await expect(
      createFeatureSuggestionForUserWithClient({
        description: "   ",
        store,
        title: "",
        userId: "user-1",
      })
    ).rejects.toEqual(
      new FeatureSuggestionError("Describe the feature before sending it.")
    )
    expect(store.featureSuggestion.create).not.toHaveBeenCalled()
  })
})

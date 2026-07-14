import { describe, expect, it } from "vitest"

import type { DiscoverDirectory } from "../discover-directory"
import {
  ChatNormalizationError,
  listCanonicalChatInterestOptions,
  normalizeChatHandle,
  normalizeChatRoomSlug,
  validateChatInterestIds,
} from "./normalization"

const directory = {
  categories: [
    {
      countryCode: null,
      description: "Artificial intelligence",
      iconKey: "ai",
      id: "opml-ai",
      label: "AI",
      sortOrder: 1,
    },
    {
      countryCode: null,
      description: "Programming",
      iconKey: "programming",
      id: "opml-programming",
      label: "Programming",
      sortOrder: 2,
    },
  ],
  feeds: [],
} satisfies DiscoverDirectory

describe("chat normalization", () => {
  it("normalizes a safe stable handle", () => {
    expect(normalizeChatHandle("  Arctic_User-42 ")).toBe("arctic_user-42")
  })

  it("rejects reserved, malformed, and non-ASCII handles", () => {
    expect(() => normalizeChatHandle("admin")).toThrow(ChatNormalizationError)
    expect(() => normalizeChatHandle("a!")).toThrow(ChatNormalizationError)
    expect(() => normalizeChatHandle("Ａrctic")).toThrow(ChatNormalizationError)
  })

  it("normalizes a prefixed room slug", () => {
    expect(normalizeChatRoomSlug(" #Programming_101 ")).toBe(
      "programming_101"
    )
  })

  it("rejects reserved and malformed room slugs", () => {
    expect(() => normalizeChatRoomSlug("#admin")).toThrow(
      ChatNormalizationError
    )
    expect(() => normalizeChatRoomSlug("#not a room")).toThrow(
      ChatNormalizationError
    )
  })

  it("uses composed Discover interests as the canonical room taxonomy", async () => {
    await expect(
      listCanonicalChatInterestOptions(async () => directory)
    ).resolves.toEqual([
      { id: "ai", label: "AI" },
      { id: "programming", label: "Programming" },
    ])

    await expect(
      validateChatInterestIds(["AI", "programming", "ai"], async () => directory)
    ).resolves.toEqual(["ai", "programming"])
  })

  it("rejects unknown or excessive room interests", async () => {
    await expect(
      validateChatInterestIds(["missing"], async () => directory)
    ).rejects.toThrow(ChatNormalizationError)
    await expect(
      validateChatInterestIds(["ai", "programming", "one", "two"], async () => directory)
    ).rejects.toThrow(ChatNormalizationError)
  })
})

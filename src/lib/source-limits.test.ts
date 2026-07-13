import { describe, expect, it, vi } from "vitest"

import {
  DATABASE_SOURCE_LIMIT_ERROR,
  FREE_PLAN_SOURCE_LIMIT,
  assertUserCanAddSource,
  isDatabaseSourceLimitError,
  SourceLimitError,
} from "./source-limits"

describe("source limits", () => {
  it("allows free users below the shared feed and podcast source limit", async () => {
    await expect(
      assertUserCanAddSource({
        store: {
          user: {
            findUnique: vi.fn().mockResolvedValue({
              _count: { podcastSubscriptions: 12, subscriptions: 30 },
              plan: "FREE",
            }),
          },
        },
        userId: "user-1",
      })
    ).resolves.toEqual({ currentSourceCount: 42, limit: FREE_PLAN_SOURCE_LIMIT })
  })

  it("rejects free users at the shared source limit", async () => {
    await expect(
      assertUserCanAddSource({
        store: {
          user: {
            findUnique: vi.fn().mockResolvedValue({
              _count: { podcastSubscriptions: 50, subscriptions: 150 },
              plan: "FREE",
            }),
          },
        },
        userId: "user-1",
      })
    ).rejects.toThrow(SourceLimitError)
  })

  it("throws a source limit error when the user is missing", async () => {
    await expect(
      assertUserCanAddSource({
        store: {
          user: {
            findUnique: vi.fn().mockResolvedValue(null),
          },
        },
        userId: "missing-user",
      })
    ).rejects.toEqual(
      new SourceLimitError("User account was not found.")
    )
  })

  it("allows non-free users above the shared source limit", async () => {
    await expect(
      assertUserCanAddSource({
        store: {
          user: {
            findUnique: vi.fn().mockResolvedValue({
              _count: { podcastSubscriptions: 75, subscriptions: 150 },
              plan: "PRO",
            }),
          },
        },
        userId: "user-1",
      })
    ).resolves.toEqual({ currentSourceCount: 225, limit: FREE_PLAN_SOURCE_LIMIT })
  })

  it("rejects free users at exactly the combined source limit", async () => {
    await expect(
      assertUserCanAddSource({
        store: {
          user: {
            findUnique: vi.fn().mockResolvedValue({
              _count: { podcastSubscriptions: 25, subscriptions: 175 },
              plan: "FREE",
            }),
          },
        },
        userId: "user-1",
      })
    ).rejects.toThrow(SourceLimitError)
  })

  it("recognizes the database guard's limit error without exposing database details", () => {
    expect(
      isDatabaseSourceLimitError(
        new Error(`Database error: ${DATABASE_SOURCE_LIMIT_ERROR}`)
      )
    ).toBe(true)
    expect(isDatabaseSourceLimitError(new Error("unrelated failure"))).toBe(false)
  })
})

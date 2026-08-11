import { describe, expect, it } from "vitest"

import { createPendingMobileMutation } from "@arctic-rss/mobile-client"

import { readPendingMobileMutations } from "./pending-mobile-mutations"

describe("readPendingMobileMutations", () => {
  it("returns valid rows and identifies corrupt rows for deletion", () => {
    const result = readPendingMobileMutations([
      {
        idempotencyKey: "a".repeat(16),
        payload: JSON.stringify(createPendingMobileMutation({
          body: { isRead: true },
          createdAt: 1,
          idempotencyKey: "a".repeat(16),
          method: "PATCH",
          path: "/api/v1/articles/article-1/state",
        }, { mobileDeviceId: "device-1", userId: "user-1" })),
      },
      { idempotencyKey: "corrupt-row", payload: "not-json" },
    ])

    expect(result.mutations).toHaveLength(1)
    expect(result.corruptKeys).toEqual(["corrupt-row"])
  })

  it("rejects a payload whose identity does not match its SQLite row", () => {
    const result = readPendingMobileMutations([
      {
        idempotencyKey: "b".repeat(16),
        payload: JSON.stringify(createPendingMobileMutation({
          body: { isRead: true },
          createdAt: 1,
          idempotencyKey: "a".repeat(16),
          method: "PATCH",
          path: "/api/v1/articles/article-1/state",
        }, { mobileDeviceId: "device-1", userId: "user-1" })),
      },
    ])

    expect(result.mutations).toEqual([])
    expect(result.corruptKeys).toEqual(["b".repeat(16)])
  })
})

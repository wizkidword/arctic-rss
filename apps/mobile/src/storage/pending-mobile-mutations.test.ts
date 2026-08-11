import { describe, expect, it } from "vitest"

import { readPendingMobileMutations } from "./pending-mobile-mutations"

describe("readPendingMobileMutations", () => {
  it("returns valid rows and identifies corrupt rows for deletion", () => {
    const result = readPendingMobileMutations([
      {
        idempotencyKey: "valid-row",
        payload: JSON.stringify({
          body: { isRead: true },
          createdAt: 1,
          idempotencyKey: "a".repeat(16),
          method: "PATCH",
          path: "/api/v1/articles/article-1/state",
        }),
      },
      { idempotencyKey: "corrupt-row", payload: "not-json" },
    ])

    expect(result.mutations).toHaveLength(1)
    expect(result.corruptKeys).toEqual(["corrupt-row"])
  })
})

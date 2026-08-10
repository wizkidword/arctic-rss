import { describe, expect, it } from "vitest"

import {
  countExternalIdentityHashCollisionCandidates,
  externalIdentityHash,
} from "./external-identity"

describe("external identity hashes", () => {
  it("uses a fixed-length hash of the safe, identity-preserving representation", () => {
    expect(externalIdentityHash("Cafe\u0301\u0000\r\nitem")).toBe(
      externalIdentityHash("Cafe\u0301\nitem")
    )
    expect(externalIdentityHash("Cafe\u0301")).not.toBe(externalIdentityHash("Café"))
    expect(externalIdentityHash("x".repeat(20_000))).toMatch(/^[a-f0-9]{64}$/)
  })

  it("exposes a scoped hash-collision test seam without retaining raw values", () => {
    expect(
      countExternalIdentityHashCollisionCandidates([
        { externalId: "first", hash: "forced-collision", scopeId: "feed-1" },
        { externalId: "second", hash: "forced-collision", scopeId: "feed-1" },
        { externalId: "third", hash: "forced-collision", scopeId: "feed-2" },
      ])
    ).toBe(2)
  })
})

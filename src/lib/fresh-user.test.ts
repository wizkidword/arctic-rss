import { describe, expect, it, vi } from "vitest"

import { createRequestFreshUserResolver } from "./fresh-user"

describe("fresh user resolver", () => {
  it("loads a user once per request resolver while preserving a new resolver per request", async () => {
    const loadUser = vi.fn().mockResolvedValue({
      authVersion: 4,
      disabledAt: null,
      emailVerified: new Date(),
      id: "user-1",
      plan: "FREE" as const,
      role: "USER" as const,
    })
    const firstRequest = createRequestFreshUserResolver(loadUser)

    await Promise.all([firstRequest("user-1"), firstRequest("user-1")])

    expect(loadUser).toHaveBeenCalledTimes(1)

    const secondRequest = createRequestFreshUserResolver(loadUser)
    await secondRequest("user-1")

    expect(loadUser).toHaveBeenCalledTimes(2)
  })
})

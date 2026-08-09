import { describe, expect, it, vi } from "vitest"

import {
  createRequestFreshUserResolver,
  getFreshUserState,
  withFreshUserRequestScope,
} from "./fresh-user"

function freshUser(id: string) {
  return {
    authVersion: 4,
    disabledAt: null,
    emailVerified: new Date(),
    id,
    plan: "FREE" as const,
    role: "USER" as const,
  }
}

describe("fresh user resolver", () => {
  it("loads a user once per request resolver while preserving a new resolver per request", async () => {
    const loadUser = vi.fn().mockResolvedValue(freshUser("user-1"))
    const firstRequest = createRequestFreshUserResolver(loadUser)

    await Promise.all([firstRequest("user-1"), firstRequest("user-1")])

    expect(loadUser).toHaveBeenCalledTimes(1)

    const secondRequest = createRequestFreshUserResolver(loadUser)
    await secondRequest("user-1")

    expect(loadUser).toHaveBeenCalledTimes(2)
  })

  it("shares a fresh read only inside its active protected request", async () => {
    const firstRequestUser = freshUser("user-1")
    const secondRequestUser = freshUser("user-2")
    const firstRequestLoader = vi.fn().mockResolvedValue(firstRequestUser)
    const secondRequestLoader = vi.fn().mockResolvedValue(secondRequestUser)

    const [firstRequestUsers, secondRequestUsers] = await Promise.all([
      withFreshUserRequestScope(
        () =>
          Promise.all([
            getFreshUserState("user-1"),
            getFreshUserState("user-1"),
          ]),
        firstRequestLoader
      ),
      withFreshUserRequestScope(
        () =>
          Promise.all([
            getFreshUserState("user-2"),
            getFreshUserState("user-2"),
          ]),
        secondRequestLoader
      ),
    ])

    expect(firstRequestLoader).toHaveBeenCalledTimes(1)
    expect(secondRequestLoader).toHaveBeenCalledTimes(1)
    expect(firstRequestUsers).toEqual([firstRequestUser, firstRequestUser])
    expect(secondRequestUsers).toEqual([secondRequestUser, secondRequestUser])
    expect(firstRequestUsers[0]).toBe(firstRequestUsers[1])
    expect(secondRequestUsers[0]).toBe(secondRequestUsers[1])
  })
})

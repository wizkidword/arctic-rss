import { AsyncLocalStorage } from "node:async_hooks"

import { getPrisma } from "@/lib/db"

export type FreshUser = {
  authVersion: number
  disabledAt: Date | null
  emailVerified: Date | null
  id: string
  plan: "FREE" | "PRO" | "ADMIN"
  role: "USER" | "ADMIN"
}

type FreshUserLoader = (userId: string) => Promise<FreshUser | null>

const requestFreshUserResolvers = new AsyncLocalStorage<
  ReturnType<typeof createRequestFreshUserResolver>
>()

export function createRequestFreshUserResolver(loadUser: FreshUserLoader) {
  const users = new Map<string, Promise<FreshUser | null>>()

  return (userId: string) => {
    const existing = users.get(userId)
    if (existing) {
      return existing
    }

    const user = loadUser(userId)
    users.set(userId, user)
    return user
  }
}

const loadFreshUserState: FreshUserLoader = (userId) =>
  getPrisma().user.findUnique({
    where: { id: userId },
    select: {
      authVersion: true,
      disabledAt: true,
      emailVerified: true,
      id: true,
      plan: true,
      role: true,
    },
  })

export function withFreshUserRequestScope<T>(
  callback: () => T,
  loadUser: FreshUserLoader = loadFreshUserState
): T {
  if (requestFreshUserResolvers.getStore()) {
    return callback()
  }

  return requestFreshUserResolvers.run(
    createRequestFreshUserResolver(loadUser),
    callback
  )
}

export function getFreshUserState(userId: string): Promise<FreshUser | null> {
  // The resolver exists only while an explicit protected request scope is
  // running. Outside that scope, every call goes straight to the authoritative
  // record, so no user state can survive into a later request.
  return (
    requestFreshUserResolvers.getStore()?.(userId) ??
    loadFreshUserState(userId)
  )
}

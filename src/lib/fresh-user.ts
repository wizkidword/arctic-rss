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

export function getFreshUserState(userId: string) {
  // This check runs from Auth.js callbacks as well as request handlers. React's
  // cache is request-scoped only in a Server Component render and can otherwise
  // retain a stale account state in a long-lived process. Revocation must query
  // the authoritative user record for every protected request.
  return getPrisma().user.findUnique({
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
}

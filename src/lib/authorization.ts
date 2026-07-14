import type { Session } from "next-auth"

import { auth } from "@/auth"
import { getPrisma } from "@/lib/db"

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AuthorizationError"
  }
}

type CurrentUser = {
  authVersion: number
  disabledAt: Date | null
  emailVerified: Date | null
  id: string
  plan: "FREE" | "PRO" | "ADMIN"
  role: "USER" | "ADMIN"
}

export async function requireAuthenticatedUser(): Promise<Session> {
  const session = await auth()

  if (!session?.user?.id || session.user.authVersion === undefined) {
    throw new AuthorizationError("Authentication is required.")
  }

  return session
}

export async function requireFreshUser(
  session?: Session
): Promise<CurrentUser> {
  const authenticatedSession = session ?? (await requireAuthenticatedUser())

  const user = await getPrisma().user.findUnique({
    where: { id: authenticatedSession.user.id },
    select: {
      authVersion: true,
      disabledAt: true,
      emailVerified: true,
      id: true,
      plan: true,
      role: true,
    },
  })

  if (
    !user ||
    user.disabledAt ||
    user.authVersion !== authenticatedSession.user.authVersion ||
    user.role !== authenticatedSession.user.role ||
    user.plan !== authenticatedSession.user.plan
  ) {
    throw new AuthorizationError("Your session is no longer valid.")
  }

  return user
}

export async function requireFreshAdmin(
  session?: Session
): Promise<CurrentUser> {
  const user = await requireFreshUser(session)

  if (user.role !== "ADMIN") {
    throw new AuthorizationError("Administrator access is required.")
  }

  return user
}

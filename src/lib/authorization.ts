import type { Session } from "next-auth"

import { auth } from "@/auth"
import { getFreshUserState, type FreshUser } from "@/lib/fresh-user"

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AuthorizationError"
  }
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
): Promise<FreshUser> {
  const authenticatedSession = session ?? (await requireAuthenticatedUser())

  const user = await getFreshUserState(authenticatedSession.user.id)

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
): Promise<FreshUser> {
  const user = await requireFreshUser(session)

  if (user.role !== "ADMIN") {
    throw new AuthorizationError("Administrator access is required.")
  }

  return user
}

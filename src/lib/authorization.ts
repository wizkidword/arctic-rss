import type { Session } from "next-auth"

import { auth } from "@/auth"
import {
  getFreshUserState,
  type FreshUser,
  withFreshUserRequestScope,
} from "@/lib/fresh-user"

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

export async function withAuthenticatedRequestScope<T>(
  callback: (session: Session) => Promise<T>
): Promise<T> {
  // Auth.js runs its authoritative JWT callback during auth(). Keeping the
  // callback and the subsequent fresh authorization check inside one explicit
  // AsyncLocalStorage scope makes them share one read for this request only.
  return withFreshUserRequestScope(async () => {
    const session = await requireAuthenticatedUser()

    return callback(session)
  })
}

export async function requireFreshUser(
  session?: Session
): Promise<FreshUser> {
  if (!session) {
    return withAuthenticatedRequestScope((authenticatedSession) =>
      requireFreshUser(authenticatedSession)
    )
  }

  const user = await getFreshUserState(session.user.id)

  if (
    !user ||
    user.disabledAt ||
    user.authVersion !== session.user.authVersion ||
    user.role !== session.user.role ||
    user.plan !== session.user.plan
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

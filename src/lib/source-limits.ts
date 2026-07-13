import type { Plan } from "../generated/prisma/enums"

import { getPrisma } from "./db"

export const FREE_PLAN_SOURCE_LIMIT = 200
export const DATABASE_SOURCE_LIMIT_ERROR = "ARCTIC_RSS_SOURCE_LIMIT_REACHED"

type SourceLimitStore = {
  user: {
    findUnique(args: {
      select: {
        _count: {
          select: {
            podcastSubscriptions: true
            subscriptions: true
          }
        }
        plan: true
      }
      where: { id: string }
    }): Promise<{
      _count: {
        podcastSubscriptions: number
        subscriptions: number
      }
      plan: Plan
    } | null>
  }
}

export class SourceLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SourceLimitError"
  }
}

export function isDatabaseSourceLimitError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes(DATABASE_SOURCE_LIMIT_ERROR)
  )
}

// Service-boundary cap check; billing-grade atomicity needs stricter create locking.
export async function assertUserCanAddSource({
  store = getPrisma() as unknown as SourceLimitStore,
  userId,
}: {
  store?: SourceLimitStore
  userId: string
}) {
  const userPlan = await store.user.findUnique({
    where: { id: userId },
    select: {
      plan: true,
      _count: {
        select: {
          subscriptions: true,
          podcastSubscriptions: true,
        },
      },
    },
  })

  if (!userPlan) {
    throw new SourceLimitError("User account was not found.")
  }

  const currentSourceCount =
    userPlan._count.subscriptions + userPlan._count.podcastSubscriptions

  if (userPlan.plan === "FREE" && currentSourceCount >= FREE_PLAN_SOURCE_LIMIT) {
    throw new SourceLimitError(
      `Free accounts can subscribe to up to ${FREE_PLAN_SOURCE_LIMIT} sources.`
    )
  }

  return {
    currentSourceCount,
    limit: FREE_PLAN_SOURCE_LIMIT,
  }
}

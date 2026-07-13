import type { Plan } from "../generated/prisma/enums"

export const SMART_DIGEST_FREE_ENABLED_LIMIT = 1
export const SMART_DIGEST_PRO_ENABLED_LIMIT = 10
export const DATABASE_SMART_DIGEST_LIMIT_ERROR =
  "ARCTIC_RSS_SMART_DIGEST_LIMIT_REACHED"

export function isDatabaseSmartDigestLimitError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes(DATABASE_SMART_DIGEST_LIMIT_ERROR)
  )
}

export function smartDigestEnabledLimitForPlan(plan: Plan) {
  if (plan === "ADMIN") {
    return Number.POSITIVE_INFINITY
  }

  if (plan === "PRO") {
    return SMART_DIGEST_PRO_ENABLED_LIMIT
  }

  return SMART_DIGEST_FREE_ENABLED_LIMIT
}

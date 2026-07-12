import type { Plan } from "../generated/prisma/enums"

export const SMART_DIGEST_FREE_ENABLED_LIMIT = 1
export const SMART_DIGEST_PRO_ENABLED_LIMIT = 10

export function smartDigestEnabledLimitForPlan(plan: Plan) {
  if (plan === "ADMIN") {
    return Number.POSITIVE_INFINITY
  }

  if (plan === "PRO") {
    return SMART_DIGEST_PRO_ENABLED_LIMIT
  }

  return SMART_DIGEST_FREE_ENABLED_LIMIT
}

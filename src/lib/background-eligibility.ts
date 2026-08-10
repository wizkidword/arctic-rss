export type BackgroundEligibilityReason =
  | "eligible"
  | "account-disabled"
  | "account-missing"
  | "email-unverified"
  | "plan-ineligible"

export type BackgroundEligibility = {
  active: boolean
  aiAllowed: boolean
  emailAllowed: boolean
  pushAllowed: boolean
  reason: BackgroundEligibilityReason
}

export type BackgroundEligibilityUser = {
  disabledAt: Date | null
  emailVerified: Date | null
  id: string
  plan: "ADMIN" | "FREE" | "PRO"
}

export type BackgroundEligibilityStore = {
  user: {
    findUnique(args: {
      select: {
        disabledAt: true
        emailVerified: true
        id: true
        plan: true
      }
      where: { id: string }
    }): Promise<BackgroundEligibilityUser | null>
  }
}

export const backgroundEligiblePlans = new Set(["ADMIN", "FREE", "PRO"])

/**
 * Evaluates the current account record for work that can outlive an interactive
 * request. Callers must load this through `getBackgroundEligibility` rather
 * than trusting a job payload, session, or cached plan field.
 */
export function assessBackgroundEligibility(
  user: BackgroundEligibilityUser | null
): BackgroundEligibility {
  if (!user) {
    return deniedEligibility("account-missing")
  }

  if (user.disabledAt) {
    return deniedEligibility("account-disabled")
  }

  if (!backgroundEligiblePlans.has(user.plan)) {
    return deniedEligibility("plan-ineligible")
  }

  if (!user.emailVerified) {
    return {
      active: true,
      aiAllowed: true,
      emailAllowed: false,
      pushAllowed: true,
      reason: "email-unverified",
    }
  }

  return {
    active: true,
    aiAllowed: true,
    emailAllowed: true,
    pushAllowed: true,
    reason: "eligible",
  }
}

export async function getBackgroundEligibility({
  store,
  userId,
}: {
  store: BackgroundEligibilityStore
  userId: string
}): Promise<BackgroundEligibility> {
  const user = await store.user.findUnique({
    select: {
      disabledAt: true,
      emailVerified: true,
      id: true,
      plan: true,
    },
    where: { id: userId },
  })

  return assessBackgroundEligibility(user)
}

function deniedEligibility(reason: Exclude<BackgroundEligibilityReason, "eligible">) {
  return {
    active: false,
    aiAllowed: false,
    emailAllowed: false,
    pushAllowed: false,
    reason,
  }
}

"use server"

import { auth } from "@/auth"
import { getPrisma } from "@/lib/db"
import { requestEmailVerification } from "@/lib/email-verification"
import { enforceRateLimit, getRateLimitErrorMessage } from "@/lib/rate-limit"

export type ResendEmailVerificationActionState = {
  message: string
  status: "idle" | "success" | "error"
}

export async function resendEmailVerificationAction(
  _previousState: ResendEmailVerificationActionState,
  _formData: FormData
): Promise<ResendEmailVerificationActionState> {
  // The useActionState contract supplies both arguments; neither affects a resend.
  void _previousState
  void _formData
  const session = await auth()
  if (!session?.user?.id) return { message: "You need to sign in before resending verification.", status: "error" }
  const user = await getPrisma().user.findUnique({
    select: { email: true, emailVerified: true },
    where: { id: session.user.id },
  })
  if (!user) return { message: "We could not find your account. Log in again and retry.", status: "error" }
  if (user.emailVerified) return { message: "Your email is already verified.", status: "success" }
  const rateLimit = await enforceRateLimit({ action: "verification_resend", userId: session.user.id })
  if (!rateLimit.allowed) return { message: getRateLimitErrorMessage(), status: "error" }
  try {
    await requestEmailVerification({ email: user.email, userId: session.user.id })
  } catch (error) {
    console.error("Failed to resend verification email.", error)
    return { message: "We could not send that email right now. Please try again in a few minutes.", status: "error" }
  }
  return { message: "Verification email sent. Check your inbox when it arrives.", status: "success" }
}

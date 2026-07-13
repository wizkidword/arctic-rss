"use server"

import {
  passwordResetRequestSchema,
  requestPasswordReset,
} from "@/lib/password-reset"
import { isPasswordResetEmailConfigured } from "@/lib/mail"
import {
  enforceRateLimit,
  getCurrentRequestIp,
  getRateLimitErrorMessage,
} from "@/lib/rate-limit"
import {
  getTurnstileExpectedHostname,
  getTurnstileTokenFromFormData,
  verifyTurnstileToken,
} from "@/lib/turnstile"

export type ForgotPasswordActionState = {
  status?: "success" | "error"
  message?: string
  errors?: {
    email?: string[]
  }
}

export async function forgotPasswordAction(
  _state: ForgotPasswordActionState,
  formData: FormData
): Promise<ForgotPasswordActionState> {
  const parsed = passwordResetRequestSchema.safeParse({
    email: String(formData.get("email") ?? ""),
  })

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please enter a valid email address.",
      errors: parsed.error.flatten().fieldErrors,
    }
  }

  const ip = await getCurrentRequestIp()
  const rateLimit = await enforceRateLimit({
    account: parsed.data.email,
    action: "password_reset_request",
    ip,
  })

  if (!rateLimit.allowed) {
    return {
      status: "error",
      message: getRateLimitErrorMessage(),
    }
  }

  const turnstile = await verifyTurnstileToken(
    getTurnstileTokenFromFormData(formData),
    {
      expectedAction: "password_reset",
      expectedHostname: getTurnstileExpectedHostname(),
      remoteIp: ip ?? undefined,
    }
  )

  if (!turnstile.success) {
    return {
      status: "error",
      message: "Complete the security check and try again.",
    }
  }

  if (
    process.env.NODE_ENV === "production" &&
    !isPasswordResetEmailConfigured()
  ) {
    return {
      status: "error",
      message:
        "Password reset email is not configured yet. Please contact the site owner.",
    }
  }

  try {
    await requestPasswordReset(parsed.data.email)
  } catch (error) {
    console.error("Failed to request password reset", error)
    return {
      status: "error",
      message:
        "We could not send a reset email right now. Please try again in a moment.",
    }
  }

  return {
    status: "success",
    message:
      "If an account exists for that email, a password reset link has been sent.",
  }
}

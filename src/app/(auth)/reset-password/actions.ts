"use server"

import { redirect } from "next/navigation"

import {
  passwordResetConfirmSchema,
  resetPasswordWithToken,
} from "@/lib/password-reset"
import {
  enforceRateLimit,
  getCurrentRequestIp,
  getRateLimitErrorMessage,
} from "@/lib/rate-limit"

export type ResetPasswordActionState = {
  status?: "error"
  message?: string
  errors?: {
    token?: string[]
    password?: string[]
    confirmPassword?: string[]
  }
}

export async function resetPasswordAction(
  _state: ResetPasswordActionState,
  formData: FormData
): Promise<ResetPasswordActionState> {
  const parsed = passwordResetConfirmSchema.safeParse({
    token: String(formData.get("token") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  })

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      errors: parsed.error.flatten().fieldErrors,
    }
  }

  const rateLimit = await enforceRateLimit({
    action: "password_reset_complete",
    ip: await getCurrentRequestIp(),
    token: parsed.data.token,
  })

  if (!rateLimit.allowed) {
    return {
      status: "error",
      message: getRateLimitErrorMessage(),
    }
  }

  const result = await resetPasswordWithToken({
    token: parsed.data.token,
    password: parsed.data.password,
  })

  if (result.status === "error") {
    return {
      status: "error",
      message:
        "We could not update your password right now. Please try again in a moment.",
    }
  }

  if (result.status !== "reset") {
    return {
      status: "error",
      message:
        "This reset link is invalid or expired. Request a new link and try again.",
      errors: {
        token: ["Request a new password reset link."],
      },
    }
  }

  redirect("/login?reset=1")
}

"use server"

import { redirect } from "next/navigation"

import { getPrisma } from "@/lib/db"
import { requestEmailVerification } from "@/lib/email-verification"
import {
  getSignupSuccessRedirectPath,
  shouldFailSignupWhenVerificationEmailFails,
} from "@/lib/email-verification-policy"
import { hashPassword } from "@/lib/password"
import { notifyAdminsOfNewRegistration } from "@/lib/registration-notifications"
import { defaultUserSettings } from "@/lib/settings"
import { validateSignupInput } from "@/lib/signup"
import {
  getTurnstileTokenFromFormData,
  verifyTurnstileToken,
} from "@/lib/turnstile"

export type SignupActionState = {
  message?: string
  errors?: {
    email?: string[]
    name?: string[]
    password?: string[]
  }
}

export async function signupAction(
  _state: SignupActionState,
  formData: FormData
): Promise<SignupActionState> {
  const parsed = validateSignupInput({
    email: String(formData.get("email") ?? ""),
    name: String(formData.get("name") ?? ""),
    password: String(formData.get("password") ?? ""),
  })

  if (!parsed.success) {
    return {
      message: "Please fix the highlighted fields.",
      errors: parsed.error.flatten().fieldErrors,
    }
  }

  const { email, name, password } = parsed.data
  const prisma = getPrisma()
  const existingUser = await prisma.user.findUnique({ where: { email } })

  if (existingUser) {
    return {
      message: "An account already exists for that email.",
      errors: {
        email: ["Use a different email or log in."],
      },
    }
  }

  const turnstile = await verifyTurnstileToken(
    getTurnstileTokenFromFormData(formData),
    {
      expectedAction: "signup",
    }
  )

  if (!turnstile.success) {
    return {
      message: "Complete the security check and try again.",
    }
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: name || null,
      passwordHash: await hashPassword(password),
      role: "USER",
      plan: "FREE",
      settings: {
        create: defaultUserSettings(),
      },
    },
    select: {
      createdAt: true,
      id: true,
      email: true,
      name: true,
    },
  })

  try {
    await requestEmailVerification({
      userId: user.id,
      email: user.email,
    })
  } catch (error) {
    console.error("Failed to send signup verification email.", error)

    if (shouldFailSignupWhenVerificationEmailFails()) {
      await prisma.user.delete({ where: { id: user.id } }).catch(() => null)

      return {
        message:
          "We could not send the verification email right now. Please try again in a few minutes.",
      }
    }
  }

  try {
    await notifyAdminsOfNewRegistration({
      email: user.email,
      name: user.name,
      registeredAt: user.createdAt,
      source: "credentials",
      userId: user.id,
    })
  } catch (error) {
    console.error("Failed to send admin signup notification.", error)
  }

  redirect(getSignupSuccessRedirectPath())
}

"use server"

import { redirect } from "next/navigation"

import { isAdminEmail, parseAdminEmails } from "@/lib/admin"
import { getPrisma } from "@/lib/db"
import { hashPassword } from "@/lib/password"
import { defaultUserSettings } from "@/lib/settings"
import { validateSignupInput } from "@/lib/signup"

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

  const role = isAdminEmail(email, parseAdminEmails(process.env.ADMIN_EMAILS))
    ? "ADMIN"
    : "USER"

  await prisma.user.create({
    data: {
      email,
      name: name || null,
      passwordHash: await hashPassword(password),
      role,
      plan: role === "ADMIN" ? "ADMIN" : "FREE",
      settings: {
        create: defaultUserSettings(),
      },
    },
  })

  redirect("/login?registered=1")
}

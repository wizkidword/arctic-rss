import { createHash, randomBytes } from "crypto"
import { z } from "zod"

import type { PrismaClient } from "../generated/prisma/client"

import { getPrisma } from "@/lib/db"
import { sendPasswordResetEmail } from "@/lib/mail"
import { hashPassword } from "@/lib/password"

const RESET_TOKEN_BYTES = 32
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000

type PasswordResetStore = Pick<
  PrismaClient,
  "$transaction" | "passwordResetToken" | "user"
>

type PasswordResetDeps = {
  hashPassword?: typeof hashPassword
  now?: Date
  store?: unknown
}

export const passwordResetRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
})

export const passwordResetConfirmSchema = z
  .object({
    token: z.string().trim().min(32).max(512),
    password: z.string().min(8).max(256),
    confirmPassword: z.string().min(8).max(256),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  })

export function normalizePasswordResetEmail(email: string) {
  return email.trim().toLowerCase()
}

export function hashPasswordResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export function createPasswordResetToken() {
  const token = randomBytes(RESET_TOKEN_BYTES).toString("base64url")

  return {
    token,
    tokenHash: hashPasswordResetToken(token),
  }
}

export function getPasswordResetExpiresAt(now = new Date()) {
  return new Date(now.getTime() + RESET_TOKEN_TTL_MS)
}

export function getAppBaseUrl() {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000"

  return baseUrl.replace(/\/+$/, "")
}

export function buildPasswordResetUrl(token: string) {
  const url = new URL("/reset-password", getAppBaseUrl())
  url.searchParams.set("token", token)
  return url.toString()
}

function getStore(store?: unknown) {
  return (store ?? getPrisma()) as PasswordResetStore
}

export async function requestPasswordReset(email: string) {
  const parsed = passwordResetRequestSchema.safeParse({ email })

  if (!parsed.success) {
    return { status: "invalid-email" as const }
  }

  const prisma = getStore()
  const now = new Date()

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      disabledAt: true,
    },
  })

  if (!user?.passwordHash || user.disabledAt) {
    return { status: "accepted" as const, mailStatus: "not-sent" as const }
  }

  await prisma.passwordResetToken.updateMany({
    where: {
      userId: user.id,
      usedAt: null,
    },
    data: {
      usedAt: now,
    },
  })

  const { token, tokenHash } = createPasswordResetToken()

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: getPasswordResetExpiresAt(now),
    },
  })

  const resetUrl = buildPasswordResetUrl(token)
  const mailResult = await sendPasswordResetEmail({
    to: user.email,
    resetUrl,
  })

  return {
    status: "accepted" as const,
    mailStatus: mailResult.status,
  }
}

export async function resetPasswordWithToken({
  token,
  password,
}: {
  token: string
  password: string
}, deps: PasswordResetDeps = {}) {
  const tokenHash = hashPasswordResetToken(token.trim())
  const prisma = getStore(deps.store)
  const now = deps.now ?? new Date()

  try {
    const passwordHash = await (deps.hashPassword ?? hashPassword)(password)
    const result = await prisma.$transaction(async (transaction) => {
      const resetToken = await transaction.passwordResetToken.findUnique({
        where: { tokenHash },
        select: {
          expiresAt: true,
          id: true,
          usedAt: true,
          user: {
            select: {
              disabledAt: true,
              passwordHash: true,
            },
          },
          userId: true,
        },
      })

      if (!resetToken || resetToken.user.disabledAt || !resetToken.user.passwordHash) {
        return { outcome: "invalid", status: "invalid-token" as const }
      }

      if (resetToken.usedAt) {
        return { outcome: "replayed", status: "invalid-token" as const }
      }

      if (resetToken.expiresAt <= now) {
        return { outcome: "expired", status: "invalid-token" as const }
      }

      const claim = await transaction.passwordResetToken.updateMany({
        where: {
          expiresAt: { gt: now },
          id: resetToken.id,
          tokenHash,
          usedAt: null,
          user: {
            is: {
              disabledAt: null,
              id: resetToken.userId,
              passwordHash: { not: null },
            },
          },
        },
        data: { usedAt: now },
      })

      if (claim.count !== 1) {
        return { outcome: "replayed", status: "invalid-token" as const }
      }

      const userUpdate = await transaction.user.updateMany({
        where: {
          disabledAt: null,
          id: resetToken.userId,
          passwordHash: { not: null },
        },
        data: {
          authVersion: { increment: 1 },
          passwordHash,
        },
      })

      if (userUpdate.count !== 1) {
        throw new Error("Password reset user update was not applied.")
      }

      await transaction.passwordResetToken.updateMany({
        where: {
          id: { not: resetToken.id },
          userId: resetToken.userId,
          usedAt: null,
        },
        data: { usedAt: now },
      })

      await transaction.securityEvent.create({
        data: {
          eventType: "PASSWORD_RESET_COMPLETED",
          userId: resetToken.userId,
        },
      })

      return { outcome: "success", status: "reset" as const }
    })

    console.info(
      JSON.stringify({
        event: "auth_token_attempt",
        outcome: result.outcome,
        purpose: "password_reset",
      })
    )

    return { status: result.status }
  } catch {
    console.error("Password reset token transaction failed.")
    console.info(
      JSON.stringify({
        event: "auth_token_attempt",
        outcome: "error",
        purpose: "password_reset",
      })
    )

    return { status: "error" as const }
  }
}

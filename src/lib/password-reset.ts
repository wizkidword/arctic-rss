import { createHash, randomBytes } from "crypto"
import { z } from "zod"

import { getPrisma } from "@/lib/db"
import { sendPasswordResetEmail } from "@/lib/mail"
import { hashPassword } from "@/lib/password"

const RESET_TOKEN_BYTES = 32
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000

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

export async function requestPasswordReset(email: string) {
  const parsed = passwordResetRequestSchema.safeParse({ email })

  if (!parsed.success) {
    return { status: "invalid-email" as const }
  }

  const prisma = getPrisma()
  const now = new Date()

  await prisma.passwordResetToken.deleteMany({
    where: {
      expiresAt: {
        lt: now,
      },
    },
  })

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
}) {
  const tokenHash = hashPasswordResetToken(token.trim())
  const prisma = getPrisma()
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: {
          id: true,
          disabledAt: true,
        },
      },
    },
  })

  if (
    !resetToken ||
    resetToken.usedAt ||
    resetToken.expiresAt <= new Date() ||
    resetToken.user.disabledAt
  ) {
    return { status: "invalid-token" as const }
  }

  const now = new Date()
  const passwordHash = await hashPassword(password)

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: {
        authVersion: { increment: 1 },
        passwordHash,
      },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: now },
    }),
    prisma.passwordResetToken.updateMany({
      where: {
        userId: resetToken.userId,
        usedAt: null,
        id: {
          not: resetToken.id,
        },
      },
      data: { usedAt: now },
    }),
  ])

  return { status: "reset" as const }
}

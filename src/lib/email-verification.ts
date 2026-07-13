import { createHash, randomBytes } from "crypto"

import type { PrismaClient } from "../generated/prisma/client"

import { getPrisma } from "@/lib/db"
import {
  sendEmailVerificationEmail,
  sendWelcomeEmail,
} from "@/lib/mail"
import { getAppBaseUrl } from "@/lib/password-reset"

const EMAIL_VERIFICATION_TOKEN_BYTES = 32
const EMAIL_VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000

type EmailVerificationStore = Pick<
  PrismaClient,
  "$transaction" | "emailVerificationToken"
>

type EmailVerificationRequestInput = {
  userId: string
  email: string
}

type EmailVerificationDeps = {
  now?: Date
  store?: unknown
  sendVerificationEmail?: typeof sendEmailVerificationEmail
  sendWelcomeEmail?: typeof sendWelcomeEmail
}

export function hashEmailVerificationToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export function createEmailVerificationToken() {
  const token = randomBytes(EMAIL_VERIFICATION_TOKEN_BYTES).toString(
    "base64url"
  )

  return {
    token,
    tokenHash: hashEmailVerificationToken(token),
  }
}

export function getEmailVerificationExpiresAt(now = new Date()) {
  return new Date(now.getTime() + EMAIL_VERIFICATION_TOKEN_TTL_MS)
}

export function buildEmailVerificationUrl(token: string) {
  const url = new URL("/verify-email", getAppBaseUrl())
  url.searchParams.set("token", token)
  return url.toString()
}

export function buildEmailVerificationLoginUrl(
  status: "verified" | "verifyError"
) {
  const url = new URL("/login", getAppBaseUrl())
  url.searchParams.set(status, "1")
  return url.toString()
}

function getStore(store?: unknown) {
  return (store ?? getPrisma()) as EmailVerificationStore
}

export async function requestEmailVerification(
  { userId, email }: EmailVerificationRequestInput,
  deps: EmailVerificationDeps = {}
) {
  const store = getStore(deps.store)
  const now = deps.now ?? new Date()

  await store.emailVerificationToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: now },
  })

  const { token, tokenHash } = createEmailVerificationToken()

  await store.emailVerificationToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt: getEmailVerificationExpiresAt(now),
    },
  })

  const mailResult = await (
    deps.sendVerificationEmail ?? sendEmailVerificationEmail
  )({
    to: email,
    verificationUrl: buildEmailVerificationUrl(token),
  })

  return { status: mailResult.status }
}

export async function verifyEmailWithToken(
  token: string,
  deps: EmailVerificationDeps = {}
) {
  const normalizedToken = token.trim()

  if (normalizedToken.length < 32) {
    return { status: "invalid-token" as const }
  }

  const now = deps.now ?? new Date()
  const store = getStore(deps.store)
  const tokenHash = hashEmailVerificationToken(normalizedToken)
  let result: {
    email?: string
    outcome: "error" | "expired" | "invalid" | "replayed" | "success"
    shouldSendWelcome?: boolean
    status: "invalid-token" | "verified"
  }

  try {
    result = await store.$transaction(async (transaction) => {
      const verificationToken =
        await transaction.emailVerificationToken.findUnique({
          where: { tokenHash },
          select: {
            expiresAt: true,
            id: true,
            usedAt: true,
            user: {
              select: {
                disabledAt: true,
                email: true,
                emailVerified: true,
                id: true,
              },
            },
            userId: true,
          },
        })

      if (!verificationToken || verificationToken.user.disabledAt) {
        return { outcome: "invalid", status: "invalid-token" as const }
      }

      if (verificationToken.usedAt) {
        return { outcome: "replayed", status: "invalid-token" as const }
      }

      if (verificationToken.expiresAt <= now) {
        return { outcome: "expired", status: "invalid-token" as const }
      }

      const claim = await transaction.emailVerificationToken.updateMany({
        where: {
          expiresAt: { gt: now },
          id: verificationToken.id,
          tokenHash,
          usedAt: null,
          user: {
            is: {
              disabledAt: null,
              id: verificationToken.userId,
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
          id: verificationToken.userId,
        },
        data: {
          emailVerified: verificationToken.user.emailVerified ?? now,
        },
      })

      if (userUpdate.count !== 1) {
        throw new Error("Email verification user update was not applied.")
      }

      await transaction.emailVerificationToken.updateMany({
        where: {
          id: { not: verificationToken.id },
          userId: verificationToken.userId,
          usedAt: null,
        },
        data: { usedAt: now },
      })

      await transaction.securityEvent.create({
        data: {
          eventType: "EMAIL_VERIFICATION_COMPLETED",
          userId: verificationToken.userId,
        },
      })

      return {
        email: verificationToken.user.email,
        outcome: "success" as const,
        shouldSendWelcome: !verificationToken.user.emailVerified,
        status: "verified" as const,
      }
    })
  } catch {
    console.error("Email verification token transaction failed.")
    console.info(
      JSON.stringify({
        event: "auth_token_attempt",
        outcome: "error",
        purpose: "email_verification",
      })
    )

    return { status: "invalid-token" as const }
  }

  console.info(
    JSON.stringify({
      event: "auth_token_attempt",
      outcome: result.outcome,
      purpose: "email_verification",
    })
  )

  if (result.status === "verified" && result.shouldSendWelcome && result.email) {
    try {
      await (deps.sendWelcomeEmail ?? sendWelcomeEmail)({
        to: result.email,
      })
    } catch {
      console.error("Failed to send welcome email after verification.")
    }
  }

  return { status: result.status }
}

import { createHash, randomBytes } from "crypto"

import { getPrisma } from "@/lib/db"
import {
  sendEmailVerificationEmail,
  sendWelcomeEmail,
} from "@/lib/mail"
import { getAppBaseUrl } from "@/lib/password-reset"

const EMAIL_VERIFICATION_TOKEN_BYTES = 32
const EMAIL_VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000

type EmailVerificationTokenRecord = {
  id: string
  userId: string
  usedAt: Date | null
  expiresAt: Date
  user: {
    id: string
    email: string
    emailVerified: Date | null
    disabledAt: Date | null
  }
}

type EmailVerificationStore = {
  emailVerificationToken: {
    deleteMany(input: unknown): Promise<unknown>
    updateMany(input: unknown): Promise<unknown>
    create(input: unknown): Promise<unknown>
    findUnique(input: unknown): Promise<EmailVerificationTokenRecord | null>
    update(input: unknown): Promise<unknown>
  }
  user: {
    update(input: unknown): Promise<unknown>
  }
  $transaction(operations: unknown[]): Promise<unknown>
}

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

  await store.emailVerificationToken.deleteMany({
    where: { expiresAt: { lt: now } },
  })

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
  const verificationToken =
    await store.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            emailVerified: true,
            disabledAt: true,
          },
        },
      },
    })

  if (
    !verificationToken ||
    verificationToken.usedAt ||
    verificationToken.expiresAt <= now ||
    verificationToken.user.disabledAt
  ) {
    return { status: "invalid-token" as const }
  }

  await store.$transaction([
    store.user.update({
      where: { id: verificationToken.user.id },
      data: { emailVerified: verificationToken.user.emailVerified ?? now },
    }),
    store.emailVerificationToken.update({
      where: { id: verificationToken.id },
      data: { usedAt: now },
    }),
    store.emailVerificationToken.updateMany({
      where: {
        userId: verificationToken.userId,
        usedAt: null,
        id: { not: verificationToken.id },
      },
      data: { usedAt: now },
    }),
  ])

  if (!verificationToken.user.emailVerified) {
    try {
      await (deps.sendWelcomeEmail ?? sendWelcomeEmail)({
        to: verificationToken.user.email,
      })
    } catch (error) {
      console.error("Failed to send welcome email after verification.", error)
    }
  }

  return { status: "verified" as const }
}

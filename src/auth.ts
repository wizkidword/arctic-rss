import { PrismaAdapter } from "@auth/prisma-adapter"
import NextAuth, { CredentialsSignin, type NextAuthConfig } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google, { type GoogleProfile } from "next-auth/providers/google"
import { z } from "zod"

import { getPrisma } from "@/lib/db"
import { shouldBlockLoginForUnverifiedEmail } from "@/lib/email-verification-policy"
import { isGoogleAuthConfigured } from "@/lib/google-auth"
import { sendWelcomeEmail } from "@/lib/mail"
import { applyVerifiedOAuthDefaults } from "@/lib/oauth-user-provisioning"
import { verifyPassword } from "@/lib/password"
import { notifyAdminsOfNewRegistration } from "@/lib/registration-notifications"
import { verifyTurnstileToken } from "@/lib/turnstile"

type AppRole = "USER" | "ADMIN"
type AppPlan = "FREE" | "PRO" | "ADMIN"

type AppUser = {
  authVersion?: number
  plan?: AppPlan
  role?: AppRole
}

class EmailUnverifiedSigninError extends CredentialsSignin {
  code = "email_unverified"
}

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
  turnstileToken: z.string().optional(),
})

function isVerifiedGoogleProfile(
  profile: unknown
): profile is GoogleProfile {
  return (
    typeof profile === "object" &&
    profile !== null &&
    (profile as GoogleProfile).email_verified === true
  )
}

async function sendWelcomeEmailSafely(email: string) {
  try {
    await sendWelcomeEmail({ to: email })
  } catch (error) {
    console.error("Failed to send welcome email.", error)
  }
}

async function notifyAdminsOfNewRegistrationSafely({
  email,
  name,
  userId,
}: {
  email: string
  name: string | null | undefined
  userId: string
}) {
  try {
    await notifyAdminsOfNewRegistration({
      email: email.trim().toLowerCase(),
      name: name ?? null,
      registeredAt: new Date(),
      source: "google",
      userId,
    })
  } catch (error) {
    console.error("Failed to send admin signup notification.", error)
  }
}

function credentialsProvider() {
  return Credentials({
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
      turnstileToken: { label: "Turnstile token", type: "text" },
    },
    async authorize(credentials) {
      const parsed = credentialsSchema.safeParse(credentials)

      if (!parsed.success) {
        return null
      }

      const turnstile = await verifyTurnstileToken(
        parsed.data.turnstileToken,
        {
          expectedAction: "login",
        }
      )

      if (!turnstile.success) {
        return null
      }

      const user = await getPrisma().user.findUnique({
        where: { email: parsed.data.email },
      })

      if (!user?.passwordHash || user.disabledAt) {
        return null
      }

      const validPassword = await verifyPassword(
        parsed.data.password,
        user.passwordHash
      )

      if (!validPassword) {
        return null
      }

      if (shouldBlockLoginForUnverifiedEmail(user.emailVerified)) {
        throw new EmailUnverifiedSigninError()
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        authVersion: user.authVersion,
        role: user.role,
        plan: user.plan,
      }
    },
  })
}

function googleProvider() {
  if (!isGoogleAuthConfigured()) {
    return []
  }

  return [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
  ]
}

function createAuthConfig(): NextAuthConfig {
  const googleAuthConfigured = isGoogleAuthConfigured()

  return {
    ...(googleAuthConfigured
      ? {
          adapter: PrismaAdapter(
            getPrisma() as unknown as Parameters<typeof PrismaAdapter>[0]
          ),
        }
      : {}),
    pages: {
      error: "/login",
      signIn: "/login",
    },
    // Auth.js requires this flag. Its request URL is pinned by AUTH_URL, and
    // Next's proxy rejects any request host outside the explicit allowlist.
    trustHost: true,
    session: {
      strategy: "jwt",
    },
    providers: [credentialsProvider(), ...googleProvider()],
    callbacks: {
      async signIn({ account, profile }) {
        if (account?.provider === "google") {
          return isVerifiedGoogleProfile(profile)
        }

        return true
      },
      async jwt({ token, user }) {
        if (user) {
          const appUser = user as typeof user & AppUser

          token.id = user.id
          token.authVersion = appUser.authVersion
          token.role = appUser.role
          token.plan = appUser.plan
        }

        if (token.id) {
          const dbUser = await getPrisma().user.findUnique({
            where: { id: String(token.id) },
            select: {
              authVersion: true,
              disabledAt: true,
              role: true,
              plan: true,
            },
          })

          if (
            !dbUser ||
            dbUser.disabledAt ||
            token.authVersion !== dbUser.authVersion
          ) {
            token.revoked = true
          } else {
            token.authVersion = dbUser.authVersion
            token.role = dbUser.role
            token.plan = dbUser.plan
          }
        }

        return token
      },
      session({ session, token }) {
        if (
          token.revoked ||
          !token.id ||
          typeof token.authVersion !== "number"
        ) {
          delete (session as { user?: unknown }).user
          return session
        }

        if (session.user) {
          session.user.authVersion = token.authVersion
          session.user.id = String(token.id)
          session.user.role = token.role as AppRole
          session.user.plan = token.plan as AppPlan
        }

        return session
      },
    },
    events: {
      async createUser({ user }) {
        if (!user.id || !user.email) {
          return
        }

        await applyVerifiedOAuthDefaults({
          onFirstVerification: sendWelcomeEmailSafely,
          store: getPrisma(),
          userId: user.id,
          email: user.email,
        })
        await notifyAdminsOfNewRegistrationSafely({
          userId: user.id,
          email: user.email,
          name: user.name,
        })
      },
      async linkAccount({ user, account, profile }) {
        if (
          account.provider !== "google" ||
          !user.id ||
          !user.email ||
          !isVerifiedGoogleProfile(profile)
        ) {
          return
        }

        await applyVerifiedOAuthDefaults({
          onFirstVerification: sendWelcomeEmailSafely,
          store: getPrisma(),
          userId: user.id,
          email: user.email,
        })
      },
    },
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth(() =>
  createAuthConfig()
)

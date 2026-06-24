import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { z } from "zod"

import { getPrisma } from "@/lib/db"
import { verifyPassword } from "@/lib/password"

type AppRole = "USER" | "ADMIN"
type AppPlan = "FREE" | "PRO" | "ADMIN"

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  pages: {
    signIn: "/login",
  },
  trustHost: true,
  session: {
    strategy: "jwt",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials)

        if (!parsed.success) {
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

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          plan: user.plan,
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.plan = user.plan
      }

      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id)
        session.user.role = token.role as AppRole
        session.user.plan = token.plan as AppPlan
      }

      return session
    },
  },
})

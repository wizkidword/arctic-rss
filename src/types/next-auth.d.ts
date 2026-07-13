import type { DefaultSession } from "next-auth"

type Role = "USER" | "ADMIN"
type Plan = "FREE" | "PRO" | "ADMIN"

declare module "next-auth" {
  interface Session {
    user: {
      authVersion?: number
      id: string
      role: Role
      plan: Plan
    } & DefaultSession["user"]
  }

  interface User {
    authVersion?: number
    role: Role
    plan: Plan
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    authVersion?: number
    id: string
    role: Role
    plan: Plan
    revoked?: boolean
  }
}

import type { DefaultSession } from "next-auth"

type Role = "USER" | "ADMIN"
type Plan = "FREE" | "PRO" | "ADMIN"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: Role
      plan: Plan
    } & DefaultSession["user"]
  }

  interface User {
    role: Role
    plan: Plan
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: Role
    plan: Plan
  }
}

import { PrismaAdapter } from "@auth/prisma-adapter"
import type { Adapter, AdapterAccount } from "next-auth/adapters"

import type { PrismaClient } from "../generated/prisma/client"

export function oauthAccountIdentity(account: AdapterAccount) {
  return {
    provider: account.provider,
    providerAccountId: account.providerAccountId,
    type: account.type,
    userId: account.userId,
  }
}

export function createTokenMinimizingPrismaAdapter(
  prisma: PrismaClient
): Adapter {
  const adapter = PrismaAdapter(
    prisma as unknown as Parameters<typeof PrismaAdapter>[0]
  )

  return {
    ...adapter,
    async linkAccount(account) {
      await prisma.account.create({
        data: oauthAccountIdentity(account),
      })
    },
  }
}

import type { AdapterAccount } from "next-auth/adapters"
import { describe, expect, it, vi } from "vitest"

import type { PrismaClient } from "../generated/prisma/client"
import {
  createTokenMinimizingPrismaAdapter,
  oauthAccountIdentity,
} from "./oauth-account-storage"

const oauthAccount = {
  access_token: "access-token-that-must-not-be-persisted",
  expires_at: 1_700_000_000,
  id_token: "id-token-that-must-not-be-persisted",
  provider: "google",
  providerAccountId: "google-account-id",
  refresh_token: "refresh-token-that-must-not-be-persisted",
  scope: "openid email profile",
  session_state: "session-state-that-must-not-be-persisted",
  token_type: "bearer",
  type: "oidc",
  userId: "user-id",
} as AdapterAccount

describe("OAuth account storage", () => {
  it("keeps only the identity link from an OAuth account", () => {
    expect(oauthAccountIdentity(oauthAccount)).toEqual({
      provider: "google",
      providerAccountId: "google-account-id",
      type: "oidc",
      userId: "user-id",
    })
  })

  it("writes only the identity link through the Prisma adapter", async () => {
    const create = vi.fn().mockResolvedValue(undefined)
    const adapter = createTokenMinimizingPrismaAdapter({
      account: { create },
    } as unknown as PrismaClient)

    await adapter.linkAccount?.(oauthAccount)

    expect(create).toHaveBeenCalledWith({
      data: {
        provider: "google",
        providerAccountId: "google-account-id",
        type: "oidc",
        userId: "user-id",
      },
    })
  })
})

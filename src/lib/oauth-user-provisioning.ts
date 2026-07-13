import type { PrismaClient } from "../generated/prisma/client"

import { defaultUserSettings } from "./settings"

type OAuthUserStore = Pick<PrismaClient, "user">

export async function applyVerifiedOAuthDefaults({
  email,
  onFirstVerification,
  store,
  userId,
}: {
  email: string
  onFirstVerification: (email: string) => Promise<void>
  store: OAuthUserStore
  userId: string
}) {
  const normalizedEmail = email.trim().toLowerCase()
  const previous = await store.user.findUnique({
    where: { id: userId },
    select: {
      emailVerified: true,
    },
  })

  await store.user.update({
    where: { id: userId },
    data: {
      email: normalizedEmail,
      emailVerified: previous?.emailVerified ?? new Date(),
      settings: {
        upsert: {
          create: defaultUserSettings(),
          update: {},
        },
      },
    },
  })

  if (!previous?.emailVerified) {
    await onFirstVerification(normalizedEmail)
  }
}

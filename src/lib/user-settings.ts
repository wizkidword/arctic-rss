import { defaultUserSettings } from "@/lib/settings"

import { Prisma } from "../generated/prisma/client"
import { getPrisma } from "./db"

export async function getOrCreateUserSettings(userId: string) {
  const defaults = defaultUserSettings()

  const prisma = getPrisma()

  try {
    return await prisma.userSettings.upsert({
      where: { userId },
      create: {
        userId,
        ...defaults,
      },
      update: {},
    })
  } catch (error) {
    // Multiple layouts can request defaults during a first authenticated render.
    // If another request won the unique insert race, return that durable row.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const settings = await prisma.userSettings.findUnique({
        where: { userId },
      })

      if (settings) {
        return settings
      }
    }

    throw error
  }
}

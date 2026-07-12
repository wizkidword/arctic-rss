import { defaultUserSettings } from "@/lib/settings"

import { getPrisma } from "./db"

export async function getOrCreateUserSettings(userId: string) {
  const defaults = defaultUserSettings()

  return getPrisma().userSettings.upsert({
    where: { userId },
    create: {
      userId,
      ...defaults,
    },
    update: {},
  })
}

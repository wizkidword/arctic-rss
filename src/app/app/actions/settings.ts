"use server"

import { refresh, revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { getPrisma } from "@/lib/db"
import { isDefaultView, type DefaultView } from "@/lib/preferences"
import {
  isDateFormatPreference,
  isDisplayMode,
  isSupportedTimeZone,
  isThemePreference,
  isTimeFormatPreference,
  type DateTimePreferences,
  type DisplayMode,
  type ThemePreference,
} from "@/lib/settings"

export async function updateDefaultView(defaultView: DefaultView) {
  const session = await auth()

  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }

  if (!isDefaultView(defaultView)) {
    throw new Error("Unsupported reader view")
  }

  await getPrisma().userSettings.upsert({
    where: { userId: session.user.id },
    create: { defaultView, userId: session.user.id },
    update: { defaultView },
  })

  revalidatePath("/app")
}

export async function updateThemePreference(theme: ThemePreference) {
  const session = await auth()

  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }

  if (!isThemePreference(theme)) {
    throw new Error("Unsupported theme preference")
  }

  await getPrisma().userSettings.upsert({
    where: { userId: session.user.id },
    create: { theme, userId: session.user.id },
    update: { theme },
  })

  revalidatePath("/app", "layout")
  revalidatePath("/app/settings")
  refresh()
}

export async function updateDisplayMode(displayMode: DisplayMode) {
  const session = await auth()

  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }

  if (!isDisplayMode(displayMode)) {
    throw new Error("Unsupported display mode")
  }

  await getPrisma().userSettings.upsert({
    where: { userId: session.user.id },
    create: { displayMode, userId: session.user.id },
    update: { displayMode },
  })

  revalidatePath("/app", "layout")
  revalidatePath("/app/settings")
  refresh()
}

export async function updateDateTimePreferences({
  dateFormat,
  timeFormat,
  timeZone,
}: DateTimePreferences) {
  const session = await auth()

  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }

  if (
    !isDateFormatPreference(dateFormat) ||
    !isTimeFormatPreference(timeFormat) ||
    !isSupportedTimeZone(timeZone)
  ) {
    throw new Error("Unsupported date and time preference")
  }

  await getPrisma().userSettings.upsert({
    where: { userId: session.user.id },
    create: { dateFormat, timeFormat, timeZone, userId: session.user.id },
    update: { dateFormat, timeFormat, timeZone },
  })

  revalidatePath("/app", "layout")
  revalidatePath("/app/settings")
  refresh()
}

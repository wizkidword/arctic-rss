"use client"

import { useEffect } from "react"

import { type ThemePreference } from "@/lib/settings"
import {
  applyThemePreferenceToDocument,
  subscribeToSystemThemeChanges,
} from "@/lib/theme-dom"

export function AppShellThemeController({
  themePreference,
}: {
  themePreference: ThemePreference
}) {
  useEffect(() => {
    applyThemePreferenceToDocument(themePreference)

    if (themePreference !== "SYSTEM") {
      return
    }

    return subscribeToSystemThemeChanges(() => {
      applyThemePreferenceToDocument(themePreference)
    })
  }, [themePreference])

  return null
}

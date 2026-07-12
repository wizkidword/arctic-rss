import {
  isDarkThemePreference,
  type ReaderThemePreference,
  type ThemePreference,
} from "@/lib/settings"

const darkSchemeQuery = "(prefers-color-scheme: dark)"

export function resolveThemePreference({
  systemPrefersDark,
  themePreference,
}: {
  systemPrefersDark: boolean
  themePreference: ThemePreference
}) {
  return isDarkThemePreference(
    resolveReaderThemePreference({
      systemPrefersDark,
      themePreference,
    })
  )
}

export function resolveReaderThemePreference({
  systemPrefersDark,
  themePreference,
}: {
  systemPrefersDark: boolean
  themePreference: ThemePreference
}): ReaderThemePreference {
  if (themePreference === "SYSTEM") {
    return systemPrefersDark ? "DARK" : "LIGHT"
  }

  return themePreference
}

export function applyThemePreferenceToDocument(
  themePreference: ThemePreference
) {
  if (typeof document === "undefined") {
    return
  }

  const systemPrefersDark =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(darkSchemeQuery).matches
  const readerTheme = resolveReaderThemePreference({
    systemPrefersDark,
    themePreference,
  })
  const isDark = isDarkThemePreference(readerTheme)

  document.documentElement.classList.toggle("dark", isDark)
  document.documentElement.dataset.themePreference =
    themePreference.toLowerCase()
  document.documentElement.dataset.readerTheme = readerTheme.toLowerCase()
  document.documentElement.style.colorScheme = isDark ? "dark" : "light"
}

export function subscribeToSystemThemeChanges(
  onChange: () => void
): (() => void) | undefined {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return undefined
  }

  const media = window.matchMedia(darkSchemeQuery)
  media.addEventListener("change", onChange)

  return () => media.removeEventListener("change", onChange)
}

import { DEFAULT_VIEW, type DefaultView } from "./preferences"

export type ThemePreference = "SYSTEM" | "LIGHT" | "DARK"
export type FontSizePreference = "SMALL" | "MEDIUM" | "LARGE"

export type UserSettingsDefaults = {
  defaultView: DefaultView
  theme: ThemePreference
  fontSize: FontSizePreference
  markReadOnOpen: boolean
  openLinksInNewTab: boolean
  aiAutoSummariesEnabled: boolean
  dailyDigestEnabled: boolean
}

export function defaultUserSettings(): UserSettingsDefaults {
  return {
    defaultView: DEFAULT_VIEW,
    theme: "SYSTEM",
    fontSize: "MEDIUM",
    markReadOnOpen: true,
    openLinksInNewTab: true,
    aiAutoSummariesEnabled: false,
    dailyDigestEnabled: false,
  }
}

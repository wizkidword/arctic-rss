import { DEFAULT_VIEW, type DefaultView } from "./preferences"

export type DisplayMode = "MINIMAL" | "READER" | "THREE_PANE"
export type ThemePreference =
  | "SYSTEM"
  | "LIGHT"
  | "HOLIDAY"
  | "ORANGE"
  | "SAND"
  | "DARK"
  | "GREY"
export type ReaderThemePreference = Exclude<ThemePreference, "SYSTEM">
export type FontSizePreference = "SMALL" | "MEDIUM" | "LARGE"
export type DateFormatPreference =
  | "DEFAULT"
  | "YYYY_MM_DD"
  | "YYYY_DOT_MM_DD"
  | "YYYY_SLASH_MM_DD"
  | "YYYY_DD_MM"
  | "DD_MM_YYYY"
  | "MM_DD_YYYY"
export type TimeFormatPreference = "DEFAULT" | "HOUR_24" | "HOUR_12"

export const DISPLAY_MODE_OPTIONS = ["MINIMAL", "READER", "THREE_PANE"] as const
export const READER_THEME_OPTIONS = [
  "LIGHT",
  "HOLIDAY",
  "ORANGE",
  "SAND",
  "DARK",
  "GREY",
] as const
export const THEME_OPTIONS = ["SYSTEM", ...READER_THEME_OPTIONS] as const
export const DATE_FORMAT_OPTIONS = [
  "DEFAULT",
  "YYYY_MM_DD",
  "YYYY_DOT_MM_DD",
  "YYYY_SLASH_MM_DD",
  "YYYY_DD_MM",
  "DD_MM_YYYY",
  "MM_DD_YYYY",
] as const
export const TIME_FORMAT_OPTIONS = ["DEFAULT", "HOUR_24", "HOUR_12"] as const
export const TIME_ZONE_OPTIONS = [
  { label: "UTC", value: "UTC" },
  { label: "Eastern Time", value: "America/New_York" },
  { label: "Central Time", value: "America/Chicago" },
  { label: "Mountain Time", value: "America/Denver" },
  { label: "Pacific Time", value: "America/Los_Angeles" },
  { label: "Alaska Time", value: "America/Anchorage" },
  { label: "Hawaii Time", value: "Pacific/Honolulu" },
  { label: "London", value: "Europe/London" },
  { label: "Berlin", value: "Europe/Berlin" },
  { label: "Tokyo", value: "Asia/Tokyo" },
  { label: "Sydney", value: "Australia/Sydney" },
] as const

export type SupportedTimeZone = (typeof TIME_ZONE_OPTIONS)[number]["value"]

export const displayModeLabels: Record<DisplayMode, string> = {
  MINIMAL: "Minimal",
  READER: "Reader",
  THREE_PANE: "3-pane",
}

export const displayModeDescriptions: Record<DisplayMode, string> = {
  MINIMAL: "Collapsed navigation",
  READER: "Inline article stream",
  THREE_PANE: "Navigation, list, and detail panes",
}

export const themePreferenceLabels: Record<ThemePreference, string> = {
  DARK: "Dark",
  GREY: "Grey",
  HOLIDAY: "Holiday",
  LIGHT: "Light",
  ORANGE: "Orange",
  SAND: "Sand",
  SYSTEM: "System",
}

export const dateFormatPreferenceLabels: Record<DateFormatPreference, string> = {
  DD_MM_YYYY: "dd/mm/yyyy",
  DEFAULT: "Default (6/27/2026)",
  MM_DD_YYYY: "mm/dd/yyyy",
  YYYY_DD_MM: "yyyy/dd/mm",
  YYYY_DOT_MM_DD: "yyyy.mm.dd",
  YYYY_MM_DD: "yyyy-mm-dd",
  YYYY_SLASH_MM_DD: "yyyy/mm/dd",
}

export const timeFormatPreferenceLabels: Record<TimeFormatPreference, string> = {
  DEFAULT: "Default (09:00 AM)",
  HOUR_12: "12h (am/pm)",
  HOUR_24: "24h",
}

export type DateTimePreferences = {
  dateFormat: DateFormatPreference
  timeFormat: TimeFormatPreference
  timeZone: SupportedTimeZone
}

export type UserSettingsDefaults = {
  defaultView: DefaultView
  displayMode: DisplayMode
  theme: ThemePreference
  fontSize: FontSizePreference
  dateFormat: DateFormatPreference
  timeFormat: TimeFormatPreference
  timeZone: SupportedTimeZone
  markReadOnOpen: boolean
  openLinksInNewTab: boolean
  aiAutoSummariesEnabled: boolean
  dailyDigestEnabled: boolean
}

export function defaultUserSettings(): UserSettingsDefaults {
  return {
    defaultView: DEFAULT_VIEW,
    displayMode: "THREE_PANE",
    theme: "SYSTEM",
    fontSize: "MEDIUM",
    dateFormat: "DEFAULT",
    timeFormat: "DEFAULT",
    timeZone: "UTC",
    markReadOnOpen: true,
    openLinksInNewTab: true,
    aiAutoSummariesEnabled: false,
    dailyDigestEnabled: false,
  }
}

export function isDisplayMode(value: unknown): value is DisplayMode {
  return (
    typeof value === "string" &&
    DISPLAY_MODE_OPTIONS.includes(value as DisplayMode)
  )
}

export function normalizeDisplayMode(value: unknown): DisplayMode {
  return isDisplayMode(value) ? value : "THREE_PANE"
}

export function isThemePreference(
  value: unknown
): value is ThemePreference {
  return (
    typeof value === "string" &&
    THEME_OPTIONS.includes(value as ThemePreference)
  )
}

export function normalizeThemePreference(value: unknown): ThemePreference {
  return isThemePreference(value) ? value : "SYSTEM"
}

export function isDarkThemePreference(value: ThemePreference) {
  return value === "DARK" || value === "GREY"
}

export function isDateFormatPreference(
  value: unknown
): value is DateFormatPreference {
  return (
    typeof value === "string" &&
    DATE_FORMAT_OPTIONS.includes(value as DateFormatPreference)
  )
}

export function isTimeFormatPreference(
  value: unknown
): value is TimeFormatPreference {
  return (
    typeof value === "string" &&
    TIME_FORMAT_OPTIONS.includes(value as TimeFormatPreference)
  )
}

export function isSupportedTimeZone(value: unknown): value is SupportedTimeZone {
  return (
    typeof value === "string" &&
    TIME_ZONE_OPTIONS.some((option) => option.value === value)
  )
}

export function normalizeDateTimePreferences(
  value: Partial<{
    dateFormat: unknown
    timeFormat: unknown
    timeZone: unknown
  }> | null | undefined
): DateTimePreferences {
  return {
    dateFormat: isDateFormatPreference(value?.dateFormat)
      ? value.dateFormat
      : "DEFAULT",
    timeFormat: isTimeFormatPreference(value?.timeFormat)
      ? value.timeFormat
      : "DEFAULT",
    timeZone: isSupportedTimeZone(value?.timeZone) ? value.timeZone : "UTC",
  }
}

export function formatArticleDateTime(
  date: Date,
  preferences: Partial<DateTimePreferences>
) {
  const normalized = normalizeDateTimePreferences(preferences)

  return `${formatDatePart(date, normalized)}, ${formatTimePart(
    date,
    normalized
  )}`
}

function formatDatePart(date: Date, preferences: DateTimePreferences) {
  const { day, month, year } = dateParts(date, preferences.timeZone)

  if (preferences.dateFormat === "YYYY_MM_DD") {
    return `${year}-${month}-${day}`
  }

  if (preferences.dateFormat === "YYYY_DOT_MM_DD") {
    return `${year}.${month}.${day}`
  }

  if (preferences.dateFormat === "YYYY_SLASH_MM_DD") {
    return `${year}/${month}/${day}`
  }

  if (preferences.dateFormat === "YYYY_DD_MM") {
    return `${year}/${day}/${month}`
  }

  if (preferences.dateFormat === "DD_MM_YYYY") {
    return `${day}/${month}/${year}`
  }

  if (preferences.dateFormat === "MM_DD_YYYY") {
    return `${month}/${day}/${year}`
  }

  return `${Number(month)}/${Number(day)}/${year}`
}

function formatTimePart(date: Date, preferences: DateTimePreferences) {
  if (preferences.timeFormat === "HOUR_24") {
    const parts = timeParts(date, preferences.timeZone, false)
    const hour = parts.hour === "24" ? "00" : parts.hour

    return `${hour}:${parts.minute}`
  }

  const parts = timeParts(date, preferences.timeZone, true)

  return `${parts.hour}:${parts.minute} ${parts.dayPeriod}`
}

function dateParts(date: Date, timeZone: SupportedTimeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(date)

  return {
    day: partValue(parts, "day"),
    month: partValue(parts, "month"),
    year: partValue(parts, "year"),
  }
}

function timeParts(date: Date, timeZone: SupportedTimeZone, hour12: boolean) {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hour12,
    hourCycle: hour12 ? undefined : "h23",
    minute: "2-digit",
    timeZone,
  }).formatToParts(date)

  return {
    dayPeriod: partValue(parts, "dayPeriod"),
    hour: partValue(parts, "hour"),
    minute: partValue(parts, "minute"),
  }
}

function partValue(parts: Intl.DateTimeFormatPart[], type: string) {
  return parts.find((part) => part.type === type)?.value ?? ""
}

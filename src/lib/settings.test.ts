import { describe, expect, it } from "vitest"

import {
  defaultUserSettings,
  displayModeLabels,
  formatArticleDateTime,
  isDateFormatPreference,
  isDisplayMode,
  isSupportedTimeZone,
  isTimeFormatPreference,
  isThemePreference,
  normalizeDateTimePreferences,
  normalizeDisplayMode,
  normalizeThemePreference,
  themePreferenceLabels,
} from "./settings"

describe("default user settings", () => {
  it("starts new accounts with classic reader defaults and AI opt-in disabled", () => {
    expect(defaultUserSettings()).toMatchObject({
      defaultView: "CLASSIC",
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
    })
  })
})

describe("display mode preferences", () => {
  it("recognizes supported reader display modes", () => {
    expect(isDisplayMode("MINIMAL")).toBe(true)
    expect(isDisplayMode("READER")).toBe(true)
    expect(isDisplayMode("THREE_PANE")).toBe(true)
    expect(isDisplayMode("MAGAZINE")).toBe(false)
    expect(normalizeDisplayMode("READER")).toBe("READER")
    expect(normalizeDisplayMode("MAGAZINE")).toBe("THREE_PANE")
    expect(displayModeLabels.MINIMAL).toBe("Minimal")
    expect(displayModeLabels.READER).toBe("Reader")
    expect(displayModeLabels.THREE_PANE).toBe("3-pane")
  })
})

describe("theme preferences", () => {
  it("recognizes supported reader theme preferences", () => {
    expect(isThemePreference("SYSTEM")).toBe(true)
    expect(isThemePreference("LIGHT")).toBe(true)
    expect(isThemePreference("HOLIDAY")).toBe(true)
    expect(isThemePreference("ORANGE")).toBe(true)
    expect(isThemePreference("SAND")).toBe(true)
    expect(isThemePreference("DARK")).toBe(true)
    expect(isThemePreference("GREY")).toBe(true)
    expect(isThemePreference("SOLARIZED")).toBe(false)
    expect(normalizeThemePreference("ORANGE")).toBe("ORANGE")
    expect(normalizeThemePreference("SOLARIZED")).toBe("SYSTEM")
    expect(themePreferenceLabels.HOLIDAY).toBe("Holiday")
    expect(themePreferenceLabels.ORANGE).toBe("Orange")
    expect(themePreferenceLabels.SAND).toBe("Sand")
    expect(themePreferenceLabels.DARK).toBe("Dark")
    expect(themePreferenceLabels.GREY).toBe("Grey")
  })
})

describe("date and time preferences", () => {
  it("recognizes supported date, time, and time zone preferences", () => {
    expect(isDateFormatPreference("YYYY_MM_DD")).toBe(true)
    expect(isDateFormatPreference("YYYY-DD-MM")).toBe(false)
    expect(isTimeFormatPreference("HOUR_24")).toBe(true)
    expect(isTimeFormatPreference("MILITARY")).toBe(false)
    expect(isSupportedTimeZone("America/New_York")).toBe(true)
    expect(isSupportedTimeZone("Mars/Base")).toBe(false)
  })

  it("normalizes partial date and time preferences back to safe defaults", () => {
    expect(
      normalizeDateTimePreferences({
        dateFormat: "DD_MM_YYYY",
        timeFormat: "HOUR_24",
        timeZone: "America/New_York",
      })
    ).toEqual({
      dateFormat: "DD_MM_YYYY",
      timeFormat: "HOUR_24",
      timeZone: "America/New_York",
    })

    expect(
      normalizeDateTimePreferences({
        dateFormat: "bad",
        timeFormat: "bad",
        timeZone: "bad",
      })
    ).toEqual({
      dateFormat: "DEFAULT",
      timeFormat: "DEFAULT",
      timeZone: "UTC",
    })
  })

  it("formats article timestamps with the selected date format, time format, and time zone", () => {
    const date = new Date("2026-06-27T13:05:00.000Z")

    expect(
      formatArticleDateTime(date, {
        dateFormat: "YYYY_MM_DD",
        timeFormat: "HOUR_24",
        timeZone: "America/New_York",
      })
    ).toBe("2026-06-27, 09:05")

    expect(
      formatArticleDateTime(date, {
        dateFormat: "DD_MM_YYYY",
        timeFormat: "HOUR_12",
        timeZone: "UTC",
      })
    ).toBe("27/06/2026, 01:05 PM")
  })

  it("formats midnight as 00:00 in 24-hour time", () => {
    expect(
      formatArticleDateTime(new Date("2026-01-01T00:00:00.000Z"), {
        dateFormat: "MM_DD_YYYY",
        timeFormat: "HOUR_24",
        timeZone: "UTC",
      })
    ).toBe("01/01/2026, 00:00")
  })
})

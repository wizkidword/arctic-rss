import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getOrCreateUserSettings: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`)
  }),
}))

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}))

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}))

vi.mock("@/lib/user-settings", () => ({
  getOrCreateUserSettings: mocks.getOrCreateUserSettings,
}))

import SettingsPage from "./page"

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders appearance controls for the signed-in reader", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.getOrCreateUserSettings.mockResolvedValue({
      dateFormat: "DEFAULT",
      displayMode: "THREE_PANE",
      theme: "ORANGE",
      timeFormat: "DEFAULT",
      timeZone: "UTC",
    })

    const markup = renderToStaticMarkup(await SettingsPage())

    expect(mocks.getOrCreateUserSettings).toHaveBeenCalledWith("user-1")
    expect(markup).toContain("Reader Settings")
    expect(markup).toContain("Display mode")
    expect(markup).toContain("Minimal")
    expect(markup).toContain("Reader")
    expect(markup).toContain("3-pane")
    expect(markup).toContain('aria-label="Reader display mode"')
    expect(markup).toContain("Appearance")
    expect(markup).toContain("Follow OS setting")
    expect(markup).toContain("Light")
    expect(markup).toContain("Holiday")
    expect(markup).toContain("Orange")
    expect(markup).toContain("Sand")
    expect(markup).toContain("Dark")
    expect(markup).toContain("Grey")
    expect(markup).toContain('aria-label="Reader theme"')
    expect(markup).toContain("Date &amp; time")
    expect(markup).toContain("Date format")
    expect(markup).toContain("Default (6/27/2026)")
    expect(markup).toContain("24h")
    expect(markup).toContain("Time zone")
    expect(markup).toContain("Eastern Time")
  })

  it("redirects anonymous visitors to login", async () => {
    mocks.auth.mockResolvedValue(null)

    await expect(SettingsPage()).rejects.toThrow("REDIRECT:/login")
  })
})

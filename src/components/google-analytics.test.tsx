/** @vitest-environment jsdom */

import { StrictMode } from "react"
import { render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { GoogleAnalytics } from "./google-analytics"

const navigation = vi.hoisted(() => ({
  pathname: "/",
  searchParams: new URLSearchParams(),
}))

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => navigation.searchParams,
}))

describe("GoogleAnalytics", () => {
  beforeEach(() => {
    window.localStorage.setItem(
      "arcticrss.analytics-consent.v1",
      JSON.stringify({ choice: "accepted", updatedAt: new Date().toISOString() })
    )
  })

  afterEach(() => {
    navigation.pathname = "/"
    navigation.searchParams = new URLSearchParams()
    delete window.dataLayer
    delete window.gtag
    window.localStorage.clear()
    document.getElementById("arctic-rss-google-analytics")?.remove()
  })

  it("does not render markup without a measurement id", () => {
    const { container } = render(<GoogleAnalytics measurementId="" />)

    expect(container.innerHTML).toBe("")
  })

  it("does not load or queue analytics without affirmative consent", () => {
    window.localStorage.clear()

    render(<GoogleAnalytics measurementId="G-ABC123XYZ9" />)

    expect(window.gtag).toBeUndefined()
    expect(window.dataLayer).toBeUndefined()
    expect(document.getElementById("arctic-rss-google-analytics")).toBeNull()
  })

  it("queues the initial page view and loads Google Analytics after consent", () => {
    window.gtag = vi.fn()

    const { container } = render(
      <StrictMode>
        <GoogleAnalytics measurementId="G-ABC123XYZ9" />
      </StrictMode>
    )

    expect(container.innerHTML).toBe("")
    expect(window.gtag).toHaveBeenCalledTimes(2)
    expect(window.gtag).toHaveBeenNthCalledWith(1, "js", expect.any(Date))
    expect(window.gtag).toHaveBeenNthCalledWith(2, "config", "G-ABC123XYZ9", {
      allow_ad_personalization_signals: false,
      allow_google_signals: false,
      page_location: "http://localhost:3000/",
      page_path: "/",
      page_title: "",
    })
    expect(document.getElementById("arctic-rss-google-analytics")?.getAttribute("src")).toBe(
      "https://www.googletagmanager.com/gtag/js?id=G-ABC123XYZ9"
    )
  })

  it("tracks app-router navigations after the initial page view", () => {
    window.gtag = vi.fn()

    const { rerender } = render(<GoogleAnalytics measurementId="G-ABC123XYZ9" />)

    navigation.pathname = "/app/discover"
    navigation.searchParams = new URLSearchParams("view=card")
    rerender(<GoogleAnalytics measurementId="G-ABC123XYZ9" />)

    expect(window.gtag).toHaveBeenLastCalledWith("config", "G-ABC123XYZ9", {
      allow_ad_personalization_signals: false,
      allow_google_signals: false,
      page_location: "http://localhost:3000/app/discover?view=card",
      page_path: "/app/discover?view=card",
      page_title: "",
    })
  })

  it("creates a dataLayer-backed gtag queue for route changes if needed", () => {
    const { rerender } = render(
      <GoogleAnalytics measurementId="G-QUEUE12345" />
    )

    navigation.pathname = "/app"
    rerender(<GoogleAnalytics measurementId="G-QUEUE12345" />)

    expect(typeof window.gtag).toBe("function")
    expect(window.dataLayer).toEqual([
      ["js", expect.any(Date)],
      [
        "config",
        "G-QUEUE12345",
        {
          allow_ad_personalization_signals: false,
          allow_google_signals: false,
          page_location: "http://localhost:3000/",
          page_path: "/",
          page_title: "",
        },
      ],
      [
        "config",
        "G-QUEUE12345",
        {
          allow_ad_personalization_signals: false,
          allow_google_signals: false,
          page_location: "http://localhost:3000/app",
          page_path: "/app",
          page_title: "",
        },
      ],
    ])
  })
})

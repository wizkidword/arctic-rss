/** @vitest-environment jsdom */

import { render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

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
  afterEach(() => {
    navigation.pathname = "/"
    navigation.searchParams = new URLSearchParams()
    delete window.dataLayer
    delete window.gtag
  })

  it("does not render markup without a measurement id", () => {
    const { container } = render(<GoogleAnalytics measurementId="" />)

    expect(container.innerHTML).toBe("")
  })

  it("tracks app-router navigations after the initial page view", () => {
    window.gtag = vi.fn()

    const { container, rerender } = render(
      <GoogleAnalytics measurementId="G-ABC123XYZ9" />
    )

    expect(container.innerHTML).toBe("")
    expect(window.gtag).not.toHaveBeenCalled()

    navigation.pathname = "/app/discover"
    navigation.searchParams = new URLSearchParams("view=card")
    rerender(<GoogleAnalytics measurementId="G-ABC123XYZ9" />)

    expect(window.gtag).toHaveBeenCalledWith("config", "G-ABC123XYZ9", {
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
      [
        "config",
        "G-QUEUE12345",
        {
          page_location: "http://localhost:3000/app",
          page_path: "/app",
          page_title: "",
        },
      ],
    ])
  })
})

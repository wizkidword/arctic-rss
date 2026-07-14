/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

import { AnalyticsLink } from "./analytics-link"

type TestWindow = Window & {
  gtag?: ReturnType<typeof vi.fn>
}

describe("AnalyticsLink", () => {
  afterEach(() => {
    cleanup()
    delete (window as TestWindow).gtag
  })

  it("tracks the configured event before following the link", async () => {
    const user = userEvent.setup()
    const gtag = vi.fn()
    ;(window as TestWindow).gtag = gtag
    window.localStorage.setItem(
      "arcticrss.analytics-consent.v1",
      JSON.stringify({ choice: "accepted", updatedAt: new Date().toISOString() })
    )

    render(
      <AnalyticsLink
        analyticsEvent="guest_browse_start"
        analyticsParams={{ link_location: "landing_hero" }}
        href="/guest"
        onClick={(event) => event.preventDefault()}
      >
        Browse as Guest
      </AnalyticsLink>
    )

    await user.click(screen.getByRole("link", { name: "Browse as Guest" }))

    expect(gtag).toHaveBeenCalledWith("event", "guest_browse_start", {
      link_location: "landing_hero",
    })
  })
})

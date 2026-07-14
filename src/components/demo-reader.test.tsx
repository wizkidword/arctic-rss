/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    onClick,
    ...props
  }: React.ComponentProps<"a"> & { href: string }) => (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault()
        onClick?.(event)
      }}
      {...props}
    >
      {children}
    </a>
  ),
}))

import { DemoReader } from "./demo-reader"

type TestWindow = Window & {
  gtag?: ReturnType<typeof vi.fn>
}

describe("DemoReader", () => {
  afterEach(() => {
    cleanup()
    delete (window as TestWindow).gtag
  })

  it("lets visitors browse sample articles without an account", async () => {
    const user = userEvent.setup()

    render(<DemoReader />)

    expect(screen.getByRole("heading", { name: "Morning Briefing" })).toBeTruthy()
    expect(
      screen.getByRole("heading", {
        name: "A quieter way to follow the open web",
      })
    ).toBeTruthy()

    await user.click(
      screen.getByRole("button", {
        name: "Open Independent climate reporting",
      })
    )

    expect(
      screen.getByRole("heading", {
        name: "Independent climate reporting",
      })
    ).toBeTruthy()
  })

  it("tracks demo signup intent without personal data", async () => {
    const user = userEvent.setup()
    const gtag = vi.fn()
    ;(window as TestWindow).gtag = gtag
    window.localStorage.setItem(
      "arcticrss.analytics-consent.v1",
      JSON.stringify({ choice: "accepted", updatedAt: new Date().toISOString() })
    )

    render(<DemoReader />)

    await user.click(screen.getByRole("link", { name: "Create your reader" }))

    expect(gtag).toHaveBeenCalledWith("event", "demo_create_account_click", {
      link_location: "demo_banner",
    })
  })
})

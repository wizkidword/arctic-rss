import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  listDiscoverInterestNavigation: vi.fn(),
}))

vi.mock("@/components/app-shell", () => ({
  AppShell: (props: {
    children: React.ReactNode
    discoverInterests: Array<{ id: string; label: string }>
    guestMode?: boolean
    user: { name?: string | null }
  }) => (
    <div
      data-discover-interest-count={props.discoverInterests.length}
      data-guest-mode={String(props.guestMode)}
      data-user-name={props.user.name ?? ""}
    >
      {props.children}
    </div>
  ),
}))

vi.mock("@/lib/discover-interests", () => ({
  listDiscoverInterestNavigation: mocks.listDiscoverInterestNavigation,
}))

import GuestLayout from "./layout"

describe("GuestLayout", () => {
  beforeEach(() => {
    mocks.listDiscoverInterestNavigation.mockResolvedValue([
      { feedCount: 18, id: "ai", label: "AI" },
    ])
  })

  it("wraps guest pages in the real shell without requiring auth", async () => {
    const markup = renderToStaticMarkup(
      await GuestLayout({
        children: <p>Guest content</p>,
      })
    )

    expect(markup).toContain('data-guest-mode="true"')
    expect(markup).toContain('data-user-name="Guest"')
    expect(markup).toContain('data-discover-interest-count="1"')
    expect(markup).toContain("Guest content")
  })
})

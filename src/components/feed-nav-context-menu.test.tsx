// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { markAllReadAction, refreshFeedAction, unsubscribeFeedAction } =
  vi.hoisted(() => ({
    markAllReadAction: vi.fn(),
    refreshFeedAction: vi.fn(),
    unsubscribeFeedAction: vi.fn(),
  }))

vi.mock("@/app/app/actions", () => ({
  markAllReadAction,
  refreshFeedAction,
  unsubscribeFeedAction,
}))

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

import { FeedNavContextMenu } from "@/components/feed-nav-context-menu"

const subscription = {
  feedId: "feed-wired-science",
  id: "sub-wired-science",
  lastError: null,
  siteUrl: "https://www.wired.com/category/science/",
  title: "WIRED Science",
  unreadCount: 7,
}

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  markAllReadAction.mockReset()
  refreshFeedAction.mockReset()
  unsubscribeFeedAction.mockReset()
})

describe("FeedNavContextMenu", () => {
  it("opens feed actions from a right-click on the subscribed feed", () => {
    render(<FeedNavContextMenu subscription={subscription} />)

    fireEvent.contextMenu(screen.getByRole("link", { name: /WIRED Science/ }), {
      clientX: 120,
      clientY: 160,
    })

    expect(
      screen.getByRole("menu", { name: "WIRED Science feed actions" })
    ).toBeTruthy()
    expect(
      screen.getByRole("menuitem", { name: "Mark feed as read" })
    ).toBeTruthy()
    expect(screen.getByRole("menuitem", { name: "Reload feed" })).toBeTruthy()
    expect(screen.getByRole("menuitem", { name: "Go to feed" }).getAttribute("href")).toBe(
      "/app/feed/sub-wired-science"
    )
    expect(
      screen.getByRole("menuitem", { name: "Open original site" })
    ).toBeTruthy()
    expect(
      screen
        .getByRole("menuitem", { name: "Open original site" })
        .getAttribute("href")
    ).toBe("https://www.wired.com/category/science/")
    expect(screen.getByRole("menuitem", { name: "Delete feed" })).toBeTruthy()
  })

  it("marks only the selected feed as read", async () => {
    const user = userEvent.setup()
    render(<FeedNavContextMenu subscription={subscription} />)

    fireEvent.contextMenu(screen.getByRole("link", { name: /WIRED Science/ }), {
      clientX: 120,
      clientY: 160,
    })

    await user.click(screen.getByRole("menuitem", { name: "Mark feed as read" }))

    await waitFor(() => {
      expect(markAllReadAction).toHaveBeenCalledTimes(1)
    })

    const formData = markAllReadAction.mock.calls[0][0] as FormData
    expect(formData.get("scope")).toBe("feed")
    expect(formData.get("feedId")).toBe("feed-wired-science")
  })

  it("reloads the selected feed subscription", async () => {
    const user = userEvent.setup()
    render(<FeedNavContextMenu subscription={subscription} />)

    fireEvent.contextMenu(screen.getByRole("link", { name: /WIRED Science/ }), {
      clientX: 120,
      clientY: 160,
    })

    await user.click(screen.getByRole("menuitem", { name: "Reload feed" }))

    await waitFor(() => {
      expect(refreshFeedAction).toHaveBeenCalledTimes(1)
    })

    const formData = refreshFeedAction.mock.calls[0][1] as FormData
    expect(formData.get("subscriptionId")).toBe("sub-wired-science")
  })

  it("opens unsubscribe confirmation instead of deleting immediately", async () => {
    const user = userEvent.setup()
    render(<FeedNavContextMenu subscription={subscription} />)

    fireEvent.contextMenu(screen.getByRole("link", { name: /WIRED Science/ }), {
      clientX: 120,
      clientY: 160,
    })

    await user.click(screen.getByRole("menuitem", { name: "Delete feed" }))

    expect(unsubscribeFeedAction).not.toHaveBeenCalled()
    expect(
      screen.getByRole("heading", { name: "Unsubscribe from WIRED Science?" })
    ).toBeTruthy()
  })
})

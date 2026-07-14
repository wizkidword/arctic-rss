/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  subscribeToPodcastStateAction: vi.fn(),
}))

vi.mock("@/app/app/podcasts/actions", () => ({
  subscribeToPodcastStateAction: mocks.subscribeToPodcastStateAction,
}))

import { PodcastSubscribeButton } from "./podcast-subscribe-button"

type TestWindow = Window & {
  gtag?: ReturnType<typeof vi.fn>
}

describe("PodcastSubscribeButton", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    delete (window as TestWindow).gtag
  })

  it("renders a subscribe form for a podcast feed", () => {
    render(<PodcastSubscribeButton feedUrl="https://example.com/podcast.xml" />)

    expect(screen.getByRole("button", { name: "Subscribe" })).not.toHaveProperty(
      "disabled",
      true
    )
    expect(
      document.querySelector<HTMLInputElement>('input[name="url"]')?.value
    ).toBe("https://example.com/podcast.xml")
  })

  it("tracks podcast subscription activation after a successful subscribe", async () => {
    const user = userEvent.setup()
    const gtag = vi.fn()
    ;(window as TestWindow).gtag = gtag
    window.localStorage.setItem(
      "arcticrss.analytics-consent.v1",
      JSON.stringify({ choice: "accepted", updatedAt: new Date().toISOString() })
    )
    mocks.subscribeToPodcastStateAction.mockResolvedValueOnce({
      analytics: {
        firstSourceSubscribed: true,
        sourceType: "podcast",
      },
      message: "Subscribed to Example Podcast. Imported 1 episode.",
      status: "success",
    })

    render(<PodcastSubscribeButton feedUrl="https://example.com/podcast.xml" />)

    await user.click(screen.getByRole("button", { name: "Subscribe" }))

    await waitFor(() => {
      expect(
        screen.getByText("Subscribed to Example Podcast. Imported 1 episode.")
      ).toBeTruthy()
    })
    expect(gtag).toHaveBeenCalledWith("event", "source_subscribe", {
      source_type: "podcast",
      subscribe_surface: "podcasts",
    })
    expect(gtag).toHaveBeenCalledWith("event", "first_source_subscribed", {
      source_type: "podcast",
    })
  })
})

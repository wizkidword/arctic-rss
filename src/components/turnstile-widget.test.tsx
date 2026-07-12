/** @vitest-environment jsdom */

import { act } from "react"
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { TurnstileWidget } from "./turnstile-widget"

vi.mock("next/script", () => ({
  default: function MockScript({ src }: { src: string }) {
    return <script data-testid="turnstile-script" data-src={src} />
  },
}))

describe("TurnstileWidget", () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    delete window.turnstile
  })

  it("renders when the Turnstile API becomes available after mount", async () => {
    vi.useFakeTimers()
    const renderTurnstile = vi.fn(() => "widget-id")

    render(<TurnstileWidget action="signup" siteKey="site-key" />)

    expect(renderTurnstile).not.toHaveBeenCalled()

    window.turnstile = {
      render: renderTurnstile,
      remove: vi.fn(),
    }

    await act(async () => {
      vi.advanceTimersByTime(250)
    })

    expect(renderTurnstile).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({
        action: "signup",
        sitekey: "site-key",
      })
    )
  })
})

/** @vitest-environment jsdom */

import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { LoginForm } from "./login-form"

const navigation = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
  push: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: navigation.push,
    refresh: navigation.refresh,
  }),
  useSearchParams: () => navigation.searchParams,
}))

vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}))

type TestWindow = Window & {
  gtag?: ReturnType<typeof vi.fn>
}

describe("LoginForm", () => {
  afterEach(() => {
    navigation.searchParams = new URLSearchParams()
    navigation.push.mockReset()
    navigation.refresh.mockReset()
    delete (window as TestWindow).gtag
  })

  it("shows a helpful Google sign-in retry message for Auth.js configuration errors", () => {
    navigation.searchParams = new URLSearchParams("error=Configuration")

    render(<LoginForm googleAuthEnabled turnstileSiteKey="" />)

    expect(
      screen.getByText(
        "Google sign-in could not finish. Try again from this browser window, and allow cookies for Arctic RSS if your browser blocks them."
      )
    ).toBeTruthy()
  })

  it("tracks completed email signups after the signup success redirect", async () => {
    const gtag = vi.fn()
    ;(window as TestWindow).gtag = gtag
    window.localStorage.setItem(
      "arcticrss.analytics-consent.v1",
      JSON.stringify({ choice: "accepted", updatedAt: new Date().toISOString() })
    )
    navigation.searchParams = new URLSearchParams("registered=1")

    const { rerender } = render(
      <LoginForm googleAuthEnabled turnstileSiteKey="" />
    )

    await waitFor(() => {
      expect(gtag).toHaveBeenCalledWith("event", "sign_up", {
        method: "email",
      })
    })

    rerender(<LoginForm googleAuthEnabled turnstileSiteKey="" />)

    expect(
      gtag.mock.calls.filter((call) => call[1] === "sign_up")
    ).toHaveLength(1)
  })
})

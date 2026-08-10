/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { LoginForm } from "./login-form"

const navigation = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
  push: vi.fn(),
  refresh: vi.fn(),
}))

const authentication = vi.hoisted(() => ({ signIn: vi.fn() }))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: navigation.push,
    refresh: navigation.refresh,
  }),
  useSearchParams: () => navigation.searchParams,
}))

vi.mock("next-auth/react", () => ({
  signIn: authentication.signIn,
}))

type TestWindow = Window & {
  gtag?: ReturnType<typeof vi.fn>
}

describe("LoginForm", () => {
  afterEach(() => {
    cleanup()
    navigation.searchParams = new URLSearchParams()
    navigation.push.mockReset()
    navigation.refresh.mockReset()
    authentication.signIn.mockReset()
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

  it("returns Google sign-in to a safe mobile authorization callback", async () => {
    const user = userEvent.setup()
    navigation.searchParams = new URLSearchParams(
      "callbackUrl=%2Fapi%2Fmobile%2Fauthorize%3Fstate%3Dexpected"
    )

    render(<LoginForm googleAuthEnabled turnstileSiteKey="" />)
    await user.click(screen.getByRole("button", { name: "Continue with Google" }))

    expect(authentication.signIn).toHaveBeenCalledWith("google", {
      redirectTo: "/api/mobile/authorize?state=expected",
    })
  })

  it("falls back to the reader for an unsafe callback URL", async () => {
    const user = userEvent.setup()
    navigation.searchParams = new URLSearchParams("callbackUrl=https%3A%2F%2Fattacker.example")

    render(<LoginForm googleAuthEnabled turnstileSiteKey="" />)
    await user.click(screen.getByRole("button", { name: "Continue with Google" }))

    expect(authentication.signIn).toHaveBeenCalledWith("google", { redirectTo: "/app" })
  })

  it("returns credential sign-in to the safe mobile authorization callback", async () => {
    const user = userEvent.setup()
    authentication.signIn.mockResolvedValue({})
    navigation.searchParams = new URLSearchParams(
      "callbackUrl=%2Fapi%2Fmobile%2Fauthorize%3Fstate%3Dexpected"
    )

    render(<LoginForm googleAuthEnabled={false} turnstileSiteKey="" />)
    await user.type(screen.getByLabelText("Email"), "reader@example.test")
    await user.type(screen.getByLabelText("Password"), "password")
    await user.click(screen.getByRole("button", { name: "Log in" }))

    await waitFor(() => {
      expect(navigation.push).toHaveBeenCalledWith("/api/mobile/authorize?state=expected")
    })
    expect(navigation.refresh).toHaveBeenCalled()
  })
})

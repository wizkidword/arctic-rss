/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

import { AccountDeletionControl } from "./account-deletion-control"

describe("AccountDeletionControl", () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it("requires an exact DELETE confirmation and current password before it sends a deletion request", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const user = userEvent.setup()

    render(<AccountDeletionControl hasLocalPassword />)

    expect((screen.getByRole("button", { name: "Delete account" }) as HTMLButtonElement).disabled).toBe(true)
    await user.type(screen.getByLabelText("Type DELETE to confirm"), "delete")
    expect((screen.getByRole("button", { name: "Delete account" }) as HTMLButtonElement).disabled).toBe(true)
    await user.clear(screen.getByLabelText("Type DELETE to confirm"))
    await user.type(screen.getByLabelText("Type DELETE to confirm"), "DELETE")
    expect((screen.getByRole("button", { name: "Delete account" }) as HTMLButtonElement).disabled).toBe(true)
    await user.type(screen.getByLabelText("Enter your current password"), "current-password")
    expect((screen.getByRole("button", { name: "Delete account" }) as HTMLButtonElement).disabled).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("requests a one-time email confirmation for a Google-only account", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({}),
      ok: true,
    })
    vi.stubGlobal("fetch", fetchMock)
    const user = userEvent.setup()

    render(<AccountDeletionControl hasLocalPassword={false} />)

    expect(screen.queryByLabelText("Enter your current password")).toBeNull()
    await user.type(screen.getByLabelText("Type DELETE to confirm"), "DELETE")
    await user.click(screen.getByRole("button", { name: "Send deletion confirmation email" }))

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/account/deletion/confirmation-request",
      expect.objectContaining({
        body: JSON.stringify({ confirmation: "DELETE" }),
        method: "POST",
      })
    )
    expect(
      screen.getByText("Check your verified email for a one-time deletion confirmation link.")
    ).toBeTruthy()
  })
})

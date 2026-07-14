/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

import { AccountDeletionControl } from "./account-deletion-control"

describe("AccountDeletionControl", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("requires an exact DELETE confirmation and current password before it sends a deletion request", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const user = userEvent.setup()

    render(<AccountDeletionControl />)

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
})

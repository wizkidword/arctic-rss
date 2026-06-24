import { cloneElement, isValidElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode
    href: string
  }) => <a href={href}>{children}</a>,
}))

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenuItem: ({
    children,
    render,
  }: {
    children: React.ReactNode
    render?: React.ReactElement
  }) =>
    isValidElement(render)
      ? cloneElement(render, {}, children)
      : <div>{children}</div>,
}))

import { AdminAccountLink } from "./admin-account-link"

describe("AdminAccountLink", () => {
  it("renders a linked admin dashboard command for administrators", () => {
    const markup = renderToStaticMarkup(<AdminAccountLink role="ADMIN" />)

    expect(markup).toContain('href="/admin"')
    expect(markup).toContain("Admin Dashboard")
  })

  it("does not render an admin command for regular readers", () => {
    const markup = renderToStaticMarkup(<AdminAccountLink role="USER" />)

    expect(markup).toBe("")
  })
})

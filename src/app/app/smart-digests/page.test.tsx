import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  listSmartDigestRulesForUser: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`)
  }),
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

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}))

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}))

vi.mock("@/lib/smart-digests", () => ({
  listSmartDigestRulesForUser: mocks.listSmartDigestRulesForUser,
}))

import SmartDigestsPage from "./page"

describe("SmartDigestsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.listSmartDigestRulesForUser.mockResolvedValue([])
  })

  it("renders the dashboard title, create link, and empty state", async () => {
    const markup = renderToStaticMarkup(await SmartDigestsPage())

    expect(mocks.listSmartDigestRulesForUser).toHaveBeenCalledWith("user-1")
    expect(markup).toContain("Smart Digests")
    expect(markup).toContain('href="/app/smart-digests/new"')
    expect(markup).toContain("No Smart Digests yet")
  })

  it("redirects anonymous visitors to login", async () => {
    mocks.auth.mockResolvedValue(null)

    await expect(SmartDigestsPage()).rejects.toThrow("REDIRECT:/login")
  })
})

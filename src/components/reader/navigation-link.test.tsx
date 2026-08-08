import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

const navigation = vi.hoisted(() => ({ pathname: "/app/saved-searches" }))

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
}))

import { ReaderNavigationLink } from "./navigation-link"

describe("ReaderNavigationLink", () => {
  it("marks a briefing subsection and its nested routes as current", () => {
    const markup = renderToStaticMarkup(
      <ReaderNavigationLink href="/app/saved-searches">Saved views</ReaderNavigationLink>
    )

    expect(markup).toContain('aria-current="page"')
    expect(markup).toContain('data-active="true"')
  })

  it("keeps the reader home link exact", () => {
    navigation.pathname = "/app/search"
    const markup = renderToStaticMarkup(
      <ReaderNavigationLink exact href="/app">All Articles</ReaderNavigationLink>
    )

    expect(markup).not.toContain("aria-current")
  })
})

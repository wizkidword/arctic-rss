import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  listArticleCollectionsForUser: vi.fn(),
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

vi.mock("@/lib/article-collections", () => ({
  listArticleCollectionsForUser: mocks.listArticleCollectionsForUser,
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}))

import CollectionsPage from "./page"

describe("CollectionsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
  })

  it("lists saved article collections for the signed-in reader", async () => {
    mocks.listArticleCollectionsForUser.mockResolvedValue([
      { articleCount: 3, id: "collection-read-later", name: "Read Later" },
      { articleCount: 1, id: "collection-research", name: "Research" },
    ])

    const markup = renderToStaticMarkup(await CollectionsPage())

    expect(mocks.listArticleCollectionsForUser).toHaveBeenCalledWith("user-1")
    expect(markup).toContain("Collections")
    expect(markup).toContain("Read Later")
    expect(markup).toContain("3 items")
    expect(markup).toContain('href="/app/collections/collection-read-later"')
    expect(markup).toContain("Research")
  })

  it("redirects anonymous visitors to login", async () => {
    mocks.auth.mockResolvedValue(null)

    await expect(CollectionsPage()).rejects.toThrow("REDIRECT:/login")
  })
})

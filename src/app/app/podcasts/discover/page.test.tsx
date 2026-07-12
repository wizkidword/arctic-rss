import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`)
  }),
}))

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string
  }) => (
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

vi.mock("@/components/podcast-subscribe-button", () => ({
  PodcastSubscribeButton: ({ feedUrl }: { feedUrl: string }) => (
    <span>Subscribe control for {feedUrl}</span>
  ),
}))

vi.mock("../actions", () => ({
  subscribeToPodcastAction: "/app/podcasts/discover",
}))

import DiscoverPodcastsPage from "./page"

describe("DiscoverPodcastsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
  })

  it("redirects unauthenticated readers to login", async () => {
    mocks.auth.mockResolvedValue(null)

    await expect(
      DiscoverPodcastsPage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow("REDIRECT:/login")
  })

  it("renders categories, search, directory results, and paste RSS form", async () => {
    const markup = renderToStaticMarkup(
      await DiscoverPodcastsPage({ searchParams: Promise.resolve({}) })
    )

    expect(markup).toContain("Discover Podcasts")
    expect(markup).toContain("Technology")
    expect(markup).toContain("Search podcasts")
    expect(markup).toContain("Paste podcast RSS URL")
    expect(markup).toContain("Practical AI")
  })

  it("renders search results from the curated directory", async () => {
    const markup = renderToStaticMarkup(
      await DiscoverPodcastsPage({
        searchParams: Promise.resolve({ q: "nasa" }),
      })
    )

    expect(markup).toContain("NASA&#x27;s Curious Universe")
    expect(markup).not.toContain("NPR News Now")
  })
})

import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getOrCreateUserSettings: vi.fn(),
  getPodcastHomeForUser: vi.fn(),
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

vi.mock("@/lib/podcasts", () => ({
  getPodcastHomeForUser: mocks.getPodcastHomeForUser,
}))

vi.mock("@/lib/user-settings", () => ({
  getOrCreateUserSettings: mocks.getOrCreateUserSettings,
}))

vi.mock("./actions", () => ({
  subscribeToPodcastAction: "/app/podcasts",
}))

import PodcastsPage from "./page"

describe("PodcastsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.getOrCreateUserSettings.mockResolvedValue({
      dateFormat: "DEFAULT",
      timeFormat: "DEFAULT",
      timeZone: "UTC",
    })
    mocks.getPodcastHomeForUser.mockResolvedValue({
      episodes: [
        {
          audioType: "audio/mpeg",
          audioUrl: "https://cdn.example.com/ep.mp3",
          description: "Episode description",
          durationSeconds: 1800,
          episodeId: "episode-1",
          imageUrl: null,
          isPlayed: false,
          isStarred: false,
          playbackPositionSeconds: 120,
          podcastId: "podcast-1",
          podcastTitle: "Example Podcast",
          publishedAt: new Date("2026-06-29T12:00:00.000Z"),
          title: "Episode 1",
          url: "https://example.com/episode-1",
        },
      ],
      subscriptions: [
        {
          artworkUrl: "https://example.com/art.jpg",
          id: "podcast-1",
          lastError: null,
          latestEpisodeTitle: "Episode 1",
          subscriptionId: "subscription-1",
          title: "Example Podcast",
          unplayedCount: 1,
        },
      ],
    })
  })

  it("redirects unauthenticated readers to login", async () => {
    mocks.auth.mockResolvedValue(null)

    await expect(PodcastsPage()).rejects.toThrow("REDIRECT:/login")
    expect(mocks.getPodcastHomeForUser).not.toHaveBeenCalled()
  })

  it("renders subscribed podcasts and episodes", async () => {
    const markup = renderToStaticMarkup(await PodcastsPage())

    expect(markup).toContain("Podcasts")
    expect(markup).toContain("Example Podcast")
    expect(markup).toContain("Episode 1")
    expect(markup).toContain("Aired 6/29/2026, 12:00 PM")
    expect(markup).toContain("1 unplayed")
    expect(mocks.getPodcastHomeForUser).toHaveBeenCalledWith("user-1")
    expect(mocks.getOrCreateUserSettings).toHaveBeenCalledWith("user-1")
  })

  it("renders a discover and paste-RSS empty state", async () => {
    mocks.getPodcastHomeForUser.mockResolvedValue({
      episodes: [],
      subscriptions: [],
    })

    const markup = renderToStaticMarkup(await PodcastsPage())

    expect(markup).toContain("Discover podcasts")
    expect(markup).toContain("Paste podcast RSS URL")
  })
})

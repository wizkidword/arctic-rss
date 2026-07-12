import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getOrCreateUserSettings: vi.fn(),
  getPodcastShowForUser: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND")
  }),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`)
  }),
}))

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}))

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}))

vi.mock("@/lib/podcasts", () => ({
  getPodcastShowForUser: mocks.getPodcastShowForUser,
}))

vi.mock("@/lib/user-settings", () => ({
  getOrCreateUserSettings: mocks.getOrCreateUserSettings,
}))

vi.mock("@/components/podcast-episode-list", () => ({
  PodcastEpisodeList: ({
    dateTimePreferences,
    episodes,
  }: {
    dateTimePreferences?: { timeZone?: string }
    episodes: Array<{ title: string }>
  }) => (
    <section data-time-zone={dateTimePreferences?.timeZone ?? ""}>
      {episodes.map((episode) => (
        <article key={episode.title}>{episode.title}</article>
      ))}
    </section>
  ),
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}))

vi.mock("@/components/ui/button", () => ({
  buttonVariants: () => "button",
}))

import PodcastShowPage from "./page"

describe("PodcastShowPage", () => {
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
    mocks.getPodcastShowForUser.mockResolvedValue({
      episodes: [
        {
          title: "Episode 1",
        },
      ],
      podcast: {
        artworkUrl: "https://example.com/art.jpg",
        description: "Show description",
        id: "podcast-1",
        lastError: null,
        title: "Example Podcast",
        url: "https://example.com",
      },
    })
  })

  it("redirects signed-out users to login", async () => {
    mocks.auth.mockResolvedValue(null)

    await expect(
      PodcastShowPage({
        params: Promise.resolve({
          podcastId: "podcast-1",
        }),
      })
    ).rejects.toThrow("REDIRECT:/login")
  })

  it("returns not found when the user is not subscribed to the podcast", async () => {
    mocks.getPodcastShowForUser.mockResolvedValue(null)

    await expect(
      PodcastShowPage({
        params: Promise.resolve({
          podcastId: "podcast-2",
        }),
      })
    ).rejects.toThrow("NOT_FOUND")

    expect(mocks.getPodcastShowForUser).toHaveBeenCalledWith({
      podcastId: "podcast-2",
      userId: "user-1",
    })
  })

  it("renders podcast metadata and episodes", async () => {
    const markup = renderToStaticMarkup(
      await PodcastShowPage({
        params: Promise.resolve({
          podcastId: "podcast-1",
        }),
      })
    )

    expect(markup).toContain("Example Podcast")
    expect(markup).toContain("Show description")
    expect(markup).toContain("Episode 1")
    expect(markup).toContain("All podcasts")
    expect(markup).toContain("Podcast site")
    expect(markup).toContain('data-time-zone="UTC"')
    expect(mocks.getOrCreateUserSettings).toHaveBeenCalledWith("user-1")
  })

  it("shows a needs attention badge when refresh errors exist", async () => {
    mocks.getPodcastShowForUser.mockResolvedValue({
      episodes: [],
      podcast: {
        artworkUrl: null,
        description: null,
        id: "podcast-1",
        lastError: "Timeout",
        title: "Example Podcast",
        url: null,
      },
    })

    const markup = renderToStaticMarkup(
      await PodcastShowPage({
        params: Promise.resolve({
          podcastId: "podcast-1",
        }),
      })
    )

    expect(markup).toContain("Needs attention")
  })
})

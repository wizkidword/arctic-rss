import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { authMock, directoryMock, eligibleUserMock, flagsMock, notFoundMock, profileMock, roomsMock, subscriptionsMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  directoryMock: vi.fn(),
  eligibleUserMock: vi.fn(),
  flagsMock: vi.fn(),
  notFoundMock: vi.fn(),
  profileMock: vi.fn(),
  roomsMock: vi.fn(),
  subscriptionsMock: vi.fn(),
}))

vi.mock("@/auth", () => ({ auth: authMock }))
vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
  useRouter: () => ({ refresh: vi.fn() }),
}))
vi.mock("@/lib/chat/access", () => ({
  ChatAccessError: class ChatAccessError extends Error {},
  requireChatEligibleUser: eligibleUserMock,
}))
vi.mock("@/lib/chat/feature-flags", () => ({ getChatFeatureFlags: flagsMock }))
vi.mock("@/lib/chat/room-service", () => ({ listChatRooms: roomsMock }))
vi.mock("@/lib/chat/profiles", () => ({ getChatProfileForUser: profileMock }))
vi.mock("@/lib/discover-directory", () => ({
  getCategoryCountryCode: () => null,
  getDiscoverDirectory: directoryMock,
}))
vi.mock("@/lib/feed-subscriptions", () => ({ listUserFeedSubscriptions: subscriptionsMock }))

import IrcDiscoverPage from "./page"

const rooms = [
  { description: "AI news", id: "room-ai", interestIds: ["ai"], isOfficial: true, name: "AI", slug: "ai", topicLine: "Models" },
  { description: "Science news", id: "room-science", interestIds: ["science"], isOfficial: true, name: "Science", slug: "science", topicLine: null },
]

describe("IrcDiscoverPage", () => {
  beforeEach(() => {
    authMock.mockReset()
    eligibleUserMock.mockReset()
    flagsMock.mockReturnValue({ enabled: true, guestPreviewEnabled: true })
    notFoundMock.mockReset()
    notFoundMock.mockImplementation(() => {
      throw new Error("NOT_FOUND")
    })
    roomsMock.mockReset()
    roomsMock.mockResolvedValue(rooms)
    directoryMock.mockReset()
    directoryMock.mockResolvedValue({
      categories: [{ countryCode: null, description: "", iconKey: "ai", id: "ai", label: "AI", sortOrder: 0 }],
      feeds: [{ categoryId: "ai", id: "example-ai", label: "Example AI", sortOrder: 0, source: "example", url: "https://private.example.test/feed.xml" }],
    })
    subscriptionsMock.mockReset()
    subscriptionsMock.mockResolvedValue([])
    profileMock.mockReset()
    profileMock.mockResolvedValue({ personalizedDiscovery: true })
  })

  it("shows guests only public room metadata", async () => {
    authMock.mockResolvedValue(null)

    const markup = renderToStaticMarkup(await IrcDiscoverPage({ searchParams: Promise.resolve({}) }))

    expect(markup).toContain("Browse public Arctic rooms")
    expect(markup).toContain("#ai")
    expect(markup).toContain("External IRC starter channels")
    expect(markup).toContain("#libera")
    expect(markup).toContain("https://web.libera.chat/#libera")
    expect(markup).toContain('target="_blank"')
    expect(markup).toContain("Arctic RSS does not connect to, relay, or store content from these networks")
    expect(markup).not.toContain("Matches your Discover interests")
    expect(markup).not.toContain("private.example.test")
  })

  it("ranks a signed-in reader's matching room without rendering feed data", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } })
    eligibleUserMock.mockResolvedValue({ id: "user-1" })
    subscriptionsMock.mockResolvedValue([{ feedUrl: "https://private.example.test/feed.xml" }])

    const markup = renderToStaticMarkup(await IrcDiscoverPage({ searchParams: Promise.resolve({}) }))

    expect(markup).toContain("Matches your Discover interests")
    expect(markup).toContain('href="/irc?room=ai"')
    expect(markup).not.toContain("private.example.test")
  })

  it("does not expose the directory when guest preview is disabled and the user is not eligible", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } })
    eligibleUserMock.mockResolvedValue(null)
    flagsMock.mockReturnValue({ enabled: true, guestPreviewEnabled: false })

    await expect(IrcDiscoverPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("NOT_FOUND")
    expect(roomsMock).not.toHaveBeenCalled()
  })

  it("filters both native rooms and external starter channels", async () => {
    authMock.mockResolvedValue(null)

    const markup = renderToStaticMarkup(await IrcDiscoverPage({ searchParams: Promise.resolve({ q: "debian" }) }))

    expect(markup).toContain("#debian")
    expect(markup).not.toContain("#ai")
  })
})

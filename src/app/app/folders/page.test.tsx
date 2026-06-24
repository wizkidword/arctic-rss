import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  listUserFeedSubscriptions: vi.fn(),
  listUserFolders: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`)
  }),
}))

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode
    href: string
  }) => <a href={href}>{children}</a>,
}))

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}))

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}))

vi.mock("@/app/app/actions", () => ({
  createFolderAction: "/create-folder",
  deleteFolderAction: "/delete-folder",
  moveSubscriptionToFolderAction: "/move-subscription",
  renameFolderAction: "/rename-folder",
}))

vi.mock("@/lib/feed-subscriptions", () => ({
  listUserFeedSubscriptions: mocks.listUserFeedSubscriptions,
}))

vi.mock("@/lib/folders", () => ({
  listUserFolders: mocks.listUserFolders,
}))

vi.mock("@/components/feed-unsubscribe-button", () => ({
  FeedUnsubscribeButton: ({
    feedTitle,
    subscriptionId,
  }: {
    feedTitle: string
    subscriptionId: string
  }) => (
    <span>
      Unsubscribe {feedTitle} {subscriptionId}
    </span>
  ),
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}))

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
}))

import FoldersPage from "./page"

describe("FoldersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.listUserFolders.mockResolvedValue([])
    mocks.listUserFeedSubscriptions.mockResolvedValue([
      {
        faviconUrl: null,
        feedId: "feed-1",
        folderId: null,
        folderName: null,
        id: "subscription-1",
        isPaused: false,
        lastError: null,
        siteUrl: "https://example.com",
        title: "Example Feed",
        unreadCount: 3,
      },
    ])
  })

  it("places unsubscribe on every Feed Organization row", async () => {
    const markup = renderToStaticMarkup(await FoldersPage())

    expect(markup).toContain("Unsubscribe Example Feed subscription-1")
  })
})

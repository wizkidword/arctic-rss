import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

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

vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
}))

vi.mock("@/components/add-feed-sheet", () => ({
  AddFeedSheet: () => <button type="button">Add Feed</button>,
}))

vi.mock("@/components/admin-account-link", () => ({
  AdminAccountLink: () => <a href="/admin">Admin</a>,
}))

vi.mock("@/components/bug-report-dialog", () => ({
  BugReportDialog: () => null,
}))

vi.mock("@/components/bulk-read-progress", () => ({
  BulkReadProgress: () => <div>Bulk read in progress</div>,
}))

vi.mock("@/components/feature-suggestion-dialog", () => ({
  FeatureSuggestionDialog: () => null,
}))

vi.mock("@/components/email-verification-reminder", () => ({
  EmailVerificationReminder: () => <div>Verify your email</div>,
}))

vi.mock("@/components/feed-nav-context-menu", () => ({
  FeedNavContextMenu: ({
    subscription,
  }: {
    subscription: { id: string; title: string; unreadCount: number }
  }) => (
    <a href={`/app/feed/${subscription.id}`}>
      {subscription.title}
      {subscription.unreadCount > 0 ? subscription.unreadCount : null}
    </a>
  ),
}))

vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AvatarFallback: ({ children }: React.PropsWithChildren) => (
    <span>{children}</span>
  ),
}))

vi.mock("@/components/ui/button", () => ({
  Button: (buttonProps: React.ComponentProps<"button"> & {
    size?: string
    variant?: string
  }) => {
    const { children, size, variant, ...props } = buttonProps
    void size
    void variant

    return <button {...props}>{children}</button>
  },
  buttonVariants: () => "button-variants",
}))

vi.mock("@/components/ui/dropdown-menu", async () => {
  const { cloneElement, isValidElement } = await import("react")

  function Primitive({ children }: React.PropsWithChildren) {
    return <div>{children}</div>
  }

  function PrimitiveWithRender({
    children,
    render,
  }: React.PropsWithChildren<{ render?: React.ReactElement }>) {
    return isValidElement(render)
      ? cloneElement(render, undefined, children)
      : <div>{children}</div>
  }

  function Trigger({
    children,
    render,
  }: React.PropsWithChildren<{ render?: React.ReactElement }>) {
    return isValidElement(render)
      ? cloneElement(render, undefined, children)
      : <div>{children}</div>
  }

  return {
    DropdownMenu: Primitive,
    DropdownMenuContent: Primitive,
    DropdownMenuGroup: Primitive,
    DropdownMenuItem: PrimitiveWithRender,
    DropdownMenuLabel: Primitive,
    DropdownMenuSeparator: () => <hr />,
    DropdownMenuTrigger: Trigger,
  }
})

vi.mock("@/components/ui/separator", () => ({
  Separator: (props: React.ComponentProps<"hr">) => <hr {...props} />,
}))

vi.mock("@/components/ui/sheet", async () => {
  const { cloneElement, isValidElement } = await import("react")

  function Primitive({ children }: React.PropsWithChildren) {
    return <div>{children}</div>
  }

  function Trigger({
    children,
    render,
  }: React.PropsWithChildren<{ render?: React.ReactElement }>) {
    return isValidElement(render)
      ? cloneElement(render, undefined, children)
      : <div>{children}</div>
  }

  return {
    Sheet: Primitive,
    SheetContent: Primitive,
    SheetHeader: Primitive,
    SheetTitle: Primitive,
    SheetTrigger: Trigger,
  }
})

import { AppShell } from "@/components/app-shell"

describe("AppShell", () => {
  const discoverInterests = [
    { feedCount: 42, id: "general", label: "General" },
    { feedCount: 24, id: "politics", label: "Politics" },
  ]

  it("puts add-feed, discover, and individual feeds near the top of the reader nav", () => {
    const markup = renderToStaticMarkup(
      <AppShell
        articleCollections={[
          { articleCount: 3, id: "collection-read-later", name: "Read Later" },
          { articleCount: 1, id: "collection-research", name: "Research" },
        ]}
        discoverInterests={discoverInterests}
        feedSubscriptions={[
          {
            faviconUrl: null,
            feedId: "feed-wired",
            folderId: "folder-science",
            folderName: "Science",
            id: "subscription-wired",
            isPaused: false,
            lastError: null,
            siteUrl: null,
            title: "Wired Science",
            unreadCount: 4,
          },
          {
            faviconUrl: null,
            feedId: "feed-nasa",
            folderId: "folder-science",
            folderName: "Science",
            id: "subscription-nasa",
            isPaused: false,
            lastError: null,
            siteUrl: null,
            title: "NASA",
            unreadCount: 0,
          },
        ]}
        folders={[]}
        displayMode="THREE_PANE"
        readerCounts={{ allCount: 0, starredCount: 0, unreadCount: 0 }}
        showEmailVerificationReminder={true}
        themePreference="SYSTEM"
        user={{ email: "reader@example.com", name: "Reader", role: "USER" }}
      >
        <div>Reader content</div>
      </AppShell>
    )

    expect(markup.match(/href="\/app\/discover"/g) ?? []).toHaveLength(2)
    expect(markup.match(/href="\/app\/podcasts"/g) ?? []).toHaveLength(2)
    expect(markup.match(/href="\/app\/smart-digests"/g) ?? []).toHaveLength(2)
    expect(markup.match(/href="\/app\/podcasts\/discover"/g) ?? []).toHaveLength(2)
    expect(markup.match(/>Podcasts</g) ?? []).toHaveLength(2)
    expect(markup.match(/>Smart Digests</g) ?? []).toHaveLength(2)
    expect(markup.match(/>Discover Podcasts</g) ?? []).toHaveLength(2)
    expect(markup.match(/>Discover Feeds</g) ?? []).toHaveLength(2)
    expect(markup.match(/>Wired Science/g) ?? []).toHaveLength(2)
    expect(markup.match(/>NASA/g) ?? []).toHaveLength(2)
    expect(markup.match(/href="\/app\/feed\/subscription-wired"/g) ?? []).toHaveLength(2)
    expect(markup.match(/href="\/app\/feed\/subscription-nasa"/g) ?? []).toHaveLength(2)
    expect(markup.match(/>Help</g) ?? []).toHaveLength(4)
    expect(markup.match(/>Contact support</g) ?? []).toHaveLength(2)
    expect(markup.match(/>Report a bug</g) ?? []).toHaveLength(2)
    expect(markup.match(/>Suggest a feature</g) ?? []).toHaveLength(2)
    expect(markup).toContain("Verify your email")
    expect(markup.match(/>Legal</g) ?? []).toHaveLength(2)
    expect(markup.match(/>Privacy Policy</g) ?? []).toHaveLength(2)
    expect(markup.match(/>Terms of Service</g) ?? []).toHaveLength(2)
    expect(markup.match(/>Cookie Policy</g) ?? []).toHaveLength(2)
    expect(markup.match(/>Security</g) ?? []).toHaveLength(2)
    expect(
      markup.match(
        /href="mailto:support@arcticrss\.com\?subject=Arctic%20RSS%20Support"/g
      ) ?? []
    ).toHaveLength(2)
    expect(markup.match(/href="\/legal"/g) ?? []).toHaveLength(2)
    expect(markup.match(/href="\/privacy"/g) ?? []).toHaveLength(2)
    expect(markup.match(/href="\/terms"/g) ?? []).toHaveLength(2)
    expect(markup.match(/href="\/cookies"/g) ?? []).toHaveLength(2)
    expect(markup.match(/href="\/security"/g) ?? []).toHaveLength(2)
    expect(markup.match(/>Support this project</g) ?? []).toHaveLength(2)
    expect(
      markup.match(/href="https:\/\/ko-fi\.com\/arcticrss"/g) ?? []
    ).toHaveLength(2)
    expect(markup.match(/>Collections</g) ?? []).toHaveLength(2)
    expect(markup.match(/>All collections</g) ?? []).toHaveLength(2)
    expect(markup.match(/>Read Later</g) ?? []).toHaveLength(2)
    expect(markup.match(/>Research</g) ?? []).toHaveLength(2)
    expect(
      markup.match(/href="\/app\/collections\/collection-read-later"/g) ?? []
    ).toHaveLength(2)
    expect(
      markup.match(/href="\/app\/collections\/collection-research"/g) ?? []
    ).toHaveLength(2)
    expect(
      markup.match(/href="\/app\/discover\?interest=general"/g) ?? []
    ).toHaveLength(2)
    expect(
      markup.match(/href="\/app\/discover\?interest=politics"/g) ?? []
    ).toHaveLength(2)

    const navSections = [
      ...markup.matchAll(/<nav\b[^>]*>[\s\S]*?<\/nav>/g),
    ].map(([section]) => section)

    expect(navSections).toHaveLength(2)

    for (const navSection of navSections) {
      const addFeedIndex = navSection.indexOf(">Add Feed<")
      const discoverIndex = navSection.indexOf(">Discover Feeds<")
      const wiredIndex = navSection.indexOf(">Wired Science")
      const nasaIndex = navSection.indexOf(">NASA")
      const podcastsIndex = navSection.indexOf(">Podcasts<")
      const discoverPodcastsIndex = navSection.indexOf(">Discover Podcasts<")
      const supportProjectIndex = navSection.indexOf(">Support this project<")
      const collectionsIndex = navSection.indexOf(">Collections<")
      const readLaterIndex = navSection.indexOf(">Read Later<")
      const foldersIndex = navSection.indexOf(">Folders<")
      const generalIndex = navSection.indexOf(">General<")
      const politicsIndex = navSection.indexOf(">Politics<")

      expect(addFeedIndex).toBeGreaterThan(-1)
      expect(discoverIndex).toBeGreaterThan(addFeedIndex)
      expect(wiredIndex).toBeGreaterThan(discoverIndex)
      expect(nasaIndex).toBeGreaterThan(wiredIndex)
      expect(podcastsIndex).toBeGreaterThan(-1)
      expect(discoverPodcastsIndex).toBeGreaterThan(podcastsIndex)
      expect(discoverPodcastsIndex).toBeGreaterThan(nasaIndex)
      expect(generalIndex).toBeGreaterThan(discoverPodcastsIndex)
      expect(politicsIndex).toBeGreaterThan(generalIndex)
      expect(foldersIndex).toBeGreaterThan(politicsIndex)
      expect(collectionsIndex).toBeGreaterThan(foldersIndex)
      expect(readLaterIndex).toBeGreaterThan(collectionsIndex)
      expect(supportProjectIndex).toBeGreaterThan(-1)
      expect(supportProjectIndex).toBeGreaterThan(readLaterIndex)
    }
  })

  it("marks the reader shell dark when the saved theme is a dark reader theme", () => {
    const markup = renderToStaticMarkup(
      <AppShell
        articleCollections={[]}
        discoverInterests={discoverInterests}
        feedSubscriptions={[]}
        folders={[]}
        displayMode="THREE_PANE"
        readerCounts={{ allCount: 0, starredCount: 0, unreadCount: 0 }}
        themePreference="GREY"
        user={{ email: "reader@example.com", name: "Reader", role: "USER" }}
      >
        <div>Reader content</div>
      </AppShell>
    )

    expect(markup).toContain('data-theme-preference="grey"')
    expect(markup).toContain('data-reader-theme="grey"')
    expect(markup).toContain('class="dark min-h-screen bg-background text-foreground"')
  })

  it("uses a collapsed navigation shell for minimal display mode", () => {
    const markup = renderToStaticMarkup(
      <AppShell
        articleCollections={[]}
        discoverInterests={discoverInterests}
        feedSubscriptions={[]}
        folders={[]}
        displayMode="MINIMAL"
        readerCounts={{ allCount: 0, starredCount: 0, unreadCount: 0 }}
        themePreference="SYSTEM"
        user={{ email: "reader@example.com", name: "Reader", role: "USER" }}
      >
        <div>Reader content</div>
      </AppShell>
    )

    expect(markup).toContain('data-display-mode="minimal"')
    expect(markup).not.toContain("lg:pl-64")
    expect(markup).toContain("Open navigation")
  })

  it("routes navigation through guest pages and shows a signup path in guest mode", () => {
    const markup = renderToStaticMarkup(
      <AppShell
        articleCollections={[]}
        discoverInterests={discoverInterests}
        feedSubscriptions={[]}
        folders={[]}
        displayMode="THREE_PANE"
        guestMode
        readerCounts={{ allCount: 7, starredCount: 0, unreadCount: 7 }}
        themePreference="SYSTEM"
        user={{ email: null, name: "Guest", role: "USER" }}
      >
        <div>Guest reader content</div>
      </AppShell>
    )

    expect(markup).toContain("Browsing as guest")
    expect(markup.match(/href="\/guest"/g) ?? []).toHaveLength(4)
    expect(markup.match(/href="\/guest\/discover"/g) ?? []).toHaveLength(2)
    expect(markup.match(/href="\/guest\/podcasts\/discover"/g) ?? []).toHaveLength(2)
    expect(markup).toContain('href="/signup"')
    expect(markup).toContain(">Create account<")
    expect(markup).not.toContain(">Log out<")
    expect(markup).not.toContain(">Add Feed<")
  })
})

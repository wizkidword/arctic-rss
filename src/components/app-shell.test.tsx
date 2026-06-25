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
    DropdownMenuItem: Primitive,
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
  it("shows feed discovery after Add Feed and before the feed list on desktop and mobile", () => {
    const markup = renderToStaticMarkup(
      <AppShell
        feedSubscriptions={[]}
        folders={[]}
        readerCounts={{ allCount: 0, starredCount: 0, unreadCount: 0 }}
        user={{ email: "reader@example.com", name: "Reader", role: "USER" }}
      >
        <div>Reader content</div>
      </AppShell>
    )

    expect(markup.match(/href="\/app\/discover"/g) ?? []).toHaveLength(2)
    expect(markup.match(/>Discover Feeds</g) ?? []).toHaveLength(2)

    const navSections = [
      ...markup.matchAll(/<nav\b[^>]*>[\s\S]*?<\/nav>/g),
    ].map(([section]) => section)

    expect(navSections).toHaveLength(2)

    for (const navSection of navSections) {
      const addFeedIndex = navSection.indexOf(">Add Feed<")
      const discoverIndex = navSection.indexOf(">Discover Feeds<")
      const emptyFeedIndex = navSection.indexOf(
        "Add your first feed to start filling the reader."
      )

      expect(addFeedIndex).toBeGreaterThan(-1)
      expect(discoverIndex).toBeGreaterThan(addFeedIndex)
      expect(emptyFeedIndex).toBeGreaterThan(discoverIndex)
    }
  })
})

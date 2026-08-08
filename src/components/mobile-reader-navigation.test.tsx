// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react"
import {
  createContext,
  useContext,
  type PropsWithChildren,
  type ReactNode,
} from "react"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/dynamic", () => ({
  default: () => () => <nav>Lazy reader navigation</nav>,
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    size,
    variant,
    ...props
  }: React.ComponentProps<"button"> & { size?: string; variant?: string }) => {
    void size
    void variant

    return <button {...props}>{children}</button>
  },
}))

const sheetContext = createContext<((open: boolean) => void) | null>(null)

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children, onOpenChange }: PropsWithChildren<{ onOpenChange: (open: boolean) => void }>) => (
    <sheetContext.Provider value={onOpenChange}>{children}</sheetContext.Provider>
  ),
  SheetContent: ({ children }: PropsWithChildren) => <div>{children}</div>,
  SheetHeader: ({ children }: PropsWithChildren) => <div>{children}</div>,
  SheetTitle: ({ children }: PropsWithChildren) => <h2>{children}</h2>,
  SheetTrigger: ({ children, render }: PropsWithChildren<{ render: React.ReactElement }>) => {
    const onOpenChange = useContext(sheetContext)
    const renderChildren = (render.props as { children?: ReactNode }).children

    return (
      <button onClick={() => onOpenChange?.(true)} type="button">
        {renderChildren}
        {children}
      </button>
    )
  },
}))

import { MobileReaderNavigation } from "@/components/mobile-reader-navigation"

describe("MobileReaderNavigation", () => {
  it("does not mount reader navigation content until the sheet is opened", () => {
    render(
      <MobileReaderNavigation
        articleCollections={[]}
        discoverInterests={[]}
        feedSubscriptions={[]}
        folders={[]}
        readerCounts={{ allCount: 0, starredCount: 0, unreadCount: 0 }}
      />
    )

    expect(screen.queryByRole("navigation")).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }))

    expect(screen.getByRole("navigation").textContent).toContain("Lazy reader navigation")
  })
})

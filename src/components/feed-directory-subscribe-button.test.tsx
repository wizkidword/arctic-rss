import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const hooks = vi.hoisted(() => ({
  action: vi.fn(),
  actionState: null as null | {
    message: string
    status: "idle" | "success" | "error"
  },
  pending: false,
  setOpen: vi.fn(),
}))

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>()

  return {
    ...actual,
    useActionState: vi.fn((_action, initialState) => [
      hooks.actionState ?? initialState,
      hooks.action,
      hooks.pending,
    ]),
    useEffect: vi.fn((effect) => effect()),
    useState: vi.fn((initialState) => [initialState, hooks.setOpen]),
  }
})

vi.mock("@/app/app/actions", () => ({
  subscribeDirectoryFeedAction: vi.fn(),
}))

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({
    children,
  }: {
    children: React.ReactNode
    onOpenChange?: (open: boolean) => void
    open?: boolean
  }) => <div>{children}</div>,
  AlertDialogCancel: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => (
    <footer>{children}</footer>
  ),
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => (
    <header>{children}</header>
  ),
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  AlertDialogTrigger: ({
    children,
  }: {
    children: React.ReactNode
    render?: React.ReactElement
  }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/button", () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    size?: string
    variant?: string
  }) => (
    <button className={props.className} disabled={props.disabled} type={props.type}>
      {props.children}
    </button>
  ),
}))

import {
  FeedDirectorySubscribeButton,
  FeedDirectorySubscribeDialogContent,
} from "./feed-directory-subscribe-button"

const folders = [
  { id: "morning-news", name: "Morning News" },
  { id: "research", name: "Research" },
]

describe("FeedDirectorySubscribeDialogContent", () => {
  it("names the feed and defaults the folder picker to Uncategorized", () => {
    const markup = renderToStaticMarkup(
      <FeedDirectorySubscribeDialogContent
        action={() => undefined}
        feedId="npr-national"
        feedLabel="NPR - National"
        folders={folders}
        pending={false}
        state={{ message: "", status: "idle" }}
      />
    )

    expect(markup).toContain("Subscribe to NPR - National")
    expect(markup).toContain('name="directoryFeedId"')
    expect(markup).toContain('value="npr-national"')
    expect(markup).toContain('name="folderId"')
    expect(markup).toContain(
      '<option value="" selected="">Uncategorized</option>'
    )
    expect(markup).toContain(">Morning News</option>")
    expect(markup).toContain(">Research</option>")
  })

  it("disables every action while pending and announces feed-specific errors", () => {
    const markup = renderToStaticMarkup(
      <FeedDirectorySubscribeDialogContent
        action={() => undefined}
        feedId="npr-national"
        feedLabel="NPR - National"
        folders={folders}
        pending
        state={{
          message: "NPR - National could not be subscribed. Try again.",
          status: "error",
        }}
      />
    )

    expect(markup.match(/disabled=""/g)).toHaveLength(3)
    expect(markup).toContain("Subscribing")
    expect(markup).toContain(
      "NPR - National could not be subscribed. Try again."
    )
    expect(markup).toContain('aria-live="polite"')
  })
})

describe("FeedDirectorySubscribeButton", () => {
  beforeEach(() => {
    hooks.action.mockReset()
    hooks.actionState = null
    hooks.pending = false
    hooks.setOpen.mockReset()
  })

  it("renders an available feed-specific Subscribe command", () => {
    const markup = renderToStaticMarkup(
      <FeedDirectorySubscribeButton
        feedId="npr-national"
        feedLabel="NPR - National"
        folders={folders}
        subscribed={false}
      />
    )

    expect(markup).toContain("Subscribe")
    expect(markup).toContain(
      '<span class="sr-only"> to NPR - National</span>'
    )
  })

  it("renders a disabled feed-specific Subscribed state", () => {
    const markup = renderToStaticMarkup(
      <FeedDirectorySubscribeButton
        feedId="npr-national"
        feedLabel="NPR - National"
        folders={folders}
        subscribed
      />
    )

    expect(markup).toContain("disabled")
    expect(markup).toContain("Subscribed")
    expect(markup).toContain(
      '<span class="sr-only"> to NPR - National</span>'
    )
  })

  it("closes the dialog when the action state becomes successful", () => {
    hooks.actionState = {
      message: "Subscribed to NPR - National.",
      status: "success",
    }

    renderToStaticMarkup(
      <FeedDirectorySubscribeButton
        feedId="npr-national"
        feedLabel="NPR - National"
        folders={folders}
        subscribed={false}
      />
    )

    expect(hooks.setOpen).toHaveBeenCalledWith(false)
  })
})

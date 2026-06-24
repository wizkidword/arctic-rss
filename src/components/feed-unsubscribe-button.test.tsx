import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>()

  return {
    ...actual,
    useActionState: vi.fn((_action, initialState) => [
      initialState,
      vi.fn(),
      false,
    ]),
  }
})

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    replace: vi.fn(),
  }),
}))

vi.mock("@/app/app/actions", () => ({
  unsubscribeFeedAction: vi.fn(),
}))

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
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
  AlertDialogTrigger: ({ children }: { children: React.ReactNode }) => (
    <button>{children}</button>
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

import {
  FeedUnsubscribeButton,
  FeedUnsubscribeDialogContent,
} from "./feed-unsubscribe-button"

describe("FeedUnsubscribeButton", () => {
  it("names the feed and explains preserved history", () => {
    const markup = renderToStaticMarkup(
      <FeedUnsubscribeDialogContent
        action={() => undefined}
        feedTitle="Example Feed"
        pending={false}
        state={{ message: "", status: "idle" }}
        subscriptionId="subscription-1"
      />
    )

    expect(markup).toContain("Unsubscribe from Example Feed?")
    expect(markup).toContain(
      "Articles and your read and starred history will be preserved."
    )
    expect(markup).toContain('name="subscriptionId"')
    expect(markup).toContain('value="subscription-1"')
    expect(markup).toContain("Cancel")
    expect(markup).toContain('type="button"')
    expect(markup).toContain("Unsubscribe")
  })

  it("disables confirmation and shows errors", () => {
    const markup = renderToStaticMarkup(
      <FeedUnsubscribeDialogContent
        action={() => undefined}
        feedTitle="Example Feed"
        pending
        state={{
          message: "That feed subscription was not found.",
          status: "error",
        }}
        subscriptionId="subscription-1"
      />
    )

    expect(markup).toContain("Unsubscribing")
    expect(markup).toContain("disabled")
    expect(markup).toContain("That feed subscription was not found.")
  })

  it("renders a destructive feed-specific trigger", () => {
    const markup = renderToStaticMarkup(
      <FeedUnsubscribeButton
        feedTitle="Example Feed"
        subscriptionId="subscription-1"
      />
    )

    expect(markup).toContain("Unsubscribe")
    expect(markup).toContain("Example Feed")
  })
})

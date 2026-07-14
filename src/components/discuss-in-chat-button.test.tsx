import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <footer>{children}</footer>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}))

import { DiscussInChatButton } from "./discuss-in-chat-button"

describe("DiscussInChatButton", () => {
  it("offers a deliberate Reader-to-chat entry point", () => {
    const markup = renderToStaticMarkup(
      <DiscussInChatButton
        articleId="article-1234"
        rooms={[
          {
            description: "AI discussion",
            id: "room-ai",
            interestIds: ["technology"],
            isOfficial: true,
            matchedInterestIds: ["technology"],
            name: "AI",
            score: 1,
            slug: "ai",
            topicLine: null,
          },
        ]}
      />
    )

    expect(markup).toContain("Discuss in Chat")
  })
})

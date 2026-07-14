import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

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

import { ChatReportButton } from "./chat-report-button"

describe("ChatReportButton", () => {
  it("provides a private reporting entry point", () => {
    const markup = renderToStaticMarkup(
      <ChatReportButton
        label="Report"
        messageId="message-1234"
        onSubmitted={() => {}}
      />
    )

    expect(markup).toContain("Report")
    expect(markup).toContain("Reports are private to the moderation queue")
  })
})

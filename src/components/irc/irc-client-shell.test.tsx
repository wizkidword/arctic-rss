import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock("socket.io-client", () => ({
  io: vi.fn(),
}))

import { IrcClientShell } from "./irc-client-shell"

describe("Arctic IRC client shell", () => {
  it("guides a first-time chat user through handle creation", () => {
    const markup = renderToStaticMarkup(
      <IrcClientShell initialProfile={null} rooms={[]} />
    )

    expect(markup).toContain("Choose your chat handle")
    expect(markup).toContain('id="irc-handle"')
    expect(markup).toContain("Back to Reader")
  })

  it("renders a classic client shell with room and connection controls", () => {
    const markup = renderToStaticMarkup(
      <IrcClientShell
        initialProfile={{ handle: "northernlights", id: "profile-1", userId: "user-1" }}
        rooms={[{
          description: "AI discussion",
          id: "room-ai",
          interestIds: ["ai"],
          isOfficial: true,
          name: "AI",
          slug: "ai",
          topicLine: "Models and research",
        }]}
      />
    )

    expect(markup).toContain("Arctic Network")
    expect(markup).toContain("Connect")
    expect(markup).toContain("Status")
    expect(markup).toContain("ai")
    expect(markup).toContain("Ctrl/⌘ K focuses the composer")
  })
})

// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock("socket.io-client", () => ({
  io: vi.fn(),
}))

import { getNetworkStatusPresentation, IrcClientShell } from "./irc-client-shell"
import { io } from "socket.io-client"

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe("Arctic IRC client shell", () => {
  it("requests a fresh session when the member explicitly connects", async () => {
    const listeners = new Map<string, () => void>()
    const socket = {
      connect: vi.fn(() => {
        socket.connected = true
        listeners.get("connect")?.()
      }),
      connected: false,
      disconnect: vi.fn(),
      emit: vi.fn(),
      on: vi.fn((event: string, listener: () => void) => {
        listeners.set(event, listener)
        return socket
      }),
    }
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ token: "fresh-session-token" }),
      ok: true,
    })

    vi.mocked(io).mockReturnValue(socket as never)
    vi.stubGlobal("fetch", fetchMock)

    const { unmount } = render(
      <IrcClientShell
        initialProfile={{ handle: "northernlights", id: "profile-1", userId: "user-1" }}
        rooms={[]}
      />
    )

    expect(fetchMock).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Connect" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/chat/session", { method: "POST" }))
    await waitFor(() => expect(socket.connect).toHaveBeenCalledTimes(1))
    expect(screen.getByLabelText("Network online")).toBeTruthy()

    unmount()
    expect(socket.disconnect).toHaveBeenCalledTimes(1)
  })

  it("uses the live gateway connection state for the network status indicator", () => {
    expect(getNetworkStatusPresentation("connected")).toEqual({
      icon: "wifi",
      label: "Network online",
    })
    expect(getNetworkStatusPresentation("connecting")).toEqual({
      icon: "wifi-off",
      label: "Network offline",
    })
    expect(getNetworkStatusPresentation("offline")).toEqual({
      icon: "wifi-off",
      label: "Network offline",
    })
  })

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
    expect(markup).toContain('aria-label="Network offline"')
    expect(markup).toContain("ai")
    expect(markup).toContain("Ctrl/⌘ K focuses the composer")
  })
})

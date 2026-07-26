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

import {
  getNetworkStatusPresentation,
  hasChatMessageSequenceGap,
  IrcClientShell,
  mergeChatMessages,
} from "./irc-client-shell"
import { io } from "socket.io-client"

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe("Arctic IRC client shell", () => {
  it("requests a fresh session and reconnects after a page refresh", async () => {
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

  it("de-duplicates replayed messages and detects a sequence gap for history repair", () => {
    const first = {
      body: "First",
      clientMessageId: "message-0001",
      createdAt: "2026-07-14T12:00:00.000Z",
      id: "message-1",
      kind: "TEXT",
      roomId: "room-1",
      senderUserId: "user-1",
      sequence: "1",
    }
    const third = { ...first, body: "Third", id: "message-3", sequence: "3" }

    expect(mergeChatMessages([first], [first, third])).toEqual([first, third])
    expect(hasChatMessageSequenceGap([first], third)).toBe(true)
    expect(hasChatMessageSequenceGap([first], { ...first, id: "message-2", sequence: "2" })).toBe(false)
  })

  it("repairs a room transcript when a live message arrives with a sequence gap", async () => {
    const listeners = new Map<string, (payload?: unknown) => void>()
    const socket = {
      connect: vi.fn(() => {
        socket.connected = true
        listeners.get("connect")?.()
      }),
      connected: false,
      disconnect: vi.fn(),
      emit: vi.fn(),
      on: vi.fn((event: string, listener: (payload?: unknown) => void) => {
        listeners.set(event, listener)
        return socket
      }),
    }
    const first = {
      body: "First retained message",
      clientMessageId: "message-0001",
      createdAt: "2026-07-14T12:00:00.000Z",
      id: "message-1",
      kind: "TEXT",
      roomId: "room-ai",
      senderHandle: "northernlights",
      senderUserId: "user-1",
      sequence: "1",
    }
    const second = { ...first, body: "Recovered missed message", id: "message-2", sequence: "2" }
    const third = { ...first, body: "Live message after the gap", id: "message-3", sequence: "3" }
    const room = {
      description: "AI discussion",
      id: "room-ai",
      interestIds: ["ai"],
      isOfficial: true,
      name: "AI",
      slug: "ai",
      topicLine: "Models and research",
    }
    let roomSnapshotRequests = 0
    const fetchMock = vi.fn(async (input: string) => {
      if (input === "/api/chat/session") {
        return { json: async () => ({ token: "fresh-session-token" }), ok: true }
      }
      if (input === "/api/chat/rooms/ai/membership") {
        return { ok: true }
      }
      if (input === "/api/chat/rooms/ai") {
        roomSnapshotRequests += 1
        return {
          json: async () => ({
            messages: roomSnapshotRequests === 1 ? [first] : [first, second],
            room,
          }),
          ok: true,
        }
      }
      throw new Error(`Unexpected request: ${input}`)
    })

    vi.mocked(io).mockReturnValue(socket as never)
    vi.stubGlobal("fetch", fetchMock)
    render(
      <IrcClientShell
        initialProfile={{ handle: "northernlights", id: "profile-1", userId: "user-1" }}
        rooms={[room]}
      />
    )

    await waitFor(() => expect(screen.getByRole("button", { name: /ai.*join/i })).toBeTruthy())
    fireEvent.click(screen.getByRole("button", { name: /ai.*join/i }))
    await waitFor(() => expect(screen.getByText("First retained message")).toBeTruthy())

    listeners.get("room:message")?.(third)

    await waitFor(() => expect(screen.getByText("Recovered missed message")).toBeTruthy())
    expect(roomSnapshotRequests).toBe(2)
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

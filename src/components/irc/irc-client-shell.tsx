"use client"

import { FormEvent, KeyboardEvent, useEffect, useRef, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import {
  BookOpenIcon,
  CompassIcon,
  HashIcon,
  MenuIcon,
  MessageCircleIcon,
  PaletteIcon,
  RadioIcon,
  RotateCwIcon,
  SendIcon,
  UsersIcon,
  WifiIcon,
  WifiOffIcon,
} from "lucide-react"
import { io, type Socket } from "socket.io-client"

import { Button } from "@/components/ui/button"
import { ChatReportButton } from "@/components/irc/chat-report-button"
import {
  ChatCommandParseError,
  listChatCommandSuggestions,
  parseChatCommand,
  type ChatCommand,
} from "@/lib/chat/commands"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

type ChatProfile = {
  handle: string
  id: string
  userId: string
}

type ChatRoom = {
  description: string
  id: string
  interestIds: string[]
  isOfficial: boolean
  name: string
  slug: string
  topicLine: string | null
}

type ChatMessage = {
  article?: { id: string; publisher: string; title: string } | null
  body: string
  clientMessageId: string
  createdAt: string
  id: string
  kind: string
  roomId: string
  senderHandle?: string | null
  senderUserId: string | null
  sequence: string
}

type ChatRoomSnapshot = {
  messages: ChatMessage[]
  room: ChatRoom
}

type IrcTheme = "classic" | "light" | "modern" | "terminal"
type ConnectionState = "connected" | "connecting" | "offline"

const HIDE_ARCTIC_BOT_STORAGE_KEY = "arctic-rss:irc:hide-arctic-bot"
const ARCTIC_BOT_VISIBILITY_EVENT = "arctic-rss:irc:arctic-bot-visibility"
const BOT_VISIBILITY_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1_000

function subscribeToArcticBotVisibility(listener: () => void) {
  window.addEventListener(ARCTIC_BOT_VISIBILITY_EVENT, listener)
  return () => window.removeEventListener(ARCTIC_BOT_VISIBILITY_EVENT, listener)
}

function readArcticBotVisibility() {
  try {
    const rawValue = window.localStorage.getItem(HIDE_ARCTIC_BOT_STORAGE_KEY)

    if (!rawValue) {
      return false
    }

    const value: unknown = JSON.parse(rawValue)

    if (
      !value ||
      typeof value !== "object" ||
      (value as { hidden?: unknown }).hidden !== true ||
      typeof (value as { updatedAt?: unknown }).updatedAt !== "string"
    ) {
      return false
    }

    const updatedAt = new Date((value as { updatedAt: string }).updatedAt).getTime()
    return Number.isFinite(updatedAt) && Date.now() - updatedAt <= BOT_VISIBILITY_MAX_AGE_MS
  } catch {
    return false
  }
}

const localStatusMessages = [
  "Welcome to Arctic Network. Choose a room, then press Connect when the gateway is available.",
  "Your Arctic RSS identity is used here; no second account is created.",
  "Type /help for the safe, typed command vocabulary.",
]

export function IrcClientShell({
  initialProfile,
  initialRoomSlug,
  rooms,
}: {
  initialProfile: ChatProfile | null
  initialRoomSlug?: string
  rooms: ChatRoom[]
}) {
  const [profile, setProfile] = useState(initialProfile)

  if (!profile) {
    return <ChatProfileOnboarding onCreated={setProfile} />
  }

  return <ConnectedIrcClient initialRoomSlug={initialRoomSlug} profile={profile} rooms={rooms} />
}

function ChatProfileOnboarding({ onCreated }: { onCreated: (profile: ChatProfile) => void }) {
  const [handle, setHandle] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSaving(true)

    try {
      const response = await fetch("/api/chat/profile", {
        body: JSON.stringify({ handle }),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
      const payload = await response.json() as {
        error?: string
        profile?: ChatProfile
      }

      if (!response.ok || !payload.profile) {
        throw new Error(payload.error || "Unable to create your chat profile.")
      }

      onCreated(payload.profile)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create your chat profile.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_var(--color-primary)_0%,_transparent_26%)] p-4">
      <section className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-2xl shadow-primary/10">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <MessageCircleIcon className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Arctic Network</p>
            <h1 className="font-heading text-2xl font-semibold">Choose your chat handle</h1>
          </div>
        </div>
        <p className="mb-5 text-sm leading-6 text-muted-foreground">
          This stable name appears in Arctic IRC rooms. It is separate from your display name and cannot be changed casually.
        </p>
        <form className="space-y-4" onSubmit={submit}>
          <label className="grid gap-2 text-sm font-medium" htmlFor="irc-handle">
            Handle
            <input
              autoCapitalize="none"
              autoComplete="nickname"
              className="h-10 rounded-lg border bg-background px-3 font-mono text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              id="irc-handle"
              maxLength={24}
              onChange={(event) => setHandle(event.target.value)}
              placeholder="northernlights"
              required
              value={handle}
            />
          </label>
          <p className="text-xs leading-5 text-muted-foreground">3–24 lowercase letters, numbers, hyphens, or underscores; starts with a letter.</p>
          {error ? <p aria-live="polite" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
          <div className="flex items-center justify-between gap-3 pt-2">
            <Link className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" href="/app">Back to Reader</Link>
            <Button disabled={isSaving} type="submit">
              {isSaving ? "Saving…" : "Enter Arctic IRC"}
            </Button>
          </div>
        </form>
      </section>
    </main>
  )
}

function ConnectedIrcClient({ initialRoomSlug, profile: initialProfile, rooms }: { initialRoomSlug?: string; profile: ChatProfile; rooms: ChatRoom[] }) {
  const [profile, setProfile] = useState(initialProfile)
  const [connectionState, setConnectionState] = useState<ConnectionState>("offline")
  const [activeTab, setActiveTab] = useState<string>("status")
  const [joinedRooms, setJoinedRooms] = useState<Record<string, ChatRoomSnapshot>>({})
  const [clearedRoomIds, setClearedRoomIds] = useState<Set<string>>(() => new Set())
  const [ignoredHandles, setIgnoredHandles] = useState<Set<string>>(() => new Set())
  const [composerHistory, setComposerHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [notice, setNotice] = useState("Gateway is offline. You can still browse room descriptions.")
  const [composer, setComposer] = useState("")
  const [theme, setTheme] = useState<IrcTheme>("classic")
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const initialRoomJoinAttempted = useRef(false)
  const socketRef = useRef<Socket | null>(null)
  const hideArcticBotMessages = useSyncExternalStore(
    subscribeToArcticBotVisibility,
    readArcticBotVisibility,
    () => false
  )

  const activeRoom = activeTab === "status" ? null : joinedRooms[activeTab]?.room ?? null
  const activeMessages = activeRoom ? joinedRooms[activeRoom.id]?.messages ?? [] : []
  const visibleMessages = activeRoom && clearedRoomIds.has(activeRoom.id)
    ? []
    : activeMessages.filter(
        (message) =>
          (message.kind !== "BOT" || !hideArcticBotMessages) &&
          (!message.senderHandle || !ignoredHandles.has(message.senderHandle))
      )
  const commandSuggestions = listChatCommandSuggestions(composer)

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        composerRef.current?.focus()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect()
    }
  }, [])

  async function connect() {
    if (connectionState === "connecting" || connectionState === "connected") {
      return
    }

    setConnectionState("connecting")
    setNotice("Requesting a short-lived gateway session…")

    try {
      const response = await fetch("/api/chat/session", { method: "POST" })
      const payload = await response.json() as { error?: string; token?: string }

      if (!response.ok || !payload.token) {
        throw new Error(payload.error || "Unable to start a chat session.")
      }

      socketRef.current?.disconnect()
      const socket = io({
        auth: { token: payload.token },
        autoConnect: false,
        path: "/socket.io",
        reconnection: false,
        transports: ["websocket"],
      })
      socketRef.current = socket

      socket.on("connect", () => {
        setConnectionState("connected")
        setNotice("Connected to Arctic Network.")
        Object.values(joinedRooms).forEach((snapshot) => subscribeToRoom(socket, snapshot.room.slug))
      })
      socket.on("connect_error", () => {
        setConnectionState("offline")
        setNotice("Gateway unavailable. Check the connection and try again.")
      })
      socket.on("disconnect", () => {
        setConnectionState("offline")
        setNotice("Connection closed. Reconnect to request a fresh session token.")
      })
      socket.on("room:message", (message: ChatMessage) => {
        setJoinedRooms((current) => {
          const snapshot = current[message.roomId]

          if (!snapshot || snapshot.messages.some((item) => item.id === message.id)) {
            return current
          }

          return {
            ...current,
            [message.roomId]: { ...snapshot, messages: [...snapshot.messages, message] },
          }
        })
        setClearedRoomIds((current) => {
          if (!current.has(message.roomId)) {
            return current
          }

          const next = new Set(current)
          next.delete(message.roomId)
          return next
        })
      })
      socket.connect()
    } catch (reason) {
      setConnectionState("offline")
      setNotice(reason instanceof Error ? reason.message : "Unable to connect to chat.")
    }
  }

  async function joinRoom(room: ChatRoom) {
    setNotice(`Joining #${room.slug}…`)

    try {
      const membership = await fetch(`/api/chat/rooms/${encodeURIComponent(room.slug)}/membership`, {
        method: "POST",
      })

      if (!membership.ok) {
        throw new Error("Unable to join this room.")
      }

      const response = await fetch(`/api/chat/rooms/${encodeURIComponent(room.slug)}`)
      const snapshot = await response.json() as ChatRoomSnapshot & { error?: string }

      if (!response.ok || !snapshot.room) {
        throw new Error(snapshot.error || "Unable to open this room.")
      }

      setJoinedRooms((current) => ({ ...current, [snapshot.room.id]: snapshot }))
      setClearedRoomIds((current) => {
        const next = new Set(current)
        next.delete(snapshot.room.id)
        return next
      })
      setActiveTab(snapshot.room.id)
      setNotice(`Joined #${snapshot.room.slug}.`)

      if (socketRef.current?.connected) {
        subscribeToRoom(socketRef.current, snapshot.room.slug)
      }
      return true
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Unable to join this room.")
      return false
    }
  }

  useEffect(() => {
    if (initialRoomJoinAttempted.current || !initialRoomSlug) {
      return
    }

    const room = rooms.find((candidate) => candidate.slug === initialRoomSlug)
    if (room) {
      initialRoomJoinAttempted.current = true
      const timer = window.setTimeout(() => {
        void joinRoom(room)
      }, 0)

      return () => window.clearTimeout(timer)
    }
  }, [initialRoomSlug, rooms])

  async function leaveRoom(reason?: string) {
    if (!activeRoom) {
      setNotice("Open a room before using /part.")
      return
    }

    try {
      const response = await fetch(`/api/chat/rooms/${encodeURIComponent(activeRoom.slug)}/membership`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Unable to leave this room.")
      }

      socketRef.current?.emit("room:unsubscribe", { roomId: activeRoom.id })
      setJoinedRooms((current) => {
        const next = { ...current }
        delete next[activeRoom.id]
        return next
      })
      setActiveTab("status")
      setNotice(`Left #${activeRoom.slug}${reason ? `: ${reason}` : "."}`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to leave this room.")
    }
  }

  function rememberComposerEntry(value: string) {
    const entry = value.trim()

    if (!entry) {
      return
    }

    setComposerHistory((current) =>
      current[0] === entry ? current : [entry, ...current].slice(0, 20)
    )
    setHistoryIndex(-1)
  }

  function emitMessage(body: string, kind: "ACTION" | "TEXT" = "TEXT") {
    if (!activeRoom) {
      setNotice("Open a room before sending a message.")
      return
    }

    const socket = socketRef.current

    if (!socket?.connected) {
      setNotice("Reconnect before sending a message.")
      return
    }

    socket.emit(
      "room:message",
      {
        body,
        clientMessageId: crypto.randomUUID(),
        kind,
        roomId: activeRoom.id,
      },
      (result: { error?: string; ok?: boolean }) => {
        if (!result.ok) {
          setNotice(result.error === "rate-limited" ? "You are sending too quickly." : "Message was not accepted.")
        }
      }
    )
  }

  function toggleArcticBotVisibility() {
    const next = !hideArcticBotMessages
    try {
      window.localStorage.setItem(
        HIDE_ARCTIC_BOT_STORAGE_KEY,
        JSON.stringify({ hidden: next, updatedAt: new Date().toISOString() })
      )
    } catch {
      // The current shell state still applies when storage is unavailable.
    }
    window.dispatchEvent(new Event(ARCTIC_BOT_VISIBILITY_EVENT))
  }

  async function disableArcticBotForActiveRoom() {
    if (!activeRoom) {
      return
    }

    try {
      const response = await fetch(
        `/api/chat/rooms/${encodeURIComponent(activeRoom.slug)}/bot`,
        {
          body: JSON.stringify({ action: "disable" }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }
      )
      const payload = (await response.json()) as {
        disabledFeedCount?: number
        error?: string
      }
      if (!response.ok || payload.disabledFeedCount === undefined) {
        throw new Error(payload.error || "Unable to disable ArcticBot.")
      }
      setNotice(
        payload.disabledFeedCount
          ? `Disabled ArcticBot for ${payload.disabledFeedCount} room feed${payload.disabledFeedCount === 1 ? "" : "s"}.`
          : "ArcticBot is already disabled for this room."
      )
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to disable ArcticBot.")
    }
  }

  async function executeCommand(command: ChatCommand) {
    switch (command.type) {
      case "join": {
        const room = rooms.find((candidate) => candidate.slug === command.slug)
        if (!room) {
          setNotice(`Room #${command.slug} is not in the public directory.`)
          return
        }
        await joinRoom(room)
        return
      }
      case "part":
        await leaveRoom(command.reason)
        return
      case "action":
        emitMessage(command.body, "ACTION")
        return
      case "nick": {
        try {
          const response = await fetch("/api/chat/profile", {
            body: JSON.stringify({ handle: command.handle }),
            headers: { "content-type": "application/json" },
            method: "PATCH",
          })
          const payload = await response.json() as { error?: string; profile?: ChatProfile }
          if (!response.ok || !payload.profile) {
            throw new Error(payload.error || "Unable to change your handle.")
          }
          setProfile(payload.profile)
          setNotice(`Your handle is now ${payload.profile.handle}.`)
        } catch (error) {
          setNotice(error instanceof Error ? error.message : "Unable to change your handle.")
        }
        return
      }
      case "topic": {
        if (!activeRoom) {
          setNotice("Open a room before using /topic.")
          return
        }
        if (!command.topic) {
          setNotice(`Topic for #${activeRoom.slug}: ${activeRoom.topicLine || activeRoom.description}`)
          return
        }
        const topic = command.topic
        try {
          const response = await fetch(`/api/chat/rooms/${encodeURIComponent(activeRoom.slug)}`, {
            body: JSON.stringify({ topic }),
            headers: { "content-type": "application/json" },
            method: "PATCH",
          })
          const payload = await response.json() as { error?: string; topicLine?: string | null }
          if (!response.ok) {
            throw new Error(payload.error || "Unable to update the room topic.")
          }
          setJoinedRooms((current) => ({
            ...current,
            [activeRoom.id]: {
              ...current[activeRoom.id],
              room: { ...current[activeRoom.id].room, topicLine: payload.topicLine ?? topic },
            },
          }))
          setNotice(`Updated the topic for #${activeRoom.slug}.`)
        } catch (error) {
          setNotice(error instanceof Error ? error.message : "Unable to update the room topic.")
        }
        return
      }
      case "whois": {
        if (!activeRoom) {
          setNotice("Open a room before using /whois.")
          return
        }
        try {
          const response = await fetch(`/api/chat/rooms/${encodeURIComponent(activeRoom.slug)}/whois/${encodeURIComponent(command.handle)}`)
          const payload = await response.json() as { error?: string; handle?: string; role?: string }
          if (!response.ok || !payload.handle || !payload.role) {
            throw new Error(payload.error || "That member could not be found in this room.")
          }
          setNotice(`${payload.handle} is an active ${payload.role.toLowerCase()} in #${activeRoom.slug}.`)
        } catch (error) {
          setNotice(error instanceof Error ? error.message : "Unable to look up that member.")
        }
        return
      }
      case "kick":
      case "ban":
      case "unban":
      case "mute": {
        if (!activeRoom) {
          setNotice(`Open a room before using /${command.type}.`)
          return
        }

        const body =
          command.type === "unban"
            ? { targetHandle: command.handle }
            : {
                ...(command.type === "ban"
                  ? { durationSeconds: command.duration ? commandDurationToSeconds(command.duration) : null }
                  : command.type === "mute"
                    ? { durationSeconds: commandDurationToSeconds(command.duration ?? "15m") }
                    : {}),
                reason:
                  command.type === "mute"
                    ? "Muted by a room moderator."
                    : command.reason ?? "Moderation action by a room moderator.",
                targetHandle: command.handle,
              }
        try {
          const response = await fetch(
            `/api/chat/rooms/${encodeURIComponent(activeRoom.slug)}/moderation/${command.type}`,
            {
              body: JSON.stringify(body),
              headers: { "content-type": "application/json" },
              method: "POST",
            }
          )
          const payload = (await response.json()) as { error?: string; targetHandle?: string }
          if (!response.ok || !payload.targetHandle) {
            throw new Error(payload.error || `Unable to complete /${command.type}.`)
          }
          setNotice(
            command.type === "unban"
              ? `Removed the room ban for ${payload.targetHandle}.`
              : `${command.type[0].toUpperCase()}${command.type.slice(1)} action applied to ${payload.targetHandle}.`
          )
        } catch (error) {
          setNotice(error instanceof Error ? error.message : `Unable to complete /${command.type}.`)
        }
        return
      }
      case "clear":
        if (!activeRoom) {
          setNotice("Open a room before using /clear.")
          return
        }
        setClearedRoomIds((current) => new Set(current).add(activeRoom.id))
        setNotice("Cleared this local transcript. Retained chat history was not changed.")
        return
      case "rooms": {
        const search = command.search?.toLowerCase()
        const matchingRooms = rooms.filter((room) =>
          !search ||
          room.slug.includes(search) ||
          room.name.toLowerCase().includes(search) ||
          room.description.toLowerCase().includes(search)
        )
        setNotice(
          matchingRooms.length
            ? `Public rooms: ${matchingRooms.map((room) => `#${room.slug}`).join(", ")}`
            : "No public rooms match that search."
        )
        return
      }
      case "ignore":
      case "unignore": {
        try {
          const response = await fetch(`/api/chat/blocks/${encodeURIComponent(command.handle)}`, {
            method: command.type === "ignore" ? "POST" : "DELETE",
          })
          const payload = await response.json() as { error?: string; handle?: string }
          if (!response.ok || !payload.handle) {
            throw new Error(payload.error || "Unable to update your ignored handles.")
          }
          setIgnoredHandles((current) => {
            const next = new Set(current)
            if (command.type === "ignore") {
              next.add(payload.handle!)
            } else {
              next.delete(payload.handle!)
            }
            return next
          })
          setNotice(command.type === "ignore" ? `Ignoring ${payload.handle}.` : `Stopped ignoring ${payload.handle}.`)
        } catch (error) {
          setNotice(error instanceof Error ? error.message : "Unable to update your ignored handles.")
        }
        return
      }
      case "help":
        setNotice(commandHelp(command.command))
        return
      default:
        setNotice(`/${command.type} is parsed safely but will be available with server-side moderation controls.`)
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const value = composer.trim()
    if (!value) {
      return
    }

    rememberComposerEntry(value)
    setComposer("")

    if (value.startsWith("/")) {
      try {
        await executeCommand(parseChatCommand(value))
      } catch (error) {
        setNotice(error instanceof ChatCommandParseError ? error.message : "Command could not be processed.")
      }
      return
    }

    emitMessage(value)
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Tab" && commandSuggestions.length) {
      event.preventDefault()
      setComposer(`${commandSuggestions[0]} `)
      return
    }

    if (event.key === "ArrowUp" && composerHistory.length) {
      event.preventDefault()
      const nextIndex = Math.min(historyIndex + 1, composerHistory.length - 1)
      setHistoryIndex(nextIndex)
      setComposer(composerHistory[nextIndex])
      return
    }

    if (event.key === "ArrowDown" && historyIndex >= 0) {
      event.preventDefault()
      const nextIndex = historyIndex - 1
      setHistoryIndex(nextIndex)
      setComposer(nextIndex < 0 ? "" : composerHistory[nextIndex])
      return
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
  }

  return (
    <main className={cn("min-h-screen p-2 sm:p-3 lg:p-4", shellTheme(theme))}>
      <section className="mx-auto flex min-h-[calc(100dvh-1rem)] max-w-[1800px] flex-col overflow-hidden rounded-xl border bg-card shadow-2xl shadow-black/10 sm:min-h-[calc(100dvh-1.5rem)]">
        <IrcToolbar connectionState={connectionState} notice={notice} onConnect={connect} theme={theme} onThemeChange={setTheme} />
        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-60 shrink-0 border-r bg-muted/30 p-3 lg:block">
            <ServerTree activeTab={activeTab} joinedRooms={joinedRooms} onSelect={setActiveTab} profile={profile} rooms={rooms} onJoin={joinRoom} />
          </aside>
          <div className="flex min-w-0 flex-1 flex-col">
            <MobileRoomControls activeTab={activeTab} joinedRooms={joinedRooms} onSelect={setActiveTab} profile={profile} rooms={rooms} onJoin={joinRoom} />
            <IrcTabs activeTab={activeTab} joinedRooms={joinedRooms} onSelect={setActiveTab} />
            <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_13rem]">
              <section className="flex min-h-0 min-w-0 flex-1 flex-col">
                {activeRoom ? <RoomHeading hideArcticBotMessages={hideArcticBotMessages} onDisableArcticBot={disableArcticBotForActiveRoom} onReportSubmitted={setNotice} onToggleArcticBotVisibility={toggleArcticBotVisibility} room={activeRoom} /> : <StatusHeading connectionState={connectionState} />}
                <Transcript messages={activeRoom ? visibleMessages : []} onReportSubmitted={setNotice} profile={profile} status={!activeRoom} />
                <form className="border-t bg-background/70 p-3" onSubmit={sendMessage}>
                  <label className="sr-only" htmlFor="irc-composer">Message</label>
                  <textarea
                    className="min-h-20 w-full resize-none rounded-lg border bg-background px-3 py-2 font-mono text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={connectionState === "connecting"}
                    id="irc-composer"
                    onChange={(event) => setComposer(event.target.value)}
                    onKeyDown={onComposerKeyDown}
                    placeholder={activeRoom ? `Message #${activeRoom.slug} — /help for commands` : "Type /help or /join #room"}
                    ref={composerRef}
                    value={composer}
                  />
                  <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>Ctrl/⌘ K focuses the composer · Tab completes commands · ↑ recalls history</span>
                    <Button disabled={!composer.trim()} size="sm" type="submit">
                      <SendIcon className="size-3.5" aria-hidden="true" />
                      Send
                    </Button>
                  </div>
                  {commandSuggestions.length ? <p className="mt-2 font-mono text-xs text-muted-foreground">Tab: {commandSuggestions.join(" · ")}</p> : null}
                </form>
              </section>
              <aside className="hidden border-l bg-muted/20 p-3 lg:block">
                <MemberPanel profile={profile} room={activeRoom} />
              </aside>
            </div>
          </div>
        </div>
        <footer className="flex items-center justify-between gap-3 border-t bg-muted/30 px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
          <span>Arctic Network · {connectionState === "connected" ? "TLS session active" : "offline mode"}</span>
          <span className="hidden sm:inline">{notice}</span>
        </footer>
      </section>
    </main>
  )
}

function IrcToolbar({ connectionState, notice, onConnect, onThemeChange, theme }: {
  connectionState: ConnectionState
  notice: string
  onConnect: () => void
  onThemeChange: (theme: IrcTheme) => void
  theme: IrcTheme
}) {
  const isConnected = connectionState === "connected"

  return (
    <header className="flex min-h-14 items-center gap-3 border-b bg-background/90 px-3 backdrop-blur sm:px-4">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"><RadioIcon className="size-4" aria-hidden="true" /></span>
      <div className="min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Arctic IRC</p>
        <p className="truncate text-sm font-semibold">Arctic Network</p>
      </div>
      <span className="hidden min-w-0 flex-1 truncate text-xs text-muted-foreground md:block">{notice}</span>
      <div className="ml-auto flex items-center gap-1.5">
        <select aria-label="Chat theme" className="hidden h-8 rounded-md border bg-background px-2 text-xs sm:block" onChange={(event) => onThemeChange(event.target.value as IrcTheme)} value={theme}>
          <option value="classic">Classic</option>
          <option value="modern">Modern</option>
          <option value="light">Light</option>
          <option value="terminal">Terminal</option>
        </select>
        <PaletteIcon className="size-4 text-muted-foreground sm:hidden" aria-hidden="true" />
        <Link className="hidden rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground md:inline-flex" href="/irc/discover"><CompassIcon className="mr-1.5 size-3.5" aria-hidden="true" />Discover</Link>
        <Link className="hidden rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground md:inline-flex" href="/irc/help">Help</Link>
        <Link className="hidden rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground sm:inline-flex" href="/app"><BookOpenIcon className="mr-1.5 size-3.5" aria-hidden="true" />Reader</Link>
        <Button onClick={onConnect} size="sm" variant={isConnected ? "secondary" : "default"}>
          {isConnected ? <WifiIcon className="size-3.5" aria-hidden="true" /> : <RotateCwIcon className="size-3.5" aria-hidden="true" />}
          {isConnected ? "Online" : connectionState === "connecting" ? "Connecting" : "Connect"}
        </Button>
      </div>
    </header>
  )
}

function ServerTree({ activeTab, joinedRooms, onJoin, onSelect, profile, rooms }: {
  activeTab: string
  joinedRooms: Record<string, ChatRoomSnapshot>
  onJoin: (room: ChatRoom) => void
  onSelect: (tab: string) => void
  profile: ChatProfile
  rooms: ChatRoom[]
}) {
  return <div className="flex h-full min-h-0 flex-col gap-4"><div><p className="px-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Networks</p><button className={treeItemClass(activeTab === "status")} onClick={() => onSelect("status")} type="button"><WifiOffIcon className="size-3.5" aria-hidden="true" />Status</button></div><div className="min-h-0 flex-1 overflow-y-auto"><p className="px-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Channels</p>{rooms.map((room) => joinedRooms[room.id] ? <button className={treeItemClass(activeTab === room.id)} key={room.id} onClick={() => onSelect(room.id)} type="button"><HashIcon className="size-3.5" aria-hidden="true" />{room.slug}</button> : <button className={treeItemClass(false)} key={room.id} onClick={() => onJoin(room)} title={room.description} type="button"><HashIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />{room.slug}<span className="ml-auto text-[10px] text-muted-foreground">Join</span></button>)}</div><div className="border-t pt-3"><p className="truncate font-mono text-xs text-muted-foreground">{profile.handle}</p><p className="mt-1 text-xs text-muted-foreground">Arctic account</p></div></div>
}

function MobileRoomControls(props: Parameters<typeof ServerTree>[0]) {
  return <div className="flex items-center gap-2 border-b px-3 py-2 lg:hidden"><Sheet><SheetTrigger render={<Button size="sm" variant="outline" />}><MenuIcon className="size-3.5" aria-hidden="true" />Rooms</SheetTrigger><SheetContent side="left"><SheetHeader><SheetTitle>Arctic Network</SheetTitle></SheetHeader><div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4"><ServerTree {...props} /></div></SheetContent></Sheet><span className="truncate text-xs text-muted-foreground">{props.activeTab === "status" ? "Status" : `#${props.joinedRooms[props.activeTab]?.room.slug ?? "room"}`}</span></div>
}

function IrcTabs({ activeTab, joinedRooms, onSelect }: { activeTab: string; joinedRooms: Record<string, ChatRoomSnapshot>; onSelect: (tab: string) => void }) {
  return <nav aria-label="Open chat tabs" className="flex min-w-0 overflow-x-auto border-b bg-muted/20 px-2 pt-2"><button className={tabClass(activeTab === "status")} onClick={() => onSelect("status")} type="button">Status</button>{Object.values(joinedRooms).map((snapshot) => <button className={tabClass(activeTab === snapshot.room.id)} key={snapshot.room.id} onClick={() => onSelect(snapshot.room.id)} type="button">#{snapshot.room.slug}</button>)}</nav>
}

function StatusHeading({ connectionState }: { connectionState: ConnectionState }) {
  return <div className="border-b bg-muted/15 px-4 py-3"><p className="font-mono text-xs text-muted-foreground">Arctic Network</p><h1 className="mt-0.5 text-lg font-semibold">Status</h1><p className="mt-1 text-sm text-muted-foreground">{connectionState === "connected" ? "Session ready. Join a channel to start chatting." : "The reader is unaffected while chat is offline."}</p></div>
}

function RoomHeading({ hideArcticBotMessages, onDisableArcticBot, onReportSubmitted, onToggleArcticBotVisibility, room }: { hideArcticBotMessages: boolean; onDisableArcticBot: () => void; onReportSubmitted: (notice: string) => void; onToggleArcticBotVisibility: () => void; room: ChatRoom }) {
  return <div className="border-b bg-muted/15 px-4 py-3"><div className="flex flex-wrap items-center gap-2"><HashIcon className="size-4 text-primary" aria-hidden="true" /><h1 className="text-lg font-semibold">{room.slug}</h1><span className="ml-auto flex flex-wrap items-center justify-end gap-2"><Button onClick={onToggleArcticBotVisibility} size="sm" type="button" variant="outline">{hideArcticBotMessages ? "Show ArcticBot" : "Hide ArcticBot"}</Button><Button onClick={onDisableArcticBot} size="sm" type="button" variant="outline">Disable ArcticBot</Button><ChatReportButton label="Report room" onSubmitted={onReportSubmitted} roomSlug={room.slug} /></span></div><p className="mt-1 text-sm text-muted-foreground">{room.topicLine || room.description}</p></div>
}

function Transcript({ messages, onReportSubmitted, profile, status }: { messages: ChatMessage[]; onReportSubmitted: (notice: string) => void; profile: ChatProfile; status: boolean }) {
  return <div aria-live="polite" className="min-h-0 flex-1 overflow-y-auto p-4 font-mono text-sm leading-6">{status ? <div className="space-y-3">{localStatusMessages.map((message, index) => <p className="text-muted-foreground" key={message}><span className="mr-2 text-primary">[{String(index + 1).padStart(2, "0")}:{String(index + 7).padStart(2, "0")}]</span>*** {message}</p>)}</div> : messages.length ? <div className="space-y-2">{messages.map((message) => <div key={message.id}><time className="mr-2 text-muted-foreground">[{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}]</time>{message.kind === "ACTION" ? <><span className="mr-2 text-muted-foreground">*</span><span className="mr-2 font-semibold text-primary">{message.senderHandle || (message.senderUserId === profile.userId ? profile.handle : "member")}</span></> : <span className={cn("mr-2 font-semibold", message.senderUserId || message.senderHandle ? "text-primary" : message.kind === "BOT" ? "text-primary" : "text-muted-foreground")}>{message.senderUserId || message.senderHandle ? `<${message.senderHandle || (message.senderUserId === profile.userId ? profile.handle : "member")}>` : message.kind === "BOT" ? "<ArcticBot>" : "***"}</span>}{(message.kind === "ARTICLE" || message.kind === "BOT") && message.article ? <ArticleMessageCard article={message.article} automated={message.kind === "BOT"} /> : <span className="whitespace-pre-wrap break-words">{message.body}</span>}{message.senderUserId && message.senderUserId !== profile.userId ? <ChatReportButton label="Report" messageId={message.id} onSubmitted={onReportSubmitted} /> : null}</div>)}</div> : <p className="text-muted-foreground">No retained messages yet. Be the first to say hello.</p>}</div>
}

function ArticleMessageCard({ article, automated = false }: { article: NonNullable<ChatMessage["article"]>; automated?: boolean }) {
  return <span className="inline-flex max-w-full flex-col rounded-md border bg-muted/35 px-3 py-2 align-middle"><span className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{automated ? "ArcticBot article" : "Shared article"}</span><Link className="mt-0.5 break-words font-sans text-sm font-semibold text-primary underline-offset-4 hover:underline" href={`/app/article/${encodeURIComponent(article.id)}`}>{article.title}</Link><span className="font-sans text-xs text-muted-foreground">{article.publisher}</span></span>
}

function MemberPanel({ profile, room }: { profile: ChatProfile; room: ChatRoom | null }) {
  return <div><div className="mb-3 flex items-center gap-2"><UsersIcon className="size-4 text-muted-foreground" aria-hidden="true" /><h2 className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">{room ? "Participants" : "Network"}</h2></div>{room ? <div className="rounded-lg border bg-background/60 p-2 text-sm"><p className="font-medium text-primary">@ {profile.handle}</p><p className="mt-1 text-xs text-muted-foreground">You</p><p className="mt-4 text-xs leading-5 text-muted-foreground">Live nick lists appear once the gateway connection is active.</p></div> : <p className="text-sm leading-6 text-muted-foreground">Select a channel to see its participants.</p>}</div>
}

function subscribeToRoom(socket: Socket, slug: string) {
  socket.emit("room:subscribe", { slug }, (result: { ok?: boolean }) => {
    if (!result.ok) {
      socket.disconnect()
    }
  })
}

function shellTheme(theme: IrcTheme) {
  switch (theme) {
    case "terminal":
      return "bg-[#07120d] text-emerald-100 [&_section]:border-emerald-900/80 [&_section]:bg-[#0a1710] [&_textarea]:bg-[#07120d] [&_textarea]:text-emerald-100"
    case "light":
      return "bg-slate-100 text-slate-950 [&_section]:bg-white"
    case "modern":
      return "bg-gradient-to-br from-sky-950 via-slate-950 to-violet-950"
    default:
      return "bg-slate-950/5"
  }
}

function tabClass(active: boolean) {
  return cn("border-x border-t px-3 py-1.5 text-xs font-medium text-muted-foreground", active ? "-mb-px bg-background text-foreground" : "bg-muted/30 hover:bg-muted/60 hover:text-foreground")
}

function treeItemClass(active: boolean) {
  return cn("mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground", active && "bg-primary/10 text-primary")
}

function commandHelp(command?: string) {
  const commands: Record<string, string> = {
    ban: "/ban handle [duration] [reason] bans an active member when permitted.",
    clear: "/clear clears only the local transcript; retained history is unchanged.",
    ignore: "/ignore handle hides that handle in this shell and stores your preference.",
    join: "/join #room opens a public room from the directory.",
    kick: "/kick handle [reason] removes a lower-role member when permitted.",
    me: "/me action text sends a typed action message.",
    mute: "/mute handle [duration] applies a room mute when permitted (default 15m).",
    nick: "/nick newhandle changes your stable handle (once every 30 days).",
    part: "/part [reason] leaves the current room.",
    rooms: "/rooms [search] lists public rooms from the current directory.",
    topic: "/topic [new topic] shows or updates the current room topic when permitted.",
    unban: "/unban handle revokes an active room ban when permitted.",
    unignore: "/unignore handle restores that handle in this shell.",
    whois: "/whois handle shows the role of an active member in the current room.",
  }

  if (command && commands[command]) {
    return commands[command]
  }

  return "Commands: /join, /part, /me, /nick, /topic, /whois, /kick, /ban, /unban, /mute, /ignore, /unignore, /rooms, /clear, /help."
}

function commandDurationToSeconds(value: string) {
  const match = /^(\d+)(m|h|d|w)$/.exec(value)
  if (!match) {
    return 0
  }

  const multiplier =
    match[2] === "m"
      ? 60
      : match[2] === "h"
        ? 60 * 60
        : match[2] === "d"
          ? 24 * 60 * 60
          : 7 * 24 * 60 * 60

  return Number(match[1]) * multiplier
}

"use client"

import Link from "next/link"
import { MessageCircleIcon } from "lucide-react"
import { useId, useState } from "react"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { type ArticleChatRoomRecommendation } from "@/lib/chat/article-recommendations"

export function DiscussInChatButton({
  articleId,
  rooms,
}: {
  articleId: string
  rooms: ArticleChatRoomRecommendation[]
}) {
  const roomSelectId = useId()
  const [open, setOpen] = useState(false)
  const [selectedSlug, setSelectedSlug] = useState(rooms[0]?.slug ?? "")
  const [error, setError] = useState<string | null>(null)
  const [isSharing, setIsSharing] = useState(false)
  const [sharedRoomSlug, setSharedRoomSlug] = useState<string | null>(null)

  const selectedRoom =
    rooms.find((room) => room.slug === selectedSlug) ?? rooms[0]

  async function joinAndShare() {
    if (!selectedRoom) {
      return
    }

    setError(null)
    setIsSharing(true)

    try {
      const membership = await fetch(
        `/api/chat/rooms/${encodeURIComponent(selectedRoom.slug)}/membership`,
        { method: "POST" }
      )
      const membershipPayload = (await membership.json()) as { error?: string }

      if (!membership.ok) {
        throw new Error(membershipPayload.error || "Unable to join this room.")
      }

      const response = await fetch(
        `/api/chat/rooms/${encodeURIComponent(selectedRoom.slug)}/articles`,
        {
          body: JSON.stringify({
            articleId,
            clientMessageId: createClientMessageId(),
          }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }
      )
      const payload = (await response.json()) as { error?: string }

      if (!response.ok) {
        throw new Error(payload.error || "Unable to share this article.")
      }

      setSharedRoomSlug(selectedRoom.slug)
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to share this article."
      )
    } finally {
      setIsSharing(false)
    }
  }

  function onOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)

    if (!nextOpen) {
      setError(null)
      setSharedRoomSlug(null)
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm" variant="outline">
        <MessageCircleIcon aria-hidden="true" />
        Discuss in Chat
      </Button>
      <AlertDialog onOpenChange={onOpenChange} open={open}>
        <AlertDialogContent>
          {sharedRoomSlug ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Shared with #{sharedRoomSlug}</AlertDialogTitle>
                <AlertDialogDescription>
                  The room received a compact article card. Article text and the
                  original link were not posted to chat.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Close</AlertDialogCancel>
                <Button render={<Link href={`/irc?room=${encodeURIComponent(sharedRoomSlug)}`} />}>
                  Open #{sharedRoomSlug}
                </Button>
              </AlertDialogFooter>
            </>
          ) : rooms.length ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Discuss this article</AlertDialogTitle>
                <AlertDialogDescription>
                  Recommended public rooms are ranked from the article’s feed
                  category. This will join the selected room and post only the
                  article title and publisher.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <label className="grid gap-2 text-sm font-medium" htmlFor={roomSelectId}>
                Room
                <select
                  className="h-10 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  id={roomSelectId}
                  onChange={(event) => setSelectedSlug(event.target.value)}
                  value={selectedRoom?.slug ?? ""}
                >
                  {rooms.map((room) => (
                    <option key={room.id} value={room.slug}>
                      #{room.slug} — {room.name}
                      {room.score > 0 ? " (recommended)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              {selectedRoom ? (
                <p className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                  #{selectedRoom.slug}: {selectedRoom.description}
                </p>
              ) : null}
              {error ? (
                <p aria-live="polite" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isSharing}>Cancel</AlertDialogCancel>
                <Button disabled={isSharing || !selectedRoom} onClick={joinAndShare}>
                  {isSharing ? "Sharing…" : "Join & share"}
                </Button>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>No public rooms yet</AlertDialogTitle>
                <AlertDialogDescription>
                  Chat is enabled, but there are no public rooms available for
                  article discussion yet.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Close</AlertDialogCancel>
                <Button render={<Link href="/irc/discover" />} variant="outline">
                  Browse rooms
                </Button>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function createClientMessageId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return `article-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
}

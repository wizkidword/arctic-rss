import { notFound, redirect } from "next/navigation"

import { auth } from "@/auth"
import { IrcClientShell } from "@/components/irc/irc-client-shell"
import { ChatActivation } from "@/components/irc/chat-activation"
import { ChatAccessError, requireChatEligibleUser } from "@/lib/chat/access"
import { isChatEnabled } from "@/lib/chat/feature-flags"
import { getChatProfileForUser } from "@/lib/chat/profiles"
import { listChatRooms } from "@/lib/chat/room-service"

export const dynamic = "force-dynamic"

export default async function IrcPage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string | string[] }>
}) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  if (!isChatEnabled()) {
    notFound()
  }

  let user: Awaited<ReturnType<typeof requireChatEligibleUser>>

  try {
    user = await requireChatEligibleUser({ session })
  } catch (error) {
    if (error instanceof ChatAccessError) {
      const betaAccessRequired = error.code === "beta-access-required"

      if (error.code === "policy-acceptance-required") {
        return <ChatActivation />
      }

      return (
        <main className="flex min-h-screen items-center justify-center p-4">
          <section className="max-w-lg rounded-xl border bg-card p-6 shadow-sm">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">Arctic IRC</p>
            <h1 className="mt-2 text-2xl font-semibold">
              {betaAccessRequired ? "Arctic IRC private beta" : "Verify your email to enter chat"}
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {betaAccessRequired
                ? "Arctic IRC is currently available only to invited private-beta participants."
                : "Arctic IRC is available after your Arctic RSS account email has been verified."}
            </p>
          </section>
        </main>
      )
    }

    throw error
  }
  const [{ room }, profile, rooms] = await Promise.all([
    searchParams,
    getChatProfileForUser(user.id),
    listChatRooms(),
  ])

  return (
    <IrcClientShell
      initialProfile={profile}
      initialRoomSlug={typeof room === "string" ? room : undefined}
      rooms={rooms}
    />
  )
}

import Link from "next/link"
import { notFound } from "next/navigation"

import { ChatAccessError, requireChatEligibleUser } from "@/lib/chat/access"

export const dynamic = "force-dynamic"

const commandGroups = [
  {
    heading: "Rooms and conversation",
    commands: [
      ["/join #room", "Join a public room from the Arctic Network directory."],
      ["/part [reason]", "Leave the active room."],
      ["/me action text", "Send a durable action message."],
      ["/topic [new topic]", "Show a topic or, for operators, update it."],
      ["/whois handle", "Show an active member's role in the current room."],
      ["/rooms [search]", "List public rooms from the current directory."],
    ],
  },
  {
    heading: "Identity and local controls",
    commands: [
      ["/nick newhandle", "Change your stable handle, subject to the 30-day cooldown."],
      ["/ignore handle", "Persist an ignore and hide that handle in this shell."],
      ["/unignore handle", "Remove an ignore."],
      ["/clear", "Clear only this browser's visible transcript; retained history is unchanged."],
      ["/help [command]", "Show command help in the status bar."],
    ],
  },
]

export default async function IrcHelpPage() {
  try {
    await requireChatEligibleUser()
  } catch (error) {
    if (error instanceof ChatAccessError) {
      notFound()
    }

    throw error
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl p-4 sm:p-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">Arctic IRC</p>
          <h1 className="mt-2 text-3xl font-semibold">Command help</h1>
        </div>
        <Link className="rounded-md border px-3 py-2 text-sm hover:bg-muted" href="/irc">
          Open chat
        </Link>
      </header>
      <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
        Arctic commands are parsed locally into structured operations. Unknown commands and raw server lines are rejected; no command text is forwarded as arbitrary protocol input.
      </p>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {commandGroups.map((group) => (
          <section className="rounded-xl border bg-card p-5" key={group.heading}>
            <h2 className="font-mono text-sm font-semibold uppercase tracking-[0.1em]">{group.heading}</h2>
            <dl className="mt-4 space-y-4">
              {group.commands.map(([command, description]) => (
                <div key={command}>
                  <dt className="font-mono text-sm text-primary">{command}</dt>
                  <dd className="mt-1 text-sm leading-6 text-muted-foreground">{description}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      <section className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 text-sm leading-6 text-muted-foreground">
        <h2 className="font-medium text-foreground">Moderation commands</h2>
        <p className="mt-2">
          <code>/invite</code>, <code>/kick</code>, <code>/ban</code>, <code>/unban</code>, and <code>/mute</code> are recognized safely but are not active until the audited moderation workflow is introduced. They never fall back to arbitrary raw server input.
        </p>
      </section>
    </main>
  )
}

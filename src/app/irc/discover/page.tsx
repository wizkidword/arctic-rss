import Link from "next/link"
import { notFound } from "next/navigation"
import type { Session } from "next-auth"

import { auth } from "@/auth"
import { Badge } from "@/components/ui/badge"
import { ChatDiscoveryPreference } from "@/components/irc/chat-discovery-preference"
import { getDiscoverDirectory } from "@/lib/discover-directory"
import { listUserFeedSubscriptions } from "@/lib/feed-subscriptions"
import { ChatAccessError, requireChatEligibleUser } from "@/lib/chat/access"
import { getChatFeatureFlags } from "@/lib/chat/feature-flags"
import { rankChatDirectoryRooms, getSubscriptionInterestIds } from "@/lib/chat/room-directory"
import { listChatRooms } from "@/lib/chat/room-service"
import { getChatProfileForUser } from "@/lib/chat/profiles"

export const dynamic = "force-dynamic"

type SearchParams = {
  q?: string | string[]
}

export default async function IrcDiscoverPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const flags = getChatFeatureFlags()

  if (!flags.enabled) {
    notFound()
  }

  const [{ q }, session] = await Promise.all([
    searchParams,
    auth(),
  ])
  const eligibleUser = await getEligibleChatUser(session)

  if (!eligibleUser && !flags.guestPreviewEnabled) {
    notFound()
  }

  const [rooms, directory, profile] = await Promise.all([
    listChatRooms(),
    getDiscoverDirectory(),
    eligibleUser ? getChatProfileForUser(eligibleUser.id) : null,
  ])
  const search = firstSearchValue(q)
  const personalizedDiscoveryEnabled = profile?.personalizedDiscovery ?? true
  const subscriptions = eligibleUser && personalizedDiscoveryEnabled
    ? await listUserFeedSubscriptions(eligibleUser.id)
    : []
  const interestIds = eligibleUser
    ? getSubscriptionInterestIds({
        directory,
        feedUrls: subscriptions.map((subscription) => subscription.feedUrl),
      })
    : undefined
  const rankedRooms = rankChatDirectoryRooms({ interestIds, rooms, search })
  const hasRecommendations = Boolean(interestIds?.size)

  return (
    <main className="mx-auto min-h-screen max-w-6xl p-4 sm:p-8">
      <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">Arctic Network</p>
          <h1 className="mt-2 text-3xl font-semibold">Discover rooms</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {hasRecommendations
              ? "Recommended rooms are ranked from matching Discover interests. Your subscriptions remain private."
              : "Browse public rooms by topic. Sign in and add Discover feeds for private recommendations."}
          </p>
        </div>
        <Link className="rounded-md border px-3 py-2 text-sm hover:bg-muted" href={eligibleUser ? "/irc" : "/login"}>
          {eligibleUser ? "Open chat" : "Sign in to chat"}
        </Link>
      </header>
      {eligibleUser && profile ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border p-3 text-sm text-muted-foreground">
          <p>
            {personalizedDiscoveryEnabled
              ? "Recommendations use matching feed topics; your raw subscriptions remain private."
              : "Discovery is non-personalized."}
          </p>
          <ChatDiscoveryPreference enabled={personalizedDiscoveryEnabled} />
        </div>
      ) : null}
      <form className="mt-6 flex gap-2" method="get">
        <label className="sr-only" htmlFor="room-search">Search rooms</label>
        <input className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm" defaultValue={search} id="room-search" name="q" placeholder="Search rooms" type="search" />
        <button className="rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90" type="submit">Search</button>
      </form>
      <section aria-label="Public rooms" className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rankedRooms.map((room) => (
          <article className="flex min-h-48 flex-col rounded-xl border bg-card p-5" key={room.id}>
            <div className="flex items-start justify-between gap-3"><div><p className="font-mono text-sm text-primary">#{room.slug}</p><h2 className="mt-1 text-lg font-semibold">{room.name}</h2></div>{room.isOfficial ? <Badge>Official</Badge> : null}</div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{room.description}</p>
            <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted-foreground">{room.topicLine || "No topic set."}</p>
            {room.matchedInterestIds.length ? <p className="mt-3 text-xs font-medium text-primary">Matches your Discover interests</p> : null}
            <Link className="mt-auto pt-5 text-sm font-medium text-primary hover:underline" href={eligibleUser ? "/irc" : "/login"}>Open chat</Link>
          </article>
        ))}
      </section>
      {!rankedRooms.length ? <p className="mt-8 rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No public rooms match that search.</p> : null}
    </main>
  )
}

async function getEligibleChatUser(session: Session | null) {
  if (!session?.user?.id) {
    return null
  }

  try {
    return await requireChatEligibleUser({ session })
  } catch (error) {
    if (error instanceof ChatAccessError) {
      return null
    }

    throw error
  }
}

function firstSearchValue(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value
  return candidate?.slice(0, 100) ?? ""
}

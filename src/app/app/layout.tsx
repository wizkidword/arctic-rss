import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { AppShell } from "@/components/app-shell"
import { getReaderCounts } from "@/lib/articles"
import { listUserFeedSubscriptions } from "@/lib/feed-subscriptions"
import { listUserFolders } from "@/lib/folders"

export default async function AuthenticatedAppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const [feedSubscriptions, readerCounts, folders] = await Promise.all([
    listUserFeedSubscriptions(session.user.id),
    getReaderCounts(session.user.id),
    listUserFolders(session.user.id),
  ])

  return (
    <AppShell
      feedSubscriptions={feedSubscriptions}
      folders={folders}
      readerCounts={readerCounts}
      user={session.user}
    >
      {children}
    </AppShell>
  )
}

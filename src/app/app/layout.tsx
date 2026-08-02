import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { AppShell } from "@/components/app-shell"
import { listArticleCollectionsForUser } from "@/lib/article-collections"
import { getReaderCounts } from "@/lib/articles"
import { getCurrentBulkReadJobForUser } from "@/lib/bulk-read-jobs"
import { isChatEnabled } from "@/lib/chat/feature-flags"
import { listDiscoverInterestNavigation } from "@/lib/discover-interests"
import { listUserFeedSubscriptions } from "@/lib/feed-subscriptions"
import { listUserFolders } from "@/lib/folders"
import { AuthorizationError, requireFreshUser } from "@/lib/authorization"
import { normalizeDisplayMode, normalizeThemePreference } from "@/lib/settings"
import { getOrCreateUserSettings } from "@/lib/user-settings"

export default async function AuthenticatedAppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const currentUser = await requireFreshUser(session).catch((error: unknown) => {
    if (error instanceof AuthorizationError) {
      redirect("/login")
    }

    throw error
  })

  const [
    articleCollections,
    feedSubscriptions,
    readerCounts,
    folders,
    settings,
    discoverInterests,
    bulkReadJob,
  ] = await Promise.all([
    listArticleCollectionsForUser(session.user.id),
    listUserFeedSubscriptions(session.user.id),
    getReaderCounts(session.user.id),
    listUserFolders(session.user.id),
    getOrCreateUserSettings(session.user.id),
    listDiscoverInterestNavigation(),
    getCurrentBulkReadJobForUser(session.user.id),
  ])

  return (
    <AppShell
      articleCollections={articleCollections}
      bulkReadJob={bulkReadJob}
      chatEnabled={isChatEnabled()}
      discoverInterests={discoverInterests}
      displayMode={normalizeDisplayMode(settings.displayMode)}
      feedSubscriptions={feedSubscriptions}
      folders={folders}
      readerCounts={readerCounts}
      showEmailVerificationReminder={!currentUser.emailVerified}
      themePreference={normalizeThemePreference(settings.theme)}
      user={session.user}
    >
      {children}
    </AppShell>
  )
}

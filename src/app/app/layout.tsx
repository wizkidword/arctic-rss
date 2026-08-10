import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { AppShell } from "@/components/app-shell"
import { ProductMilestoneTracker } from "@/components/product-milestone-tracker"
import { listArticleCollectionsForUser } from "@/lib/article-collections"
import { getReaderCounts } from "@/lib/articles"
import { getCurrentBulkReadJobForUser } from "@/lib/bulk-read-jobs"
import { isChatEnabled } from "@/lib/chat/feature-flags"
import { listDiscoverInterestNavigation } from "@/lib/discover-interests"
import { listUserFeedNavigation } from "@/lib/feed-subscriptions"
import { listUserFolders } from "@/lib/folders"
import {
  AuthorizationError,
  requireFreshUser,
  withAuthenticatedRequestScope,
} from "@/lib/authorization"
import { normalizeDisplayMode, normalizeThemePreference } from "@/lib/settings"
import { getOrCreateUserSettings } from "@/lib/user-settings"
import {
  parseProductMilestones,
  PRODUCT_MILESTONE_COOKIE,
} from "@/lib/product-milestone-events"

export default async function AuthenticatedAppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return withAuthenticatedRequestScope(async (session) => {
    const currentUser = await requireFreshUser(session)
    const [
      articleCollections,
      feedNavigation,
      readerCounts,
      folders,
      settings,
      discoverInterests,
      bulkReadJob,
      milestoneCookie,
    ] = await Promise.all([
      listArticleCollectionsForUser(session.user.id),
      listUserFeedNavigation(session.user.id),
      getReaderCounts(session.user.id),
      listUserFolders(session.user.id),
      getOrCreateUserSettings(session.user.id),
      listDiscoverInterestNavigation(),
      getCurrentBulkReadJobForUser(session.user.id),
      cookies(),
    ])

    return (
      <AppShell
        articleCollections={articleCollections}
        bulkReadJob={bulkReadJob}
        chatEnabled={isChatEnabled()}
        discoverInterests={discoverInterests}
        displayMode={normalizeDisplayMode(settings.displayMode)}
        feedSubscriptions={feedNavigation.map((subscription) => ({
          faviconUrl: subscription.faviconUrl,
          feedId: subscription.feedId,
          folderId: subscription.folderId,
          id: subscription.id,
          isPaused: subscription.isPaused,
          needsAttention: subscription.needsAttention,
          title: subscription.title,
          unreadCount: subscription.unreadCount,
        }))}
        folders={folders}
        readerCounts={readerCounts}
        showEmailVerificationReminder={!currentUser.emailVerified}
        themePreference={normalizeThemePreference(settings.theme)}
        user={session.user}
      >
        <ProductMilestoneTracker
          milestones={parseProductMilestones(
            milestoneCookie.get(PRODUCT_MILESTONE_COOKIE)?.value
          )}
        />
        {children}
      </AppShell>
    )
  }).catch((error: unknown) => {
    if (error instanceof AuthorizationError) {
      redirect("/login")
    }

    throw error
  })
}

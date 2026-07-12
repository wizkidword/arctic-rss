import { AppShell } from "@/components/app-shell"
import { listDiscoverInterestNavigation } from "@/lib/discover-interests"

export const dynamic = "force-dynamic"

export default async function GuestLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const discoverInterests = await listDiscoverInterestNavigation()

  return (
    <AppShell
      articleCollections={[]}
      discoverInterests={discoverInterests}
      displayMode="THREE_PANE"
      feedSubscriptions={[]}
      folders={[]}
      guestMode
      readerCounts={{ allCount: 0, starredCount: 0, unreadCount: 0 }}
      themePreference="SYSTEM"
      user={{ email: null, name: "Guest", role: "USER" }}
    >
      {children}
    </AppShell>
  )
}

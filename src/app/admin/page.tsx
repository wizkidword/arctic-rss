import { redirect } from "next/navigation"

import { AdminDashboard } from "@/components/admin-dashboard"
import { getAdminDashboard } from "@/lib/admin-dashboard"
import { inspectAdminQueues } from "@/lib/admin-queues"
import {
  requireAuthenticatedUser,
  requireFreshAdmin,
} from "@/lib/authorization"
import { listDiscoverCategoryEditorOptions } from "@/lib/discover-category-customizations"

export default async function AdminPage() {
  const session = await requireAuthenticatedUser().catch(() => null)

  if (!session?.user?.id) {
    redirect("/login")
  }

  const admin = await requireFreshAdmin(session).catch(() => null)

  if (!admin) {
    redirect("/app")
  }

  const [dashboard, queues, discoverCategories] = await Promise.all([
    getAdminDashboard({
      isAdmin: true,
    }),
    inspectAdminQueues(),
    listDiscoverCategoryEditorOptions(),
  ])

  return (
    <AdminDashboard
      dashboard={dashboard}
      discoverCategories={discoverCategories}
      queues={queues}
    />
  )
}

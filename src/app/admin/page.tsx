import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { AdminDashboard } from "@/components/admin-dashboard"
import { getAdminDashboard } from "@/lib/admin-dashboard"
import { inspectAdminQueues } from "@/lib/admin-queues"
import { listDiscoverCategoryEditorOptions } from "@/lib/discover-category-customizations"

export default async function AdminPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  if (session.user.role !== "ADMIN") {
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

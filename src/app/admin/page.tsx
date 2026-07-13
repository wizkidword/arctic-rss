import { redirect } from "next/navigation"

import { AdminDashboard } from "@/components/admin-dashboard"
import { parseAdminDashboardFilters } from "@/lib/admin-dashboard"
import {
  requireAuthenticatedUser,
  requireFreshAdmin,
} from "@/lib/authorization"

export default async function AdminPage({
  searchParams = Promise.resolve({}),
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>
} = {}) {
  const session = await requireAuthenticatedUser().catch(() => null)

  if (!session?.user?.id) {
    redirect("/login")
  }

  const admin = await requireFreshAdmin(session).catch(() => null)

  if (!admin) {
    redirect("/app")
  }

  const filters = parseAdminDashboardFilters(await searchParams)

  return <AdminDashboard filters={filters} />
}

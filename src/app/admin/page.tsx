import { redirect } from "next/navigation"

import { AdminDashboard } from "@/components/admin-dashboard"
import { parseAdminDashboardFilters } from "@/lib/admin-dashboard"
import {
  requireFreshAdmin,
  withAuthenticatedRequestScope,
} from "@/lib/authorization"

export default async function AdminPage({
  searchParams = Promise.resolve({}),
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>
} = {}) {
  const admin = await withAuthenticatedRequestScope((session) =>
    requireFreshAdmin(session).catch(() => null)
  ).catch(() => undefined)

  if (admin === undefined) {
    redirect("/login")
  }

  if (!admin) {
    redirect("/app")
  }

  const filters = parseAdminDashboardFilters(await searchParams)

  return <AdminDashboard filters={filters} />
}

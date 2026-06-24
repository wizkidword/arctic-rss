"use client"

import Link from "next/link"
import { LayoutDashboardIcon } from "lucide-react"

import { DropdownMenuItem } from "@/components/ui/dropdown-menu"

export function AdminAccountLink({ role }: { role?: string | null }) {
  if (role !== "ADMIN") {
    return null
  }

  return (
    <DropdownMenuItem render={<Link href="/admin" />}>
      <LayoutDashboardIcon data-icon="inline-start" />
      Admin Dashboard
    </DropdownMenuItem>
  )
}

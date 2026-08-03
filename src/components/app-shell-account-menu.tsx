"use client"

import { LogOutIcon } from "lucide-react"
import { signOut } from "next-auth/react"

import { AdminAccountLink } from "@/components/admin-account-link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type ShellAccountUser = {
  email?: string | null
  name?: string | null
  role?: string | null
}

export function AppShellAccountMenu({
  compact = false,
  user,
}: {
  compact?: boolean
  user: ShellAccountUser
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={
              compact
                ? `Account menu for ${user.name || user.email || "reader"}`
                : undefined
            }
            className="h-auto min-w-0 justify-start p-2"
            variant="ghost"
          />
        }
      >
        <Avatar size="sm">
          <AvatarFallback>{initialsFor(user)}</AvatarFallback>
        </Avatar>
        {!compact && (
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-sm font-medium">
              {user.name || "Arctic Reader"}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {user.email}
            </span>
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Account</DropdownMenuLabel>
          <DropdownMenuItem>
            {user.role === "ADMIN" ? "Admin" : "Reader"}
          </DropdownMenuItem>
          <AdminAccountLink role={user.role} />
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })}>
            <LogOutIcon data-icon="inline-start" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function initialsFor(user: ShellAccountUser) {
  const source = user.name || user.email || "AR"

  return source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

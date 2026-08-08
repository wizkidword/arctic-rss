"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

export function ReaderNavigationLink({
  children,
  className,
  exact = false,
  href,
}: {
  children: React.ReactNode
  className?: string
  exact?: boolean
  href: string
}) {
  const pathname = usePathname()
  const isActive = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`)

  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      className={cn(
        className,
        isActive && "bg-accent text-accent-foreground hover:bg-accent"
      )}
      data-active={isActive || undefined}
      href={href}
    >
      {children}
    </Link>
  )
}

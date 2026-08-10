import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { requireFreshUser } from "@/lib/authorization"

export function mobileDeepLinkPath({
  id,
  resource,
}: {
  id: string
  resource: "articles" | "briefings" | "collections" | "podcast-episodes" | "saved-views"
}) {
  return `/${resource}/${encodeURIComponent(id)}`
}

export async function requireMobileDeepLinkUser(callbackPath: string) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackPath)}`)
  }
  return requireFreshUser(session)
}

import { notFound, redirect } from "next/navigation"

import { getPrisma } from "@/lib/db"
import { mobileDeepLinkPath, requireMobileDeepLinkUser } from "@/lib/mobile-deep-links"

export default async function SavedViewDeepLinkPage({
  params,
}: {
  params: Promise<{ savedViewId: string }>
}) {
  const { savedViewId } = await params
  const user = await requireMobileDeepLinkUser(
    mobileDeepLinkPath({ id: savedViewId, resource: "saved-views" })
  )
  const savedView = await getPrisma().savedSearch.findFirst({
    select: { id: true },
    where: { id: savedViewId, userId: user.id },
  })
  if (!savedView) {
    notFound()
  }
  redirect(`/app/saved-searches?selected=${encodeURIComponent(savedView.id)}`)
}

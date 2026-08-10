import { redirect } from "next/navigation"

import { mobileDeepLinkPath, requireMobileDeepLinkUser } from "@/lib/mobile-deep-links"

export default async function BriefingDeepLinkPage({
  params,
}: {
  params: Promise<{ briefingId: string }>
}) {
  const { briefingId } = await params
  await requireMobileDeepLinkUser(mobileDeepLinkPath({ id: briefingId, resource: "briefings" }))
  redirect(`/app/smart-digests/digests/${encodeURIComponent(briefingId)}`)
}

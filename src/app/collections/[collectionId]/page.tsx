import { redirect } from "next/navigation"

import { mobileDeepLinkPath, requireMobileDeepLinkUser } from "@/lib/mobile-deep-links"

export default async function CollectionDeepLinkPage({
  params,
}: {
  params: Promise<{ collectionId: string }>
}) {
  const { collectionId } = await params
  await requireMobileDeepLinkUser(mobileDeepLinkPath({ id: collectionId, resource: "collections" }))
  redirect(`/app/collections/${encodeURIComponent(collectionId)}`)
}

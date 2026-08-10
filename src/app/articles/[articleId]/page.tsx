import { redirect } from "next/navigation"

import { mobileDeepLinkPath, requireMobileDeepLinkUser } from "@/lib/mobile-deep-links"

export default async function ArticleDeepLinkPage({
  params,
}: {
  params: Promise<{ articleId: string }>
}) {
  const { articleId } = await params
  await requireMobileDeepLinkUser(mobileDeepLinkPath({ id: articleId, resource: "articles" }))
  redirect(`/app/article/${encodeURIComponent(articleId)}`)
}

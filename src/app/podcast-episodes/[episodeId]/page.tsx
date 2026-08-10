import { notFound, redirect } from "next/navigation"

import { getPodcastEpisodeForUser } from "@/lib/podcasts"
import { mobileDeepLinkPath, requireMobileDeepLinkUser } from "@/lib/mobile-deep-links"

export default async function PodcastEpisodeDeepLinkPage({
  params,
}: {
  params: Promise<{ episodeId: string }>
}) {
  const { episodeId } = await params
  const user = await requireMobileDeepLinkUser(
    mobileDeepLinkPath({ id: episodeId, resource: "podcast-episodes" })
  )
  const episode = await getPodcastEpisodeForUser({ episodeId, userId: user.id })
  if (!episode) {
    notFound()
  }
  redirect(`/app/podcasts/${encodeURIComponent(episode.podcastId)}`)
}

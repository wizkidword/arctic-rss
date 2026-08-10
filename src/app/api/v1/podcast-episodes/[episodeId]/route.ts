import { getApiV1PodcastEpisode } from "@/lib/api-v1/read-service"
import { handleApiV1Read } from "@/lib/api-v1/route"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(
  request: Request,
  { params }: { params: Promise<{ episodeId: string }> }
) {
  const { episodeId } = await params

  return handleApiV1Read({
    endpoint: "podcast-episodes",
    request,
    run: async ({ userId }) => ({
      data: await getApiV1PodcastEpisode({ episodeId, userId }),
    }),
  })
}

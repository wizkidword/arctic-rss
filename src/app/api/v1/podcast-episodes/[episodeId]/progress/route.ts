import { podcastProgressMutationRequestSchema } from "@arctic-rss/api-contract"

import {
  handleApiV1DeviceSession,
  parseApiV1Identifier,
  parseApiV1IdempotencyKey,
  parseApiV1Json,
} from "@/lib/api-v1/route"
import { updateMobilePodcastProgress } from "@/lib/mobile-sync"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ episodeId: string }> }
) {
  return handleApiV1DeviceSession({
    endpoint: "podcast-episodes",
    request,
    run: async ({ deviceSessionId, mobileDeviceId, userId }) => {
      const { episodeId: rawEpisodeId } = await params
      const episodeId = parseApiV1Identifier(rawEpisodeId, "episodeId")
      const input = await parseApiV1Json(request, podcastProgressMutationRequestSchema)
      const idempotencyKey = parseApiV1IdempotencyKey(request)
      return {
        data: await updateMobilePodcastProgress({
          deviceSessionId,
          episodeId,
          mobileDeviceId,
          idempotencyKey,
          input,
          userId,
        }),
      }
    },
  })
}

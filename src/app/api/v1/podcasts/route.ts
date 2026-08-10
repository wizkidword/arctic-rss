import { podcastsQuerySchema } from "@arctic-rss/api-contract"

import { listApiV1Podcasts } from "@/lib/api-v1/read-service"
import { handleApiV1Read, parseApiV1Query } from "@/lib/api-v1/route"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: Request) {
  return handleApiV1Read({
    endpoint: "podcasts",
    request,
    run: async ({ userId }) => {
      const query = parseApiV1Query(request, podcastsQuerySchema)
      const page = await listApiV1Podcasts({ ...query, userId })

      return {
        data: { episodes: page.episodes, podcasts: page.podcasts },
        nextCursor: page.nextCursor,
        pageSize: query.limit,
      }
    },
  })
}

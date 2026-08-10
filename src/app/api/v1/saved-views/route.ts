import { savedViewsQuerySchema } from "@arctic-rss/api-contract"

import { listApiV1SavedViews } from "@/lib/api-v1/read-service"
import { handleApiV1Read, parseApiV1Query } from "@/lib/api-v1/route"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: Request) {
  return handleApiV1Read({
    endpoint: "saved-views",
    request,
    run: async ({ userId }) => {
      const query = parseApiV1Query(request, savedViewsQuerySchema)
      const page = await listApiV1SavedViews({ ...query, userId })

      return {
        data: { savedViews: page.savedViews },
        nextCursor: page.nextCursor,
        pageSize: query.limit,
      }
    },
  })
}

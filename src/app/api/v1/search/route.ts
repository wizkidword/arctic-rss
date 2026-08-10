import { searchQuerySchema } from "@arctic-rss/api-contract"

import { searchApiV1Articles } from "@/lib/api-v1/read-service"
import { handleApiV1Read, parseApiV1Query } from "@/lib/api-v1/route"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: Request) {
  return handleApiV1Read({
    endpoint: "search",
    request,
    run: async ({ userId }) => {
      const query = parseApiV1Query(request, searchQuerySchema)
      const page = await searchApiV1Articles({ ...query, userId })

      return {
        data: { articles: page.articles },
        nextCursor: page.nextCursor,
        pageSize: query.limit,
      }
    },
  })
}

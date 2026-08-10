import { briefingsQuerySchema } from "@arctic-rss/api-contract"

import { listApiV1Briefings } from "@/lib/api-v1/read-service"
import { handleApiV1Read, parseApiV1Query } from "@/lib/api-v1/route"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: Request) {
  return handleApiV1Read({
    endpoint: "briefings",
    request,
    run: async ({ userId }) => {
      const query = parseApiV1Query(request, briefingsQuerySchema)
      const page = await listApiV1Briefings({ ...query, userId })

      return {
        data: { briefings: page.briefings },
        nextCursor: page.nextCursor,
        pageSize: query.limit,
      }
    },
  })
}

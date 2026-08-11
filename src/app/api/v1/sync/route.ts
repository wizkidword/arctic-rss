import { syncQuerySchema } from "@arctic-rss/api-contract"

import { handleApiV1DeviceSession, parseApiV1Query } from "@/lib/api-v1/route"
import { listMobileSync } from "@/lib/mobile-sync"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: Request) {
  return handleApiV1DeviceSession({
    endpoint: "sync",
    request,
    run: async ({ userId }) => {
      const query = parseApiV1Query(request, syncQuerySchema)
      const sync = await listMobileSync({ ...query, userId })
      return {
        data: { events: sync.events, fullResyncRequired: false as const, hasMore: sync.hasMore },
        nextCursor: sync.nextCursor,
        pageSize: query.limit,
      }
    },
  })
}

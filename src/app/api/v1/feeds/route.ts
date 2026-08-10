import { listApiV1Feeds } from "@/lib/api-v1/read-service"
import { handleApiV1Read } from "@/lib/api-v1/route"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: Request) {
  return handleApiV1Read({
    endpoint: "feeds",
    request,
    run: async ({ userId }) => ({
      data: { feeds: await listApiV1Feeds(userId) },
    }),
  })
}

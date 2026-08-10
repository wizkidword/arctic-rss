import { getApiV1Briefing } from "@/lib/api-v1/read-service"
import { handleApiV1Read, parseApiV1Identifier } from "@/lib/api-v1/route"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(
  request: Request,
  { params }: { params: Promise<{ briefingId: string }> }
) {
  return handleApiV1Read({
    endpoint: "briefings",
    request,
    run: async ({ userId }) => {
      const { briefingId: rawBriefingId } = await params
      const briefingId = parseApiV1Identifier(rawBriefingId, "briefingId")

      return {
        data: await getApiV1Briefing({ briefingId, userId }),
      }
    },
  })
}

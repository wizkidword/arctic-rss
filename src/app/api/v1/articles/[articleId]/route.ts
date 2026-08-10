import { getApiV1Article } from "@/lib/api-v1/read-service"
import { handleApiV1Read } from "@/lib/api-v1/route"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(
  request: Request,
  { params }: { params: Promise<{ articleId: string }> }
) {
  const { articleId } = await params

  return handleApiV1Read({
    endpoint: "articles",
    request,
    run: async ({ userId }) => ({
      data: await getApiV1Article({ articleId, userId }),
    }),
  })
}

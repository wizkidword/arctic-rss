import { articleStateMutationRequestSchema } from "@arctic-rss/api-contract"

import {
  handleApiV1DeviceSession,
  parseApiV1Identifier,
  parseApiV1IdempotencyKey,
  parseApiV1Json,
} from "@/lib/api-v1/route"
import { updateMobileArticleState } from "@/lib/mobile-sync"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ articleId: string }> }
) {
  return handleApiV1DeviceSession({
    endpoint: "article-state",
    request,
    run: async ({ deviceSessionId, userId }) => {
      const { articleId: rawArticleId } = await params
      const articleId = parseApiV1Identifier(rawArticleId, "articleId")
      const input = await parseApiV1Json(request, articleStateMutationRequestSchema)
      const idempotencyKey = parseApiV1IdempotencyKey(request)
      return {
        data: await updateMobileArticleState({
          articleId,
          deviceSessionId,
          idempotencyKey,
          input,
          userId,
        }),
      }
    },
  })
}

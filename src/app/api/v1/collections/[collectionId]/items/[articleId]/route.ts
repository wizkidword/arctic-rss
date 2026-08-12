import {
  handleApiV1DeviceSession,
  parseApiV1Identifier,
  parseApiV1IdempotencyKey,
} from "@/lib/api-v1/route"
import { removeMobileCollectionItem } from "@/lib/mobile-sync"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ articleId: string; collectionId: string }> }
) {
  return handleApiV1DeviceSession({
    endpoint: "collection-items",
    request,
    run: async ({ deviceSessionId, mobileDeviceId, userId }) => {
      const { articleId: rawArticleId, collectionId: rawCollectionId } = await params
      const articleId = parseApiV1Identifier(rawArticleId, "articleId")
      const collectionId = parseApiV1Identifier(rawCollectionId, "collectionId")
      const idempotencyKey = parseApiV1IdempotencyKey(request)
      return {
        data: await removeMobileCollectionItem({
          articleId,
          collectionId,
          deviceSessionId,
          mobileDeviceId,
          idempotencyKey,
          userId,
        }),
      }
    },
  })
}

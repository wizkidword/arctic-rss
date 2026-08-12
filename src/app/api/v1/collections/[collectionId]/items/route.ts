import { collectionItemRequestSchema } from "@arctic-rss/api-contract"

import {
  handleApiV1DeviceSession,
  parseApiV1Identifier,
  parseApiV1IdempotencyKey,
  parseApiV1Json,
} from "@/lib/api-v1/route"
import { addMobileCollectionItem } from "@/lib/mobile-sync"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function POST(
  request: Request,
  { params }: { params: Promise<{ collectionId: string }> }
) {
  return handleApiV1DeviceSession({
    endpoint: "collection-items",
    request,
    run: async ({ deviceSessionId, mobileDeviceId, userId }) => {
      const { collectionId: rawCollectionId } = await params
      const collectionId = parseApiV1Identifier(rawCollectionId, "collectionId")
      const { articleId } = await parseApiV1Json(request, collectionItemRequestSchema)
      const idempotencyKey = parseApiV1IdempotencyKey(request)
      return {
        data: await addMobileCollectionItem({
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

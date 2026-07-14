import { requireFreshAdmin } from "@/lib/authorization"
import {
  parseChatLegalHoldUpdateInput,
  updateChatLegalHold,
} from "@/lib/chat/legal-holds"

import { assertSameOrigin, legalHoldErrorResponse, noStore } from "../route"

export const dynamic = "force-dynamic"

export async function PATCH(
  request: Request,
  context: { params: Promise<{ holdId: string }> }
) {
  try {
    assertSameOrigin(request)
    const [admin, body, { holdId }] = await Promise.all([
      requireFreshAdmin(),
      request.json(),
      context.params,
    ])

    if (!holdId || holdId.length > 128) {
      return noStore({ error: "Legal hold ID is invalid." }, 400)
    }

    return noStore({
      hold: await updateChatLegalHold({
        holdId,
        identity: { role: admin.role, userId: admin.id },
        input: parseChatLegalHoldUpdateInput(body),
      }),
    })
  } catch (error) {
    return legalHoldErrorResponse(error)
  }
}

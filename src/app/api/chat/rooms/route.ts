import { requireChatEligibleUser } from "@/lib/chat/access"
import { listChatRooms } from "@/lib/chat/room-service"

import { chatNoStoreResponse, chatRouteErrorResponse } from "../chat-response"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await requireChatEligibleUser()
    const rooms = await listChatRooms()

    return chatNoStoreResponse({ rooms })
  } catch (error) {
    return chatRouteErrorResponse(error)
  }
}

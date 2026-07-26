import type { PrismaClient } from "@/generated/prisma/client"

export type ChatReadMarkerRepairStore = Pick<
  PrismaClient,
  "chatMessage" | "chatRoomMember"
>

export type ChatReadMarkerRepairResult = {
  clamped: number
  nextCursor: string | null
  scanned: number
}

export async function repairChatReadMarkers({
  afterId,
  batchSize = 100,
  dryRun = true,
  store,
}: {
  afterId?: string
  batchSize?: number
  dryRun?: boolean
  store: ChatReadMarkerRepairStore
}): Promise<ChatReadMarkerRepairResult> {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 250) {
    throw new Error("Read-marker repair batchSize must be an integer between 1 and 250.")
  }

  const members = await store.chatRoomMember.findMany({
    ...(afterId ? { cursor: { id: afterId }, skip: 1 } : {}),
    orderBy: { id: "asc" },
    select: {
      id: true,
      lastReadMessageSequence: true,
      roomId: true,
    },
    take: batchSize,
    where: { lastReadMessageSequence: { not: null } },
  })
  let clamped = 0

  for (const member of members) {
    if (member.lastReadMessageSequence === null) {
      continue
    }

    const maximum = await store.chatMessage.findFirst({
      orderBy: { sequence: "desc" },
      select: { sequence: true },
      where: { deletedAt: null, roomId: member.roomId },
    })
    const needsClamp = !maximum || member.lastReadMessageSequence > maximum.sequence

    if (!needsClamp) {
      continue
    }

    if (dryRun) {
      clamped += 1
      continue
    }

    const updated = await store.chatRoomMember.updateMany({
      data: { lastReadMessageSequence: maximum?.sequence ?? null },
      where: maximum
        ? {
            id: member.id,
            lastReadMessageSequence: { gt: maximum.sequence },
          }
        : {
            id: member.id,
            lastReadMessageSequence: { not: null },
          },
    })
    clamped += updated.count
  }

  return {
    clamped,
    nextCursor: members.length === batchSize ? members.at(-1)?.id ?? null : null,
    scanned: members.length,
  }
}

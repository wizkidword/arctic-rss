import type { PrismaClient } from "@/generated/prisma/client"

import {
  type ChatInterestOption,
  listCanonicalChatInterestOptions,
  normalizeChatRoomSlug,
} from "./normalization"

export type OfficialChatRoomDefinition = {
  description: string
  interestIds: readonly string[]
  name: string
  slug: string
  topicLine: string
}

export const OFFICIAL_CHAT_ROOMS: readonly OfficialChatRoomDefinition[] = [
  {
    description: "A calm general room for welcoming people and sharing what you are reading.",
    interestIds: ["general"],
    name: "Lounge",
    slug: "lounge",
    topicLine: "Welcome to Arctic IRC. Type /help when chat opens.",
  },
  {
    description: "Artificial intelligence news, research, tools, and thoughtful discussion.",
    interestIds: ["ai"],
    name: "AI",
    slug: "ai",
    topicLine: "Models, research, policy, and practical AI work.",
  },
  {
    description: "Software, web, data, and systems programming discussion.",
    interestIds: ["programming", "tech"],
    name: "Programming",
    slug: "programming",
    topicLine: "Share useful links, questions, and lessons from building software.",
  },
  {
    description: "Security research, defensive practice, and responsible disclosure news.",
    interestIds: ["cybersecurity"],
    name: "Cybersecurity",
    slug: "cybersecurity",
    topicLine: "Defensive security, research, and trustworthy sources.",
  },
  {
    description: "Research, space, earth science, and new discoveries.",
    interestIds: ["science"],
    name: "Science",
    slug: "science",
    topicLine: "Questions, discoveries, and evidence-led discussion.",
  },
  {
    description: "Markets, companies, work, and economics without engagement bait.",
    interestIds: ["business", "economics"],
    name: "Business",
    slug: "business",
    topicLine: "Business news, economic context, and practical ideas.",
  },
  {
    description: "Games, game culture, releases, and the craft of play.",
    interestIds: ["gaming"],
    name: "Gaming",
    slug: "gaming",
    topicLine: "Games worth discussing, from old favorites to new releases.",
  },
  {
    description: "Books, publishing, writing, and criticism.",
    interestIds: ["culture", "writing"],
    name: "Books",
    slug: "books",
    topicLine: "What are you reading, writing, or recommending?",
  },
  {
    description: "Music news, albums, listening, and the culture around sound.",
    interestIds: ["entertainment", "culture"],
    name: "Music",
    slug: "music",
    topicLine: "New discoveries, old favorites, and music worth hearing.",
  },
  {
    description: "Sports news and analysis with room for fans of every game.",
    interestIds: ["sports"],
    name: "Sports",
    slug: "sports",
    topicLine: "Scores, analysis, and the stories behind the game.",
  },
]

export type ChatRoomBootstrapStore = Pick<
  PrismaClient,
  "chatRoom" | "chatRoomInterest"
>

export async function bootstrapOfficialChatRooms({
  loadInterests = listCanonicalChatInterestOptions,
  rooms = OFFICIAL_CHAT_ROOMS,
  store,
}: {
  loadInterests?: () => Promise<ChatInterestOption[]>
  rooms?: readonly OfficialChatRoomDefinition[]
  store: ChatRoomBootstrapStore
}) {
  const availableInterestIds = new Set(
    (await loadInterests()).map((interest) => interest.id)
  )
  const bootstrappedRooms: Array<{ id: string; slug: string }> = []

  for (const definition of rooms) {
    const slug = normalizeChatRoomSlug(definition.slug)
    const unknownInterestIds = definition.interestIds.filter(
      (interestId) => !availableInterestIds.has(interestId)
    )

    if (unknownInterestIds.length) {
      throw new Error(
        `Official room #${slug} references unknown Discover interests.`
      )
    }

    const room = await store.chatRoom.upsert({
      create: officialRoomData(definition, slug),
      select: { id: true, slug: true },
      update: officialRoomData(definition, slug),
      where: { slug },
    })

    for (const interestId of definition.interestIds) {
      await store.chatRoomInterest.upsert({
        create: { interestId, roomId: room.id, weight: 1 },
        update: { weight: 1 },
        where: {
          roomId_interestId: { interestId, roomId: room.id },
        },
      })
    }

    bootstrappedRooms.push(room)
  }

  return bootstrappedRooms
}

function officialRoomData(
  definition: OfficialChatRoomDefinition,
  slug: string
) {
  return {
    description: definition.description,
    historyVisibility: "MEMBERS" as const,
    isOfficial: true,
    joinPartNoticesEnabled: true,
    joinPolicy: "OPEN" as const,
    languageCode: "en",
    name: definition.name,
    slug,
    state: "ACTIVE" as const,
    topicLine: definition.topicLine,
    visibility: "PUBLIC" as const,
  }
}
